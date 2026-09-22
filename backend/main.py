from fastapi import FastAPI

app = FastAPI(title="SENTRA API")

@app.get("/")
def root():
    return {
        "project": "SENTRA",
        "status": "running",
        "message": "SENTRA Backend is working"
    }
