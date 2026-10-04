from fastapi import FastAPI
from api.events import router as events_router

from database import Base, engine
from models.event import Event

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SENTRA API")

app.include_router(events_router)


@app.get("/")
def root():
    return {
        "project": "SENTRA",
        "status": "running",
        "message": "SENTRA Backend is working"
    }