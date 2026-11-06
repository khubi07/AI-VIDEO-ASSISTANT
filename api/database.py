import sqlite3
from pathlib import Path
import json


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "app_data"
DATABASE_PATH = DATA_DIR / "video_assistant.db"


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                session_id TEXT,
                source_name TEXT,
                status TEXT NOT NULL,
                result_json TEXT,
                error TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id)
                    REFERENCES jobs(job_id)
                    ON DELETE CASCADE
            );
            """
        )

def create_job(job_id: str, source_name: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            INSERT INTO jobs (job_id, source_name, status)
            VALUES (?, ?, ?)
            """,
            (job_id, source_name, "queued"),
        )


def set_job_status(
    job_id: str,
    status: str,
    session_id: str | None = None,
    result: dict | None = None,
    error: str | None = None,
):
    result_json = json.dumps(result) if result is not None else None

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            UPDATE jobs
            SET status = ?,
                session_id = COALESCE(?, session_id),
                result_json = COALESCE(?, result_json),
                error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
            """,
            (status, session_id, result_json, error, job_id),
        )


def get_job(job_id: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            """
            SELECT job_id, session_id, source_name, status,
                   result_json, error, created_at, updated_at
            FROM jobs
            WHERE job_id = ?
            """,
            (job_id,),
        ).fetchone()

    if row is None:
        return None

    job = dict(row)
    result_json = job.pop("result_json")
    job["result"] = json.loads(result_json) if result_json else None
    return job

def add_chat_message(job_id: str, role: str, content: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            INSERT INTO chat_messages (job_id, role, content)
            VALUES (?, ?, ?)
            """,
            (job_id, role, content),
        )


def get_chat_messages(job_id: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT role, content, created_at
            FROM chat_messages
            WHERE job_id = ?
            ORDER BY message_id
            """,
            (job_id,),
        ).fetchall()

    return [dict(row) for row in rows]