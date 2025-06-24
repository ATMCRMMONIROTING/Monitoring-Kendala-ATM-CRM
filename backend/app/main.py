from fastapi import FastAPI
from . import models, database, tasks, auth
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth_router, user_router, admin_router
from apscheduler.schedulers.background import BackgroundScheduler

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(lambda: tasks.check_and_flag_overdue_orders(next(auth.get_db())), 'interval', minutes=5, misfire_grace_time=60)
    scheduler.start()
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(user_router.router)
app.include_router(admin_router.router)