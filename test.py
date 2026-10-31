from utils.audio_processor import process_input
from core.transcriber import transcribe_all

source  = "https://youtu.be/TdHgFfZgSTo?si=bE5eswMcCCoTlIyD"

chunks = process_input(source)
print(transcribe_all(chunks))