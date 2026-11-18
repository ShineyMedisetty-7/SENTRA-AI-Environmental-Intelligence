
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime

from database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)

    event_type = Column(String, nullable=False)
    location = Column(String, nullable=True)
    description = Column(String, nullable=True)

    person_id = Column(Integer, nullable=True, index=True)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=True
    )

    # Identifies the source of imported historical events.
    # New live events will have NULL here.
    legacy_source = Column(String(100), nullable=True)
