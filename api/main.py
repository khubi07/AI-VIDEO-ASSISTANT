from pathlib import Path
from uuid import uuid4
from uuid import uuid4
import re
from fastapi import BackgroundTasks
from api.jobs import jobs, process_video
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

class JobAccepted(BaseModel):
    job_id: str
    status: str

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/videos", response_model=JobAccepted, status_code=202)
def create_video(
    request: VideoRequest,
    background_tasks: BackgroundTasks,
):
    job_id = uuid4().hex
    jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        process_video,
        job_id,
        str(request.url),
    )

    return {
        "job_id": job_id,
        "status": "queued",
    }

@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {"job_id": job_id, **job}

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

@app.post("/uploads/{upload_id}/process", response_model=JobAccepted, status_code=202)
def process_upload(upload_id: str, background_tasks: BackgroundTasks):
    if not re.fullmatch(r"[a-f0-9]{32}", upload_id):
        raise HTTPException(status_code=404, detail="Upload not found.")

    matches = list(UPLOAD_DIR.glob(f"{upload_id}.*"))
    if len(matches) != 1:
        raise HTTPException(status_code=404, detail="Upload not found.")

    uploaded_file = matches[0]
    job_id = uuid4().hex
    jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        process_video,
        job_id,
        str(uploaded_file),
        uploaded_file,
    )

    return {"job_id": job_id, "status": "queued"}