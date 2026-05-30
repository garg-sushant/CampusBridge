import os
import uuid
import shutil
from fastapi import UploadFile
from app.core.config import settings

def ensure_upload_dir():
    # Construct upload path relative to backend root
    upload_path = settings.UPLOAD_DIR
    if not os.path.isabs(upload_path):
        # Anchor to backend parent directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        upload_path = os.path.join(base_dir, settings.UPLOAD_DIR)
    
    os.makedirs(upload_path, exist_ok=True)
    return upload_path

def save_uploaded_file(file: UploadFile) -> str:
    upload_path = ensure_upload_dir()
    
    # Extract extension securely
    _, ext = os.path.splitext(file.filename)
    if not ext:
        # Default to generic or guess extension if none
        ext = ".png"
        
    # Generate random unique filename
    unique_filename = f"{uuid.uuid4()}{ext.lower()}"
    file_destination = os.path.join(upload_path, unique_filename)
    
    # Save the file stream chunk-by-chunk
    with open(file_destination, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return the relative URL access path
    return f"/static/uploads/{unique_filename}"
