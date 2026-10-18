import numpy as np
from ultralytics import YOLO
import asyncio
import os
import threading
import time

import cv2
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/camera", tags=["camera"])

SOURCE = os.getenv("CAMERA_SOURCE", "0")
BOUNDARY = "frame"


class _Reader:
    def __init__(self):
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.frame = None
        self.ts = 0.0
        self.error = None
        self.thread = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return

        self.stop.clear()
        self.thread = threading.Thread(
            target=self._run,
            daemon=True,
        )
        self.thread.start()

    def _run(self):
        src = int(SOURCE) if SOURCE.isdigit() else SOURCE

        while not self.stop.is_set():
            cap = cv2.VideoCapture(src)

            if not cap.isOpened():
                self.error = "Cannot open camera source"
                cap.release()
                self.stop.wait(3)
                continue

            self.error = None

            try:
                while not self.stop.is_set():
                    ok, img = cap.read()

                    if not ok:
                        self.error = "Frame read failed"
                        break

                    ok, buf = cv2.imencode(
                        ".jpg",
                        img,
                        [cv2.IMWRITE_JPEG_QUALITY, 75],
                    )

                    if ok:
                        with self.lock:
                            self.frame = buf.tobytes()
                            self.ts = time.time()
                            self.error = None
            finally:
                cap.release()

            self.stop.wait(1)

    def shutdown(self):
        self.stop.set()

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3)


_reader = _Reader()
shutdown_camera = _reader.shutdown


@router.get("/status")
def status():
    _reader.start()

    with _reader.lock:
        age = time.time() - _reader.ts if _reader.ts else None
        error = _reader.error

    if age is not None and age < 5:
        state = "live"
    elif error:
        state = "offline"
    else:
        state = "connecting"

    source_type = (
        "usb" if SOURCE.isdigit()
        else SOURCE.split(":", 1)[0]
    )

    return {
        "state": state,
        "error": error,
        "source_type": source_type,
        "frame_age_s": age,
    }


@router.get("/stream")
async def stream():
    _reader.start()

    async def gen():
        last = 0.0

        while True:
            if await asyncio.sleep(0.04) is None:
                pass

            with _reader.lock:
                frame = _reader.frame
                ts = _reader.ts

            if frame is None or time.time() - ts > 10:
                return

            if ts != last:
                last = ts

                header = (
                    f"--{BOUNDARY}\r\n"
                    "Content-Type: image/jpeg\r\n"
                    f"Content-Length: {len(frame)}\r\n\r\n"
                ).encode()

                yield header + frame + b"\r\n"

    return StreamingResponse(
        gen(),
        media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
    )


# Detection plugin placeholder.
# Load the model once when the backend imports this module.
DETECTOR = YOLO(os.getenv("YOLO_MODEL", "yolov8n.pt"))



@router.get("/detections")
def detections():
    with _reader.lock:
        frame_bytes = _reader.frame
        frame_ts = _reader.ts

    if frame_bytes is None or time.time() - frame_ts > 10:
        return {
            "model": "YOLOv8n",
            "detections": [],
            "error": "No recent camera frame",
        }

    image_array = np.frombuffer(frame_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        return {
            "model": "YOLOv8n",
            "detections": [],
            "error": "Could not decode camera frame",
        }

    results = DETECTOR.track(
        image,
        persist=True,
        tracker="bytetrack.yaml",
        classes=[0],
        conf=0.50,
        imgsz=960,
        verbose=False,
        max_det=30,
    )

    output = []
    height, width = image.shape[:2]

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().tolist()
            confidence = float(box.conf[0].item())

            track_id = None
            if box.id is not None:
                track_id = int(box.id[0].item())

            output.append({
                "label": "person",
                "person_id": track_id,
                "confidence": round(confidence, 4),
                "box": [
                    max(0.0, min(1.0, x1 / width)),
                    max(0.0, min(1.0, y1 / height)),
                    max(0.0, min(1.0, (x2 - x1) / width)),
                    max(0.0, min(1.0, (y2 - y1) / height)),
                ],
            })

    return {
        "model": "YOLOv8n + ByteTrack",
        "detections": output,
    }
