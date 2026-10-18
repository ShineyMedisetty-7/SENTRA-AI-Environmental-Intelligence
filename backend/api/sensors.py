from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/sensors", tags=["Sensors"])


@router.get("/latest")
def get_latest_sensor_readings():
    timestamp = datetime.now(timezone.utc).isoformat()

    return {
        "status": "success",
        "source": "simulated",
        "temperature": {"value": None, "timestamp": timestamp},
        "humidity": {"value": None, "timestamp": timestamp},
        "light": {"value": None, "timestamp": timestamp},
        "distance": {"value": None, "timestamp": timestamp},
    }
