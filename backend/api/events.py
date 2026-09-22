from fastapi import APIRouter
from datetime import datetime

router = APIRouter(
    prefix="/events",
    tags=["Events"]
)

@router.get("/")
def get_events():
    return {
        "status": "success",
        "message": "SENTRA Events API is working",
        "timestamp": datetime.now().isoformat(),
        "events": []
    }
