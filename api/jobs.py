import logging
from pathlib import Path

from main import run_pipeline
from api.database import set_job_status
logger = logging.getLogger(__name__)

jobs = {}
rag_chains = {}


def process_video(job_id: str, source: str, uploaded_file: Path | None = None):
    set_job_status(job_id, "processing")

    try:
        result = run_pipeline(source)
        rag_chains[job_id] = result.pop("rag_chain")

        set_job_status(
            job_id,
            "completed",
            session_id=result["session_id"],
            result=result,
        )

    except Exception:
        logger.exception("Video processing failed. job_id=%s", job_id)
        jobs[job_id] = {
            "status": "failed",
            "error": "Video processing failed. Check the media and try again.",
        }

    finally:
        if uploaded_file is not None:
            uploaded_file.unlink(missing_ok=True)

