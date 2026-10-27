
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/sensors", tags=["Sensors"])
_lock = Lock()

def empty_reading():
    return {"value": None, "timestamp": None}

_latest = {
    "status": "waiting",
    "source": "none",
    "device_id": None,
    "motion": empty_reading(),
    "temperature": empty_reading(),
    "humidity": empty_reading(),
    "light": empty_reading(),
    "distance": empty_reading(),
    "sound_raw": empty_reading(),
}


class SensorReading(BaseModel):
    device_id: str = Field(default="ESP32-SENTRA", max_length=64)
    motion: bool
    temperature: float = Field(ge=-40, le=80)
    humidity: float = Field(ge=0, le=100)
    light: int = Field(ge=0, le=1)
    distance: Optional[float] = Field(default=None, ge=0, le=4000)
    sound_raw: Optional[int] = Field(default=None, ge=0, le=4095)


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
            "sound_raw": {
                "value": reading.sound_raw,
                "timestamp": timestamp if reading.sound_raw is not None else None,
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
            "sound_raw": dict(_latest["sound_raw"]),
        }
