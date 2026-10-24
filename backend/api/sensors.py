
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/sensors", tags=["Sensors"])
_lock = Lock()

_latest = {
    "status": "success",
    "source": "simulated",
    "device_id": None,
    "motion": {"value": None, "timestamp": None},
    "temperature": {"value": None, "timestamp": None},
    "humidity": {"value": None, "timestamp": None},
    "light": {"value": None, "timestamp": None},
    "distance": {"value": None, "timestamp": None},
}


class SensorReading(BaseModel):
    device_id: str = Field(default="ESP32-SENTRA", max_length=64)
    motion: bool
    temperature: float = Field(ge=-40, le=80)
    humidity: float = Field(ge=0, le=100)
    light: int = Field(ge=0, le=1)
    distance: Optional[float] = Field(default=None, ge=0, le=4000)


@router.post("/ingest")
def ingest_sensor_readings(reading: SensorReading):
    timestamp = datetime.now(timezone.utc).isoformat()

    with _lock:
        _latest.update({
            "status": "success",
            "source": "esp32",
            "device_id": reading.device_id,
            "motion": {
                "value": reading.motion,
                "timestamp": timestamp,
            },
            "temperature": {
                "value": reading.temperature,
                "timestamp": timestamp,
            },
            "humidity": {
                "value": reading.humidity,
                "timestamp": timestamp,
            },
            "light": {
                "value": reading.light,
                "timestamp": timestamp,
            },
            "distance": {
                "value": reading.distance,
                "timestamp": timestamp if reading.distance is not None else None,
            },
        })

    return {
        "status": "success",
        "message": "Sensor readings received",
        "device_id": reading.device_id,
        "timestamp": timestamp,
    }


@router.get("/latest")
def get_latest_sensor_readings():
    with _lock:
        return {
            **_latest,
            "motion": dict(_latest["motion"]),
            "temperature": dict(_latest["temperature"]),
            "humidity": dict(_latest["humidity"]),
            "light": dict(_latest["light"]),
            "distance": dict(_latest["distance"]),
        }
