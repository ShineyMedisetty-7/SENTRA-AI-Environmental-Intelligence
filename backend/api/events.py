from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import SessionLocal
from models.event import Event

router = APIRouter(prefix="/events", tags=["Events"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class EventCreate(BaseModel):
    event_type: str
    location: str | None = None
    description: str | None = None
    person_id: int | None = None


def serialize_event(event):
    return {
        "id": event.id,
        "event_type": event.event_type,
        "location": event.location,
        "description": event.description,
        "person_id": event.person_id,
        "timestamp": event.timestamp,
    }


@router.get("/")
def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.timestamp.desc()).limit(200).all()
    return {
        "status": "success",
        "events": [serialize_event(event) for event in events],
    }


@router.post("/")
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    new_event = Event(
        event_type=event_data.event_type,
        location=event_data.location,
        description=event_data.description,
        person_id=event_data.person_id,
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    return {
        "status": "success",
        "message": "Event created successfully",
        "event": serialize_event(new_event),
    }
