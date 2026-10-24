
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.event import Event


# Load the backend .env regardless of the terminal's working directory.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

MODEL_NAME = os.getenv("SENTRA_AI_MODEL", "gpt-4.1-mini")

LOCAL_TZ = ZoneInfo("Asia/Kolkata")
SNAPSHOT_DIR = Path(__file__).resolve().parents[1] / "data" / "snapshots"
SNAPSHOT_INTERVAL_SECONDS = max(
    1, int(os.getenv("SNAPSHOT_INTERVAL_SECONDS", "10"))
)


def find_requested_time(question: str) -> datetime | None:
    """Recognize clock-time questions and interpret them in IST."""
    match = re.search(
        r"\b(?:at|around|near|by)\s+"
        r"(\d{1,2})(?::(\d{2}))?\s*"
        r"(a\.?m\.?|p\.?m\.?)\b",
        question,
        re.IGNORECASE,
    )

    # Also recognize forms such as "what happened 10:30am?"
    if not match:
        match = re.search(
            r"\b(\d{1,2})(?::(\d{2}))?\s*"
            r"(a\.?m\.?|p\.?m\.?)\b",
            question,
            re.IGNORECASE,
        )

    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridiem = match.group(3).lower().replace(".", "")

    if not 1 <= hour <= 12 or not 0 <= minute <= 59:
        return None

    hour %= 12
    if meridiem == "pm":
        hour += 12

    now = datetime.now(LOCAL_TZ)
    requested = now.replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )

    # For a historical query, assume yesterday if the time is still ahead.
    if requested > now:
        requested -= timedelta(days=1)

    return requested


def find_snapshot_at(
    requested: datetime,
) -> tuple[Path, float] | None:
    """Find the closest saved snapshot within two capture intervals."""
    if not SNAPSHOT_DIR.is_dir():
        return None

    target = requested.timestamp()
    candidates = []

    for path in SNAPSHOT_DIR.glob("CAM-1_*.jpg"):
        try:
            timestamp = path.stat().st_mtime
        except OSError:
            continue

        candidates.append((path, timestamp))

    if not candidates:
        return None

    path, timestamp = min(
        candidates, key=lambda item: abs(item[1] - target)
    )

    if abs(timestamp - target) > SNAPSHOT_INTERVAL_SECONDS * 2:
        return None

    return path, timestamp


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    event_id: int | None = None


def describe_event(event: Event) -> str:
    person = (
        f"Person ID {event.person_id}"
        if event.person_id is not None
        else "No person ID recorded"
    )

    timestamp = (
        event.timestamp.isoformat()
        if event.timestamp
        else "Timestamp unavailable"
    )

    return (
        f"Event ID: {event.id}; "
        f"Type: {event.event_type}; "
        f"Location: {event.location or 'Not recorded'}; "
        f"Description: {event.description or 'Not recorded'}; "
        f"{person}; Timestamp: {timestamp}"
    )


def evidence_based_answer(
    question: str,
    selected_event: Event | None,
    recent_events: list[Event],
) -> str:
    """Local fallback that requires no API credits."""
    if selected_event is not None:
        return (
            "Selected event explanation\n\n"
            f"{describe_event(selected_event)}\n\n"
            "What this means: SENTRA recorded the event details shown above. "
            "The record alone does not establish intent, danger, or an anomaly. "
            "No severity, confidence score, or image evidence is available "
            "in the current event record."
        )

    if not recent_events:
        return (
            "There are no recorded events available to analyze yet. "
            "Start the camera and generate an event, then ask again."
        )

    person_events = sum(
        1
        for event in recent_events
        if event.event_type == "person_detected"
    )
    latest = recent_events[0]

    return (
        "Recent activity summary\n\n"
        f"Your question: {question}\n"
        f"Recorded events available: {len(recent_events)}.\n"
        f"Person-detection events in this history: {person_events}.\n"
        f"Most recent event: {describe_event(latest)}\n\n"
        "These counts describe stored event records, not necessarily distinct "
        "people currently present. Only the latest 20 events were retrieved. "
        "The records alone may not establish an anomaly or predict future "
        "activity."
    )


