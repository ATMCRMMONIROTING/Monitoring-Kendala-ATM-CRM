import os
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
from .config import GOOGLE_DRIVE_JSON, GOOGLE_DRIVE_FOLDER_ID_SUBMIT, GOOGLE_DRIVE_FOLDER_ID_CREATE

FOLDER_SUBMIT = GOOGLE_DRIVE_FOLDER_ID_SUBMIT
FOLDER_CREATE = GOOGLE_DRIVE_FOLDER_ID_CREATE

# Load service account credentials
SCOPES = ['https://www.googleapis.com/auth/drive']

credentials = service_account.Credentials.from_service_account_file(
    GOOGLE_DRIVE_JSON, scopes=SCOPES
)

def upload_file_to_drive(
    filename: str,
    file_data: bytes,
    mimetype: str = "image/jpeg",
    folder_id: str = FOLDER_SUBMIT  # default to submit folder
) -> str:
    service = build('drive', 'v3', credentials=credentials)
    file_metadata = {'name': filename, 'parents': [folder_id]}
    media = MediaIoBaseUpload(io.BytesIO(file_data), mimetype=mimetype)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()

    service.permissions().create(
        fileId=file.get('id'), body={'type': 'anyone', 'role': 'reader'}
    ).execute()

    return f"https://drive.google.com/uc?id={file.get('id')}&export=view"

def delete_file_from_drive(file_id: str):
    service = build('drive', 'v3', credentials=credentials)
    try:
        service.files().delete(fileId=file_id).execute()
    except HttpError as e:
        if e.resp.status == 404:
            # File already deleted or not found; can be ignored
            pass
        else:
            raise e