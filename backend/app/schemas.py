from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        orm_mode = True
        
class OrderBase(BaseModel):
    title: str
    description: str

class OrderCreate(OrderBase):
    user_id: int
    tid: Optional[str] = None
    nama_penulis: Optional[str] = None 
    nomor_hp: Optional[str] = None 
    
class ReferenceDataOut(BaseModel):
    id: int
    tid: str
    kc_supervisi: str
    pengelola: str
    lokasi: str

    class Config:
        orm_mode = True

class OrderOut(OrderBase):
    id: int
    title: str
    description: str
    state: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    image_url: Optional[str] = None
    image_url_new : Optional[str] = None
    user_id: int
    username: Optional[str] = None 
    overdue_duration: Optional[str] = None
    reference_id: Optional[int]
    reference_data: Optional[ReferenceDataOut]
    nama_penulis: Optional[str] = None
    nomor_hp: Optional[str] = None
    
    class Config:
        orm_mode = True