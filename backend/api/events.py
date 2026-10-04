from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import SessionLocal
from models.event import Event


router = APIRouter(
    prefix="/events",
    tags=["Events"]
)


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


@router.get("/")
def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).all()

    return {
        "status": "success",
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "location": event.location,
                "description": event.description,
                "timestamp": event.timestamp
            }
            for event in events
        ]
    }


@router.post("/")
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    new_event = Event(
        event_type=event_data.event_type,
        location=event_data.location,
        description=event_data.description
    )

    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    return {
        "status": "success",
        "message": "Event created successfully",
        "event": {
            "id": new_event.id,
            "event_type": new_event.event_type,
            "location": new_event.location,
            "description": new_event.description,
            "timestamp": new_event.timestamp
        }
    }