import logging
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from database import SessionLocal
from models.sensor import Sensor, SensorReading

router = APIRouter(prefix="/sensors", tags=["Sensors"])

logger = logging.getLogger(__name__)
_lock = Lock()


def empty_reading():
    return {"value": None, "timestamp": None}


SENSOR_FIELDS = (
    "motion",
    "temperature",
    "humidity",
    "light",
    "distance",
    "sound_raw",
    "gas_raw",
    "dust_raw",
)

# Maps incoming ESP32 fields to existing PostgreSQL sensor types.
SENSOR_MAPPING = {
    "motion": ("motion", None),
    "temperature": ("temperature", "C"),
    "humidity": ("humidity", "%"),
    "light": ("light", "binary"),
    "distance": ("distance", None),
    "sound_raw": ("sound", "ADC"),
}

_latest = {
    "status": "waiting",
    "source": "none",
    "device_id": None,
    **{name: empty_reading() for name in SENSOR_FIELDS},
}


class SensorReadingInput(BaseModel):
    device_id: str = Field(default="ESP32-SENTRA", max_length=64)
    motion: bool
    temperature: float = Field(ge=-40, le=80)
    humidity: float = Field(ge=0, le=100)
    light: int = Field(ge=0, le=1)
    distance: Optional[float] = Field(default=None, ge=0, le=4000)
    sound_raw: Optional[int] = Field(default=None, ge=0, le=4095)
    gas_raw: Optional[int] = Field(default=None, ge=0, le=4095)
    dust_raw: Optional[int] = Field(default=None, ge=0, le=4095)


@router.post("/ingest")
def ingest_sensor_readings(reading: SensorReadingInput):
    timestamp = datetime.now(timezone.utc)
    session = SessionLocal()

    try:
        for field_name, (sensor_type, unit) in SENSOR_MAPPING.items():
            value = getattr(reading, field_name)

            # Do not create database records for missing optional values.
            if value is None:
                continue

            sensor = (
                session.query(Sensor)
                .filter(
                    Sensor.sensor_type == sensor_type,
                    Sensor.device_id == reading.device_id,
                    Sensor.is_active.is_(True),
                )
                .first()
            )

            if sensor is None:
                raise ValueError(
                    f"No active PostgreSQL sensor registered for "
                    f"'{sensor_type}' and device '{reading.device_id}'."
                )

            session.add(
                SensorReading(
                    sensor_id=sensor.sensor_id,
                    reading_value=(
                        None if field_name == "motion" else float(value)
                    ),
                    reading_boolean=(
                        value if field_name == "motion" else None
                    ),
                    unit=unit,
                    recorded_at=timestamp,
                )
            )

        # Save all readings together in one transaction.
        session.commit()

    except ValueError as error:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(error))

    except SQLAlchemyError:
        session.rollback()
        logger.exception("Failed to save ESP32 readings to PostgreSQL")
        raise HTTPException(
            status_code=500,
            detail="Could not save sensor readings."
        )

    finally:
        session.close()

    timestamp_text = timestamp.isoformat()

    # Update the in-memory latest values only after database commit.
    with _lock:
        _latest.update({
            "status": "success",
            "source": "esp32",
            "device_id": reading.device_id,
            **{
                name: {
                    "value": getattr(reading, name),
                    "timestamp": (
                        timestamp_text
                        if getattr(reading, name) is not None
                        else None
                    ),
                }
                for name in SENSOR_FIELDS
            },
        })

    return {
        "status": "success",
        "message": "Sensor readings received and saved to PostgreSQL",
        "device_id": reading.device_id,
        "timestamp": timestamp_text,
    }


@router.get("/latest")
def get_latest_sensor_readings():
    session = SessionLocal()

    try:
        rows = (
            session.query(Sensor.sensor_type, SensorReading)
            .join(
                SensorReading,
                Sensor.sensor_id == SensorReading.sensor_id
            )
            .filter(
                Sensor.device_id == "ESP32-SENTRA",
                Sensor.is_active.is_(True),
            )
            .order_by(
                SensorReading.recorded_at.desc(),
                SensorReading.reading_id.desc(),
            )
            .all()
        )

        result = {
            "status": "waiting",
            "source": "none",
            "device_id": None,
            **{name: empty_reading() for name in SENSOR_FIELDS},
        }

        seen_types = set()

        for sensor_type, reading in rows:
            if sensor_type in seen_types:
                continue

            seen_types.add(sensor_type)

            field_name = next(
                (
                    field
                    for field, (mapped_type, _) in SENSOR_MAPPING.items()
                    if mapped_type == sensor_type
                ),
                None,
            )

            if field_name is None:
                continue

            value = (
                reading.reading_boolean
                if field_name == "motion"
                else reading.reading_value
            )

            result[field_name] = {
                "value": value,
                "timestamp": reading.recorded_at.isoformat(),
            }

        if seen_types:
            result["status"] = "success"
            result["source"] = "postgresql"
            result["device_id"] = "ESP32-SENTRA"

        # Keep the extra API fields available.
        with _lock:
            for field in ("gas_raw", "dust_raw"):
                result[field] = dict(_latest[field])

        return result

    except SQLAlchemyError:
        logger.exception("Could not retrieve latest sensor readings")
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve sensor readings from PostgreSQL."
        )

    finally:
        session.close()
