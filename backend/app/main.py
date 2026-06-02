import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.services.storage import ensure_upload_dir
from app.api import auth, departments, complaints, admin, assessment

# Instantiate FastAPI application
app = FastAPI(
    title="Smart Campus Governance & Grievance Verification API",
    description="Backend workflow automation engine with state management and role-based permissions.",
    version="1.0.0"
)

# Setup CORS for frontend decouple development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database tables exist
from app.models import base
Base.metadata.create_all(bind=engine)

# Startup DB initialisation and upload folder check
@app.on_event("startup")
def startup_event():
    # Establish storage structures
    upload_path = ensure_upload_dir()
    
    # Mount static resource routing for evidence files
    app.mount("/static/uploads", StaticFiles(directory=upload_path), name="uploads")

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
