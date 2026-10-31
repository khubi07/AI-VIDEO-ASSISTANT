import whisper
import os

WHISPER_MODEL    = os.getenv("WHISPER_MODEL", "small")

_model = None

def load_model():

    global _model  

    if _model is None: 
        print(f"Loading Whisper model: {WHISPER_MODEL} ...")
        _model = whisper.load_model(WHISPER_MODEL) 
        print("Whisper model loaded.")
    return _model 

#transcribe 1 chunk
def transcribe_chunks(chunk_path: str, translate: bool = False) -> str:
    #If Someone passes the value of `translate` as `true` Means audio will be converted from Hindi to English. 
    #If the `translate` value is not passed, the default value will be taken as `false`. That means no translation will take place. 

    model = load_model

    task = "translate" if translate else "transcribe"
    #This is known as ternary if-else. If `translate` is true, the value of `task` is `translate`; otherwise, `transcribe`. 
    result = model.transcribe(chunk_path, task="transcribe")
    return result["text"]

#transcribe all chunk
#We have separated the transcription of one chunk with all, So if an error comes in between, we can catch it. 

def transcribe_all(chunks: list, translate: bool = False) -> str:

    full_transcript = ""

    for i, chunk in enumerate(chunks):
        text = transcribe_chunks(chunk, translate=translate)

        full_transcript += text + " "

    return full_transcript