def generate_answer(
    question: str,
    evidence: list[str],
) -> str | None:
    """Generate a grounded answer, or fall back if generation fails."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        client = OpenAI(
            api_key=api_key,
            timeout=15,
            max_retries=0,
        )

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are SENTRA, an environmental monitoring assistant. "
                        "Answer questions using only the supplied event records. "
                        "Do not invent camera observations, screenshots, sensor "
                        "readings, people, timestamps, motives, or incidents. "
                        "Clearly distinguish recorded facts from interpretation. "
                        "If the records do not answer the question, say what is "
                        "missing. Do not claim to have reviewed images or video "
                        "unless they were explicitly supplied."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question:\n{question}\n\n"
                        "Available event evidence:\n"
                        + "\n".join(evidence)
                    ),
                },
            ],
            max_tokens=450,
        )

        answer = response.choices[0].message.content
        return answer.strip() if answer and answer.strip() else None

    except Exception:
        # Never expose provider errors or secrets to the dashboard.
        return None


@router.get("/health")
def ai_health():
    configured = bool(os.getenv("OPENAI_API_KEY"))

    return {
        "status": "ready",
        "mode": "generative with evidence-based fallback",
        "generative_model": configured,
        "model": MODEL_NAME if configured else None,
    }


@router.post("/ask")
def ask_ai(
    request: AskRequest,
    db: Session = Depends(get_db),
):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Enter a question.",
        )

    selected_event = None

    if request.event_id is not None:
        selected_event = (
            db.query(Event)
            .filter(Event.id == request.event_id)
            .first()
        )

        if selected_event is None:
            raise HTTPException(
                status_code=404,
                detail="The selected event was not found.",
            )

    recent_events = (
        db.query(Event)
        .order_by(Event.timestamp.desc())
        .limit(20)
        .all()
    )

    evidence_events = []

    if selected_event is not None:
        evidence_events.append(selected_event)

    for event in recent_events:
        if all(existing.id != event.id for existing in evidence_events):
            evidence_events.append(event)

    evidence = [
        describe_event(event)
        for event in evidence_events[:20]
    ]

    # Handle historical camera queries before the no-events check.
    requested_time = find_requested_time(question)

    if requested_time is not None:
        snapshot = find_snapshot_at(requested_time)

        if snapshot is None:
            answer = (
                "No saved camera snapshot was found close to "
                f"{requested_time.strftime('%I:%M %p')} IST on "
                f"{requested_time.strftime('%d %B %Y')}. "
                "The requested time may be outside the available history. "
                "SENTRA cannot reconstruct an image that was not saved."
            )

            return {
                "answer": answer,
                "mode": "historical-snapshot-unavailable",
                "event_id": selected_event.id if selected_event else None,
                "question": question,
                "evidence": evidence,
                "snapshot_url": None,
                "snapshot_timestamp": None,
            }

        snapshot_path, snapshot_epoch = snapshot

        # The endpoint selects the nearest snapshot to this Unix timestamp.
        snapshot_url = f"/camera/snapshot?at={snapshot_epoch}"

        snapshot_time = datetime.fromtimestamp(
            snapshot_epoch,
            tz=LOCAL_TZ,
        ).strftime("%d %B %Y, %I:%M:%S %p IST")

        answer = (
            "Historical camera snapshot found.\n\n"
            f"Requested time: {requested_time.strftime('%d %B %Y, %I:%M %p IST')}\n"
            f"Captured image time: {snapshot_time}\n\n"
            "The image below shows the saved camera frame closest to your "
            "requested time. This is a still image, not continuous video. "
            "The current event records do not independently establish what "
            "happened between snapshots."
        )

        return {
            "answer": answer,
            "mode": "historical-snapshot",
            "event_id": selected_event.id if selected_event else None,
            "question": question,
            "evidence": evidence,
            "snapshot_url": snapshot_url,
            "snapshot_timestamp": snapshot_epoch,
        }

    if not recent_events and selected_event is None:
        return {
            "answer": (
                "There are no recorded events to analyze yet. "
                "Start the camera and generate an event, then ask again."
            ),
            "mode": "evidence-based-fallback",
            "event_id": None,
            "question": question,
            "evidence": [],
            "snapshot_url": None,
            "snapshot_timestamp": None,
        }

    generated_answer = generate_answer(question, evidence)

    if generated_answer:
        answer = generated_answer
        mode = "generative-evidence-based"
    else:
        answer = evidence_based_answer(
            question,
            selected_event,
            recent_events,
        )
        mode = "evidence-based-fallback"

    return {
        "answer": answer,
        "mode": mode,
        "event_id": selected_event.id if selected_event else None,
        "question": question,
        "evidence": evidence,
        "snapshot_url": None,
        "snapshot_timestamp": None,
    }
