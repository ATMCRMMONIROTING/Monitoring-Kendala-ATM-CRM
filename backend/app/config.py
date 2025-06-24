import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")

google_drive_json_relative = os.getenv("GOOGLE_DRIVE_JSON")
GOOGLE_DRIVE_JSON = (Path(__file__).resolve().parent.parent / google_drive_json_relative).resolve()
GOOGLE_DRIVE_FOLDER_ID_SUBMIT = os.getenv("GOOGLE_DRIVE_FOLDER_ID_SUBMIT")
GOOGLE_DRIVE_FOLDER_ID_CREATE = os.getenv("GOOGLE_DRIVE_FOLDER_ID_CREATE")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_GROUP_ID = os.getenv("TELEGRAM_GROUP_ID")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
TELEGRAM_GROUP_IDS = {
    "BGBANDUNG" : os.getenv("TELEGRAM_GROUP_ID_BGBANDUNG"),
    "BGCIREBON" : os.getenv("TELEGRAM_GROUP_ID_BGCIREBON"),
    "BGTASIKMALAYA" : os.getenv("TELEGRAM_GROUP_ID_BGTASIKMALAYA"),
    "BGSUKABUMI" : os.getenv("TELEGRAM_GROUP_ID_BGSUKABUMI"),
    "KEJARBANDUNG" : os.getenv("TELEGRAM_GROUP_ID_KEJARBANDUNG"),
}