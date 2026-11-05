import logging
from pathlib import Path

from main import run_pipeline

logger = logging.getLogger(__name__)

jobs = {}
rag_chains = {}


def process_video(job_id: str, source: str, uploaded_file: Path | None = None):
    jobs[job_id] = {"status": "processing"}

    try:
        result = run_pipeline(source)
        rag_chains[job_id] = result.pop("rag_chain")

        jobs[job_id] = {
            "status": "completed",
            "result": result,
        }

    except Exception:
        logger.exception("Video processing failed. job_id=%s", job_id)
        jobs[job_id] = {
            "status": "failed",
            "error": "Video processing failed. Check the media and try again.",
        }

    finally:
        if uploaded_file is not None:
            uploaded_file.unlink(missing_ok=True)