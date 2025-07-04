from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app import models
from app.models import OrderState
from app.notifier import send_telegram_message
from app.config import TELEGRAM_GROUP_ID, TELEGRAM_GROUP_IDS
from app.models import wib
import re

PENGELOLA_TO_USERNAME = {
    "SENTRALISASI CRO BG BANDUNG": "BGBANDUNG",
    "SENTRALISASI CRO BG CIREBON": "BGCIREBON",
    "SENTRALISASI CRO BG TASIKMALAYA": "BGTASIKMALAYA",
    "SENTRALISASI CRO BG SUKABUMI": "BGSUKABUMI",
    "SENTRALISASI CRO KEJAR BANDUNG": "KEJARBANDUNG",
}

def escape_markdown_v2(text: str) -> str:
    escape_chars = r'\_*[]()~`>#+-=|{}.!'
    return re.sub(f'([{re.escape(escape_chars)}])', r'\\\1', str(text))

def check_and_flag_overdue_orders(db: Session):
    now = datetime.now(wib)
    overdue_limit = now - timedelta(hours=2)
    overdue_warning = now - timedelta(hours=1)

    overdue_orders = db.query(models.Order).filter(
        models.Order.state == OrderState.pending,
        models.Order.created_at < overdue_limit
    ).all()
    
    warning_orders = db.query(models.Order).filter(
        models.Order.state == OrderState.pending,
        models.Order.created_at < overdue_warning,
        models.Order.created_at >= overdue_limit,
        models.Order.warning_sent == False 
    ).all()

    for order in overdue_orders:
        order.state = OrderState.overdue

        if order.reference_data:
            try:
                tid = escape_markdown_v2(order.reference_data.tid or "unknown")
                lokasi = escape_markdown_v2(order.reference_data.lokasi or "tidak diketahui")
                pengelola = escape_markdown_v2(order.reference_data.pengelola or "")
                kanca_supervisi = escape_markdown_v2(order.reference_data.kc_supervisi or "")
                dibuat_utc = order.created_at
                dibuat_wib = dibuat_utc.astimezone(wib)
                waktu = escape_markdown_v2(dibuat_wib.strftime('%H:%M:%S'))
                tanggal = escape_markdown_v2(dibuat_wib.strftime('%d-%m-%Y'))
                
                message = (
                    f"*SLA (OUT FLM)*\n\n"
                    f"*Kendala dengan TID:* _{tid}_ di _{lokasi}_ telah *MELEWATI* SLA (OUT FLM)\\.\n"
                    f"*Pengelola:* _{pengelola}_\n"
                    f"*Kanca Supervisi:* _{kanca_supervisi}_\n"
                    f"*Waktu Kejadian:* {waktu} \\| {tanggal}\n\n"
                    f"*TINDAKAN:* Mohon _*SEGERA*_ ditindaklanjuti\\!"
                )

                send_telegram_message(TELEGRAM_GROUP_ID, message)
                
                username = PENGELOLA_TO_USERNAME.get(order.reference_data.pengelola)
                if username and username in TELEGRAM_GROUP_IDS:
                    send_telegram_message(TELEGRAM_GROUP_IDS[username], message)
                    
            except Exception as e:
                print(f"Failed to send message for order ID {order.id}: {e}")
                
    db.commit()
                
    for order in warning_orders :
        if order.reference_data:
            try:
                tid = escape_markdown_v2(order.reference_data.tid or "unknown")
                lokasi = escape_markdown_v2(order.reference_data.lokasi or "tidak diketahui")
                pengelola = escape_markdown_v2(order.reference_data.pengelola or "")
                kanca_supervisi = escape_markdown_v2(order.reference_data.kc_supervisi or "")
                dibuat_utc = order.created_at
                dibuat_wib = dibuat_utc.astimezone(wib)
                waktu = escape_markdown_v2(dibuat_wib.strftime('%H:%M:%S'))
                tanggal = escape_markdown_v2(dibuat_wib.strftime('%d-%m-%Y'))
                
                message = (
                    f"*SLA (IN FLM)*\n\n"
                    f"*Kendala dengan TID:* _{tid}_ di _{lokasi}_ sudah melebihi 1 jam\\.\n"
                    f"*Pengelola:* _{pengelola}_\n"
                    f"*Kanca Supervisi:* _{kanca_supervisi}_\n"
                    f"*Waktu Kejadian:* {waktu} \\| {tanggal}\n\n"
                    f"*TINDAKAN:* Mohon ditindaklanjuti sebelum melewati SLA\\!"
                )

                send_telegram_message(TELEGRAM_GROUP_ID, message)
                    
                username = PENGELOLA_TO_USERNAME.get(order.reference_data.pengelola)
                if username and username in TELEGRAM_GROUP_IDS:
                    send_telegram_message(TELEGRAM_GROUP_IDS[username], message)                    
                    
                order.warning_sent = True
                
            except Exception as e:
                print(f"Failed to send message for order ID {order.id}: {e}")
    db.commit()