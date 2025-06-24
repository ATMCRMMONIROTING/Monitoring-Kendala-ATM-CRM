from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from .. import models, schemas, auth, drive_utils
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..schemas import UserOut
from datetime import datetime, timedelta
from pytz import timezone

router = APIRouter(prefix="/users", tags=["Users"])

WIB = timezone("Asia/Jakarta")
OVERDUE_LIMIT_HOURS = 2

def format_timedelta(duration: timedelta) -> str:
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes = remainder // 60
    return f"lewat {hours} jam {minutes} menit"

@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: UserOut = Depends(get_current_user)):
    return current_user

@router.get("/admin")
def admin_only(current_user: UserOut = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"message": f"Welcome admin {current_user.username}!"}

@router.get("/orders", response_model=list[schemas.OrderOut])
def get_my_orders(db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    now = datetime.now(WIB)
    overdue_limit = timedelta(hours=OVERDUE_LIMIT_HOURS)
    orders = db.query(models.Order).filter(models.Order.user_id == user.id).all()
    result = []

    for order in orders:
        overdue_by = None
        created_at = order.created_at
        completed_at = order.completed_at

        # Localize naive datetimes to WIB
        if created_at.tzinfo is None:
            created_at = WIB.localize(created_at)
        if completed_at and completed_at.tzinfo is None:
            completed_at = WIB.localize(completed_at)

        if completed_at:
            # Calculate total duration taken
            total_duration = completed_at - created_at
            if total_duration > overdue_limit:
                overdue_time = total_duration - overdue_limit
                overdue_by = format_timedelta(overdue_time)
        else:
            # Order not completed yet, check if overdue based on current time
            deadline = created_at + overdue_limit
            if now > deadline:
                overdue_time = now - deadline
                overdue_by = format_timedelta(overdue_time)

        result.append(schemas.OrderOut(
            id=order.id,
            title=order.title,
            description=order.description,
            state=order.state.value,
            created_at=created_at,
            completed_at=completed_at,
            image_url=order.image_url,
            image_url_new=order.image_url_new,
            user_id=order.user_id,
            username=order.user.username,
            overdue_duration=overdue_by,
            reference_id=order.reference_id,
            reference_data={
                "id": order.reference_data.id,
                "tid": order.reference_data.tid,
                "kc_supervisi": order.reference_data.kc_supervisi,
                "pengelola": order.reference_data.pengelola,
                "lokasi": order.reference_data.lokasi
            } if order.reference_data else None
            
        ))

    return result

@router.post("/orders/{order_id}/submit")
def submit_order(order_id: int, file: UploadFile = File(...), db: Session = Depends(auth.get_db), user=Depends(auth.get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == user.id).first()
    if not order:
        raise HTTPException(404, detail="Order not found or unauthorized")

    if order.state == models.OrderState.completed:
        raise HTTPException(400, detail="Order already completed")

    file_data = file.file.read()
    file_url = drive_utils.upload_file_to_drive(file.filename, file_data)

    now = datetime.now(WIB)

    created_at = order.created_at
    if created_at.tzinfo is None:
        created_at = WIB.localize(created_at)

    deadline = created_at + timedelta(hours=OVERDUE_LIMIT_HOURS)
    if now > deadline:
        overdue_time = now - deadline
        overdue_duration = format_timedelta(overdue_time)
    else:
        overdue_duration = None

    order.image_url = file_url
    order.completed_at = now

    if overdue_duration:
        order.state = models.OrderState.completed_but_overdue
        order.overdue_duration = overdue_duration
    else:
        order.state = models.OrderState.completed

    db.commit()

    return {
        "detail": "Order submitted",
        "image_url": file_url,
        "completed_at": now.isoformat(),
        "overdue_by": overdue_duration
    }