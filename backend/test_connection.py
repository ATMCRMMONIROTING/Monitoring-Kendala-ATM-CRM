from sqlalchemy import text
from app.database import SessionLocal

try:
    db = SessionLocal()
    db.execute(text("SELECT 1")) 
    print("✅ Connected to Supabase successfully.")
except Exception as e:
    print("❌ Connection failed:", e)
finally:
    db.close()