from fastapi import FastAPI

app = FastAPI(
    title="Video Assistant API",
    description="API for processing videos and asking questions about them.",
    version="0.1.0",
)

@app.get("/health")
def health_check():
    return {"status": "ok"}