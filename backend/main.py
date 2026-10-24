
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.events import router as events_router
from api.ai import router as ai_router
from api.sensors import router as sensors_router
from database import Base, engine
from models.event import Event
from camera_service import router as camera_router, shutdown_camera


Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await asyncio.to_thread(shutdown_camera)


app = FastAPI(
    title="SENTRA API",
    description="SENTRA environmental monitoring and intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(events_router)
app.include_router(camera_router)
app.include_router(sensors_router)
app.include_router(ai_router)


@app.get("/")
def root():
    return {
        "project": "SENTRA",
        "status": "running",
        "message": "SENTRA Backend is working",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "camera": "/camera/status",
        "events": "/events/",
    }
