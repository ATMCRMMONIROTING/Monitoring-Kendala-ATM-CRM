from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import pytz
import enum

wib = pytz.timezone('Asia/Jakarta')
def current_time_wib():
    return datetime.now(wib)
    
class ReferenceData(Base):
    __tablename__ = "reference_data"

    id = Column(Integer, primary_key=True, index=True)
    tid = Column(String, unique=True, index=True, nullable=False)
    kc_supervisi = Column(String)
    pengelola = Column(String)
    lokasi = Column(String)

    orders = relationship("Order", back_populates="reference_data")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    
class OrderState(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    overdue = "overdue"
    completed_but_overdue = "completed but overdue"

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    state = Column(Enum(OrderState), default=OrderState.pending)
    created_at = Column(DateTime(timezone=True), default=current_time_wib)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    image_url = Column(String, nullable=True)
    image_url_new = Column(String, nullable=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="orders")
    reference_id = Column(Integer, ForeignKey("reference_data.id"), nullable=True)
    reference_data = relationship("ReferenceData", back_populates="orders")
    warning_sent = Column(Boolean, default=False)

# In User model (also in models.py)
User.orders = relationship("Order", back_populates="user")