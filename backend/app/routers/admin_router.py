from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import models, schemas, auth, drive_utils, config
from ..drive_utils import delete_file_from_drive
from datetime import timedelta, datetime
from pytz import timezone
from io import BytesIO
import re
import pytz
import pandas as pd

router = APIRouter(prefix="/admin", tags=["Admin"])

WIB = timezone("Asia/Jakarta")
OVERDUE_LIMIT_HOURS = 2

def format_timedelta(duration: timedelta) -> str:
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes = remainder // 60
    return f"lewat {hours} jam {minutes} menit"

@router.post("/orders", response_model=schemas.OrderOut)
async def create_order(
    title: str = Form(...),
    description: str = Form(...),
    user_id: int = Form(...),
    tid: Optional[str] = Form(None),
    nama_penulis: Optional[str] = Form(None),
    nomor_hp: Optional[str] = Form(None),  
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(auth.get_db),
    user=Depends(auth.get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")

    ref = db.query(models.ReferenceData).filter(models.ReferenceData.tid == tid).first()

    if not ref:
        raise HTTPException(404, detail=f"TID {tid} not found in reference data")

    file_url = None
    if file:
        file_data = await file.read()
        file_url = drive_utils.upload_file_to_drive(
            filename=file.filename,
            file_data=file_data,
            mimetype=file.content_type,
            folder_id=config.GOOGLE_DRIVE_FOLDER_ID_CREATE
        )

    new_order = models.Order(
        title=title,
        description=description,
        user_id=user_id,
        reference_id=ref.id,
        image_url_new=file_url,
        nama_penulis=nama_penulis,
        nomor_hp=nomor_hp  
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@router.get("/orders", response_model=list[schemas.OrderOut])
def get_all_orders(db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")

    now_wib = datetime.now(WIB)
    overdue_limit = timedelta(hours=OVERDUE_LIMIT_HOURS)
    orders = db.query(models.Order).all()
    result = []

    for o in orders:
        username = o.user.username if o.user else None
        overdue_duration = None
        reference_data = {
            "id": o.reference_data.id,
            "tid": o.reference_data.tid,
            "kc_supervisi": o.reference_data.kc_supervisi,
            "pengelola": o.reference_data.pengelola,
            "lokasi": o.reference_data.lokasi,
        } if o.reference_data else None

        if o.completed_at:
            time_to_complete = o.completed_at - o.created_at
            if time_to_complete > overdue_limit:
                overdue_time = time_to_complete - overdue_limit
                overdue_duration = format_timedelta(overdue_time)

        order_dict = {
            "id": o.id,
            "title": o.title,
            "description": o.description,
            "state": o.state.value,
            "created_at": o.created_at,
            "completed_at": o.completed_at,
            "image_url": o.image_url,
            "image_url_new": o.image_url_new,
            "user_id": o.user_id,
            "username": username,
            "overdue_duration": overdue_duration,
            "reference_id": o.reference_id,
            "reference_data": reference_data,
            "nama_penulis": o.nama_penulis,
            "nomor_hp": o.nomor_hp
            
        }
        result.append(order_dict)

    return result

@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")
    return db.query(models.User).filter(models.User.role == "user").all()

@router.get("/reference", response_model=list[schemas.ReferenceDataOut])
def list_reference(db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")
    return db.query(models.ReferenceData).all()


@router.delete("/orders/batch-delete")
def batch_delete_orders(
    order_ids: List[int],
    db: Session = Depends(auth.get_db),
    user=Depends(auth.get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")

    # Fetch orders to get their image URLs before deletion
    orders = db.query(models.Order).filter(models.Order.id.in_(order_ids)).all()

    for order in orders:
        for url in [order.image_url, order.image_url_new]:
            if url:
                match = re.search(r"id=([^&]+)", url)
                if match:
                    file_id = match.group(1)
                    try:
                        delete_file_from_drive(file_id)
                    except Exception as e:
                        raise HTTPException(500, detail=f"Failed to delete image from Google Drive: {e}")

    deleted_count = db.query(models.Order).filter(models.Order.id.in_(order_ids)).delete(synchronize_session=False)
    db.commit()
    return {"detail": f"{deleted_count} orders and their images deleted successfully"}

@router.delete("/orders/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(auth.get_db),
    user=Depends(auth.get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, detail="Order not found")


    for url in [order.image_url, order.image_url_new]:
        if url:
            match = re.search(r"id=([^&]+)", url)
            if match:
                file_id = match.group(1)
                try:
                    delete_file_from_drive(file_id)
                except Exception as e:
                    raise HTTPException(500, detail=f"Failed to delete image from Google Drive: {e}")

    db.delete(order)
    db.commit()
    return {"detail": "Order and associated images deleted successfully"}

@router.post("/orders/bulk-upload")
def bulk_create_orders(file: UploadFile = File(...), db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, detail="Admin only")

    contents = file.file.read()
    try:
        df = pd.read_excel(BytesIO(contents), engine='openpyxl')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {e}")

    required_columns = {"TID", "Pengelola", "Problem", "Est. Tgl. Problem"}
    if not required_columns.issubset(df.columns):
        raise HTTPException(status_code=400, detail=f"Missing columns. Required: {required_columns}")

    WIB = pytz.timezone("Asia/Jakarta")
    created_orders = []

    for _, row in df.iterrows():
        tid = str(row["TID"]).strip()
        pengelola = str(row["Pengelola"]).replace(" ", "").upper()  # normalize
        title = str(row["Problem"]).strip()
        created_at = row["Est. Tgl. Problem"]

        if isinstance(created_at, str):
            try:
                created_at = datetime.strptime(created_at, "%d/%m/%Y %H:%M")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid date format for row with TID {tid}")

        created_at = WIB.localize(created_at)

        reference = db.query(models.ReferenceData).filter(models.ReferenceData.tid == tid).first()
        if not reference:
            continue  # Skip if no reference data found

        matched_user = db.query(models.User).filter(models.User.username == pengelola).first()
        if not matched_user:
            continue  # Skip if no user found

        new_order = models.Order(
            title=title,
            description="",
            user_id=matched_user.id,
            reference_id=reference.id,
            created_at=created_at
        )
        db.add(new_order)
        created_orders.append(new_order)

    db.commit()
    return {"detail": f"{len(created_orders)} orders created successfully."}