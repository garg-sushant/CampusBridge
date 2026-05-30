import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_student, require_staff
from app.models.base import Complaint, User, Department, Attachment, Comment
from app.schemas.complaints import ComplaintCreate, ComplaintOut, ComplaintListItem, CommentCreate, CommentOut, ComplaintUpdateStatus
from app.services.storage import save_uploaded_file

router = APIRouter(prefix="/complaints", tags=["Complaints"])

@router.post("/submit", response_model=ComplaintListItem, status_code=status.HTTP_201_CREATED)
def submit_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only students and admins can submit complaints
    if current_user.role not in ["student", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students and administrators can submit complaints."
        )
        
    new_complaint = Complaint(
        title=complaint_in.title,
        description=complaint_in.description,
        student_id=current_user.id,
        category=complaint_in.category,
        location=complaint_in.location,
        status="submitted",
        urgency="medium"  # Defaults to medium, AI or Admin will classify/override
    )
    
    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)
    
    # Add an initial timeline audit comment
    init_comment = Comment(
        complaint_id=new_complaint.id,
        content=f"Grievance filed successfully by {current_user.full_name}.",
        is_internal=False,
        is_ai_generated=False
    )
    db.add(init_comment)
    db.commit()
    
    # Trigger AI orchestration & routing
    from app.services.ai_agent import run_ai_orchestration
    run_ai_orchestration(new_complaint.id, db)
    
    db.refresh(new_complaint)
    
    return new_complaint

@router.post("/{complaint_id}/upload", response_model=List[ComplaintOut])
def upload_evidence(
    complaint_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )
        
    # Check permissions
    if current_user.role == "student" and complaint.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to upload files to this complaint."
        )
        
    uploaded_attachments = []
    for file in files:
        # Check standard file types
        content_type = file.content_type or ""
        if not (content_type.startswith("image/") or content_type == "application/pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {file.filename}. Only images and PDFs are supported."
            )
            
        file_url = save_uploaded_file(file)
        attachment = Attachment(
            complaint_id=complaint.id,
            file_url=file_url,
            file_type=content_type,
            ai_verification_status="pending"
        )
        db.add(attachment)
        db.flush() # Populate attachment ID
        
        # Trigger AI evidence verification
        from app.services.ai_agent import run_ai_evidence_verification
        run_ai_evidence_verification(attachment.id, db)
        
        uploaded_attachments.append(attachment)
        
    # Audit log entry for attachments
    file_names = ", ".join([f.filename for f in files])
    audit_comment = Comment(
        complaint_id=complaint.id,
        content=f"Evidence uploaded: {file_names}",
        is_internal=False,
        is_ai_generated=False
    )
    db.add(audit_comment)
    db.commit()
    
    # Return updated list of complaints
    return db.query(Complaint).filter(
        Complaint.student_id == current_user.id if current_user.role == "student" else True
    ).all()

@router.get("/", response_model=List[ComplaintListItem])
def list_complaints(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint)
    
    # Apply role-based filtration
    if current_user.role == "student":
        # Students can only see their own complaints
        query = query.filter(Complaint.student_id == current_user.id)
    elif current_user.role == "department_head":
        # Department heads see complaints for their department
        if current_user.department_id:
            query = query.filter(Complaint.department_id == current_user.department_id)
        else:
            # Not assigned a department yet
            return []
            
    # Filters
    if status:
        query = query.filter(Complaint.status == status)
    if urgency:
        query = query.filter(Complaint.urgency == urgency)
    if category:
        query = query.filter(Complaint.category == category)
        
    # Search title and description
    if search:
        search_filter = or_(
            Complaint.title.ilike(f"%{search}%"),
            Complaint.description.ilike(f"%{search}%"),
            Complaint.location.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
        
    # Order by date desc
    return query.order_by(Complaint.created_at.desc()).all()

@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint_detail(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )
        
    # Check role-based permission
    if current_user.role == "student" and complaint.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this complaint."
        )
    elif current_user.role == "department_head" and complaint.department_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view complaints from other departments."
        )
        
    # Filter comments: students must NOT see internal administrative comments
    all_comments = complaint.comments
    if current_user.role == "student":
        complaint.comments = [c for c in all_comments if not c.is_internal]
        
    # Sort comments by creation date ascending
    complaint.comments = sorted(complaint.comments, key=lambda x: x.created_at)
        
    return complaint

@router.post("/{complaint_id}/comment", response_model=CommentOut)
def add_comment(
    complaint_id: str,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )
        
    # Standard check for students
    if current_user.role == "student":
        if complaint.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot post comments on other students' complaints."
            )
        if comment_in.is_internal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students cannot post internal administrative comments."
            )
            
    # Check for department heads
    if current_user.role == "department_head" and complaint.department_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot post comments on other departments' complaints."
        )
        
    new_comment = Comment(
        complaint_id=complaint.id,
        user_id=current_user.id,
        content=comment_in.content,
        is_internal=comment_in.is_internal,
        is_ai_generated=False
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    return new_comment

@router.patch("/{complaint_id}/status", response_model=ComplaintOut)
def update_complaint_status(
    complaint_id: str,
    update_in: ComplaintUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )
        
    # Department heads cannot update complaints from other departments
    if current_user.role == "department_head" and complaint.department_id != current_user.department_id:
        # Allow if it's currently unassigned (None), but they are claiming it for their department
        if complaint.department_id is not None or update_in.department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department heads can only manage complaints within their department."
            )
            
    changes = []
    
    if update_in.status and update_in.status != complaint.status:
        changes.append(f"status updated from '{complaint.status}' to '{update_in.status}'")
        complaint.status = update_in.status
        
    if update_in.urgency and update_in.urgency != complaint.urgency:
        changes.append(f"urgency adjusted from '{complaint.urgency}' to '{update_in.urgency}'")
        complaint.urgency = update_in.urgency
        
    if update_in.department_id is not None and update_in.department_id != complaint.department_id:
        dept = db.query(Department).filter(Department.id == update_in.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target department does not exist."
            )
        old_dept_name = complaint.department.name if complaint.department else "Unassigned"
        changes.append(f"assigned department changed from '{old_dept_name}' to '{dept.name}'")
        complaint.department_id = update_in.department_id
        
    if update_in.is_duplicate is not None:
        complaint.is_duplicate = update_in.is_duplicate
        changes.append(f"duplicate flag updated to {update_in.is_duplicate}")
        
    if update_in.duplicate_of_id is not None:
        if update_in.duplicate_of_id == complaint.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A complaint cannot be marked as duplicate of itself."
            )
        target = db.query(Complaint).filter(Complaint.id == update_in.duplicate_of_id).first()
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target duplicate complaint does not exist."
            )
        complaint.duplicate_of_id = update_in.duplicate_of_id
        complaint.is_duplicate = True
        changes.append(f"linked as duplicate of complaint: {target.title}")
        
    if changes:
        audit_trail = "; ".join(changes)
        system_comment = Comment(
            complaint_id=complaint.id,
            content=f"Administrative Action: {audit_trail} (Updated by {current_user.full_name}).",
            is_internal=False,
            is_ai_generated=False
        )
        db.add(system_comment)
        
    db.commit()
    db.refresh(complaint)
    return complaint
