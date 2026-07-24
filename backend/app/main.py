import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.services.storage import ensure_upload_dir
from app.api import auth, departments, complaints, admin, assessment

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Ensure database tables exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Automatic DB table creation failed on startup: {e}")

    # Establish storage structures
    upload_path = ensure_upload_dir()
    
    # Mount static resource routing for evidence files
    app_instance.mount("/static/uploads", StaticFiles(directory=upload_path), name="uploads")
    yield

# Instantiate FastAPI application
app = FastAPI(
    title="Smart Campus Governance & Grievance Verification API",
    description="Backend workflow automation engine with state management and role-based permissions.",
    version="1.0.0",
    lifespan=lifespan
)

# Setup CORS for frontend decouple development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# Include Router Modules
app.include_router(auth.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(complaints.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(assessment.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Smart Campus Governance Workflow Engine",
        "documentation": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CampusBridge Governance API",
        "version": "1.0.0"
    }

