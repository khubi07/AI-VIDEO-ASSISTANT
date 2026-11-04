from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, HttpUrl


PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".flac",
    ".ogg",
    ".mp4",
    ".mov",
    ".mkv",
    ".avi",
    ".webm",
}
app = FastAPI(
    title="Video Assistant API",
    description="API for processing videos and asking questions about them.",
    version="0.1.0",
)


class VideoRequest(BaseModel):
    url: HttpUrl


class VideoAccepted(BaseModel):
    status: str
    url: HttpUrl


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/videos", response_model=VideoAccepted)
def create_video(request: VideoRequest):
    return {
        "status": "accepted",
        "url": request.url,
    }


@app.post("/uploads")
async def upload_media(file: UploadFile = File(...)):
    original_name = file.filename or "uploaded-media"
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload an audio or video file.",
        )

    upload_id = uuid4().hex
    saved_path = UPLOAD_DIR / f"{upload_id}{extension}"
    size_bytes = 0

    try:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        with saved_path.open("wb") as destination:
            while chunk := await file.read(CHUNK_SIZE):
                size_bytes += len(chunk)

                if size_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. The maximum size is 200 MB.",
                    )

                destination.write(chunk)

        if size_bytes == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    except HTTPException:
        saved_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

    return {
        "status": "uploaded",
        "upload_id": upload_id,
        "filename": original_name,
        "size_bytes": size_bytes,
    }