
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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


@router.get("/health")
def ai_health():
    return {
        "status": "ready",
        "mode": "evidence-based event explanations",
        "generative_model": False,
    }


@router.post("/ask")
def ask_ai(request: AskRequest, db: Session = Depends(get_db)):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Enter a question.")

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

    if not recent_events and selected_event is None:
        return {
            "answer": (
                "There are no recorded events to analyze yet. "
                "Start the camera and generate an event, then ask again."
            ),
            "mode": "evidence-based",
            "event_id": None,
            "evidence": [],
        }

    evidence_events = []
    if selected_event is not None:
        evidence_events.append(selected_event)

    for event in recent_events:
        if all(existing.id != event.id for existing in evidence_events):
            evidence_events.append(event)

    evidence = [describe_event(event) for event in evidence_events[:20]]

    if selected_event is not None:
        event_text = describe_event(selected_event)
        answer = (
            f"Selected event explanation\n\n"
            f"{event_text}\n\n"
            f"What this means: the system recorded this event with the "
            f"details shown above. The record identifies what was logged, "
            f"where it was logged, and its timestamp when available.\n\n"
            f"Limitations: this event record alone does not establish "
            f"intent, danger, unusual behavior, or the reason an alert "
            f"should be considered an anomaly. No severity, confidence "
            f"score, or image evidence is stored in the current event model."
        )
    else:
        event_count = len(recent_events)
        person_events = sum(
            1 for event in recent_events
            if event.event_type == "person_detected"
        )
        latest = recent_events[0]

        answer = (
            f"Recent activity summary\n\n"
            f"Recorded events available for this summary: {event_count}.\n"
            f"Person-detection events in the returned history: "
            f"{person_events}.\n"
            f"Most recent event: {describe_event(latest)}\n\n"
            f"These figures describe the latest stored event records, "
            f"not necessarily the number of distinct people currently "
            f"present. The history is limited to the latest 20 records. "
            f"More evidence is needed to confirm an anomaly or predict "
            f"future activity."
        )

    return {
        "answer": answer,
        "mode": "evidence-based",
        "event_id": selected_event.id if selected_event else None,
        "question": question,
        "evidence": evidence,
    }
