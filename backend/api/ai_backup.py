
import re
from datetime import datetime, timedelta, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models.event import Event

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


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
    timestamp = (
        event.timestamp.strftime("%Y-%m-%d %I:%M:%S %p")
        if event.timestamp
        else "Timestamp unavailable"
    )
    return (
        f"Event ID: {event.id}; "
        f"Type: {event.event_type}; "
        f"Location: {event.location or 'Not recorded'}; "
        f"Description: {event.description or 'Not recorded'}; "
        f"Person ID: {event.person_id if event.person_id is not None else 'Not recorded'}; "
        f"Timestamp: {timestamp}"
    )


def parse_clock(text: str):
    """Extract a clock time such as 10 PM, 10:30 PM, or 22:00."""
    match = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b",
        text,
        re.IGNORECASE,
    )
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        suffix = match.group(3).lower().replace(".", "")
        if not 1 <= hour <= 12 or not 0 <= minute <= 59:
            return None
        hour = hour % 12 + (12 if suffix == "pm" else 0)
        return time(hour, minute)

    match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", text)
    if match:
        return time(int(match.group(1)), int(match.group(2)))

    return None


def question_date(text: str):
    today = datetime.now().date()
    lower = text.lower()

    if "day before yesterday" in lower:
        return today - timedelta(days=2)
    if "yesterday" in lower:
        return today - timedelta(days=1)
    if "today" in lower or "tonight" in lower:
        return today

    match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if match:
        try:
            return datetime.strptime(match.group(0), "%Y-%m-%d").date()
        except ValueError:
            return None

    return None


def is_person_query(text: str) -> bool:
    return bool(
        re.search(r"\bperson\s*#?\s*\d+\b", text, re.IGNORECASE)
        or re.search(r"\bperson\s+id\s*#?\s*\d+\b", text, re.IGNORECASE)
    )


@router.get("/health")
def ai_health():
    return {
        "status": "ready",
        "mode": "database-backed event search",
        "generative_model": False,
    }


@router.post("/ask")
def ask_ai(request: AskRequest, db: Session = Depends(get_db)):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Enter a question.")

    lower = question.lower()
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

    person_match = re.search(
        r"\bperson(?:\s+id)?\s*#?\s*(\d+)\b",
        question,
        re.IGNORECASE,
    )
    person_id = int(person_match.group(1)) if person_match else None

    query = db.query(Event)

    if person_id is not None:
        query = query.filter(Event.person_id == person_id)

    date_value = question_date(question)
    if date_value:
        start = datetime.combine(date_value, time.min)
        end = start + timedelta(days=1)
        query = query.filter(
            Event.timestamp >= start,
            Event.timestamp < end,
        )

    clock_value = parse_clock(question)
    if clock_value:
        # A specific clock time is treated as a one-minute window.
        # Add an explicit date to target a particular day.
        query = query.filter(
            func.strftime("%H:%M", Event.timestamp)
            == clock_value.strftime("%H:%M")
        )

    events = query.order_by(Event.timestamp.desc()).limit(200).all()

    # Keep the selected event available as context if it wasn't in the search.
    if selected_event and all(e.id != selected_event.id for e in events):
        events.insert(0, selected_event)

    if not events:
        target = f" for Person ID {person_id}" if person_id is not None else ""
        if date_value:
            target += f" on {date_value.isoformat()}"
        if clock_value:
            target += f" around {clock_value.strftime('%I:%M %p').lstrip('0')}"
        answer = (
            f"No matching event records were found{target}. "
            "This means the database has no matching record for the filters "
            "I understood from your question; it does not prove that nobody "
            "was physically present."
        )
        return {
            "answer": answer,
            "mode": "database-backed",
            "event_id": selected_event.id if selected_event else None,
            "question": question,
            "evidence": [],
        }

    if person_id is not None:
        first_event = min(
            events,
            key=lambda event: event.timestamp or datetime.max,
        )
        if any(word in lower for word in ("how many", "number of", "count")):
            answer = (
                f"Found {len(events)} matching stored event record(s) "
                f"for Person ID {person_id}."
            )
        elif any(word in lower for word in ("all events", "show all", "history", "every time")):
            answer = (
                f"Found {len(events)} matching event record(s) "
                f"for Person ID {person_id}:\n"
                + "\n".join(describe_event(event) for event in events)
            )
        else:
            answer = (
                f"Person ID {person_id} was first detected in the matching "
                f"records at "
                f"{first_event.timestamp.strftime('%I:%M:%S %p on %Y-%m-%d') if first_event.timestamp else 'an unknown time'}"
                f"{' at ' + first_event.location if first_event.location else ''}. "
                "This is the recorded detection time, not verified physical entry time."
            )
    elif clock_value:
        answer = (
            f"Found {len(events)} event record(s) at "
            f"{clock_value.strftime('%I:%M %p')} matching your filters:\n"
            + "\n".join(describe_event(event) for event in events[:20])
        )
    else:
        person_events = sum(
            1 for event in events if event.event_type == "person_detected"
        )
        latest = events[0]
        answer = (
            f"Found {len(events)} matching event record(s), including "
            f"{person_events} person-detection event(s).\n"
            f"Most recent matching event: {describe_event(latest)}"
        )

    return {
        "answer": answer,
        "mode": "database-backed",
        "event_id": selected_event.id if selected_event else None,
        "question": question,
        "evidence": [describe_event(event) for event in events[:20]],
    }
