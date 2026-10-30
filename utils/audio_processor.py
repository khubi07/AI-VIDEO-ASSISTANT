import yt_dlp
from pydub import AudioSegment
import os
from typing import Any, cast

DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def download_youtube_audio(url :str) ->str:
    output_path = os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        #"quiet": True,
    }
    with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info).replace(".webm", ".wav").replace(".m4a", ".wav")
    return filename

print(download_youtube_audio("https://youtube.com/shorts/Dc0_VmdnucM?si=XbLA59EplExVxa8f"))