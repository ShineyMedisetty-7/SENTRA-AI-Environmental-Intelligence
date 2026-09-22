from fastapi import FastAPI
from api.events import router as events_router

app = FastAPI(title="SENTRA API")

app.include_router(events_router)


@app.get("/")
def root():
    return {
        "project": "SENTRA",
        "status": "running",
        "message": "SENTRA Backend is working"
    }
