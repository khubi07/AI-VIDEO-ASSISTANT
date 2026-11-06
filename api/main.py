from pathlib import Path
from uuid import uuid4
import re
from fastapi import BackgroundTasks
from api.jobs import process_video, rag_chains
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, HttpUrl, Field
from core.rag_engine import ask_question, load_rag_chain
import logging
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.database import init_db, create_job, get_job as fetch_job, add_chat_message, get_chat_messages



logger = logging.getLogger(__name__)

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Video Assistant API",
    description="API for processing videos and asking questions about them.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VideoRequest(BaseModel):
    url: HttpUrl


class VideoAccepted(BaseModel):
    status: str
    url: HttpUrl

class JobAccepted(BaseModel):
    job_id: str
    status: str

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/videos", response_model=JobAccepted, status_code=202)
def create_video(
    request: VideoRequest,
    background_tasks: BackgroundTasks,
):
    job_id = uuid4().hex
    create_job(job_id, "video URL")

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
    job = fetch_job(job_id)

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
    create_job(job_id, uploaded_file.name)

    background_tasks.add_task(
        process_video,
        job_id,
        str(uploaded_file),
        uploaded_file,
    )

    return {"job_id": job_id, "status": "queued"}

@app.post("/jobs/{job_id}/chat")
def chat_with_video(job_id: str, request: ChatRequest):
    job = fetch_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    
    if job.get("status") != "completed":
        raise HTTPException(
            status_code=409,
            detail="This video is not ready for chat yet.",
        )
    

    rag_chain = rag_chains.get(job_id)

    if rag_chain is None:
        rag_chain = load_rag_chain(job["session_id"])
        rag_chains[job_id] = rag_chain
        raise HTTPException(
            status_code=404,
            detail="Chat is not available for this job.",
        )

    try:
        answer = ask_question(rag_chain, request.question)
    except Exception:
        logger.exception("Chat request failed. job_id=%s", job_id)
        raise HTTPException(
            status_code=502,
            detail="The assistant could not answer right now. Please try again.",
        )
    add_chat_message(job_id, "user", request.question)
    add_chat_message(job_id, "assistant", answer)

    return {"job_id": job_id, "answer": answer}

@app.get("/jobs/{job_id}/chat")
def read_chat_history(job_id: str):
    job = fetch_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "job_id": job_id,
        "messages": get_chat_messages(job_id),
    }