import os
from huggingface_hub import snapshot_download
from faster_whisper import WhisperModel

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
MODEL_REPO = f"Systran/faster-whisper-{WHISPER_MODEL}"

_model = None


def load_model():
    global _model

    if _model is None:
        print(f"Preparing Faster-Whisper model: {WHISPER_MODEL}", flush=True)

        print(f"Checking/downloading model files from {MODEL_REPO}...", flush=True)
        model_dir = snapshot_download(repo_id=MODEL_REPO)
        print(f"Model files ready at: {model_dir}", flush=True)

        print("Loading model into memory...", flush=True)
        _model = WhisperModel(model_dir, device="cpu", compute_type="int8")
        print("Faster-Whisper model loaded.", flush=True)

    return _model


def transcribe_chunks(chunk_path: str, translate: bool = False) -> str:
    model = load_model()
    task = "translate" if translate else "transcribe"

    print(f"Transcribing: {chunk_path}", flush=True)
    segments, info = model.transcribe(chunk_path, task=task)

    # Faster-Whisper returns a lazy iterator, so consume it to run transcription.
    text = " ".join(segment.text.strip() for segment in segments).strip()

    if not isinstance(text, str):
        raise TypeError("Faster-Whisper returned non-string transcription text")

    print(f"Finished: {chunk_path}", flush=True)
    return text


def transcribe_all(chunks: list, translate: bool = False) -> str:
    transcripts = []

    for index, chunk in enumerate(chunks, start=1):
        print(f"Transcribing chunk {index}/{len(chunks)}", flush=True)
        transcripts.append(transcribe_chunks(chunk, translate=translate))

    return " ".join(transcripts)