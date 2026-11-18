from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    Float,
    DateTime,
    ForeignKey,
    func,
)

from database import Base


class Sensor(Base):
    __tablename__ = "sensors"

    sensor_id = Column(Integer, primary_key=True, index=True)
    sensor_name = Column(String(100), nullable=False)
    sensor_type = Column(String(50), nullable=False)
    room_id = Column(
        Integer,
        ForeignKey("rooms.room_id"),
        nullable=True
    )
    device_id = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    reading_id = Column(BigInteger, primary_key=True, index=True)
    sensor_id = Column(
        Integer,
        ForeignKey("sensors.sensor_id"),
        nullable=False
    )
    reading_value = Column(Float, nullable=True)
    reading_boolean = Column(Boolean, nullable=True)
    unit = Column(String(30), nullable=True)
    recorded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
