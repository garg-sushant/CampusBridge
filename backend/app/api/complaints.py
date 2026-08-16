import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_student, require_staff
from app.models.base import Complaint, User, Department, Attachment, Comment
from app.schemas.complaints import ComplaintCreate, ComplaintOut, ComplaintListItem, CommentCreate, CommentOut, ComplaintUpdateStatus
from app.services.storage import save_uploaded_file
from app.services.email_service import dispatch_status_update_notification, dispatch_comment_notification


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

    from datetime import datetime, timezone

    # Enforce daily quota limit: max 5 issues per student email ID per day
    now_utc = datetime.now(timezone.utc)
    start_of_day = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    
    today_count = db.query(Complaint).filter(
        Complaint.student_id == current_user.id,
        Complaint.created_at >= start_of_day
    ).count()

    if today_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Daily Submission Limit Reached: Each student can submit a maximum of 5 grievances per day. You have reached your daily quota for today."
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
    
    # Trigger AI orchestration & routing
    from app.services.ai_agent import run_ai_orchestration
    from app.services.engine import run_integrity_assessment_pipeline
    import re

    run_ai_orchestration(new_complaint.id, db)
    db.refresh(new_complaint)
    
    # Run multi-agent integrity assessment
    assessment = run_integrity_assessment_pipeline(new_complaint.id, db)
    integrity_score = assessment.get("integrity_score", 100)
    
    # Audit for fake/spam, nonsense patterns, or Integrity Trust Rating < 30%
    title_desc = (new_complaint.title + " " + new_complaint.description).lower()
    nonsense_patterns = [r"^asdf", r"^xyz", r"^qwer", r"^test", r"^123", r"^\s*$"]
    is_nonsense = any(re.search(pattern, title_desc) for pattern in nonsense_patterns)
    is_too_short = len(new_complaint.description.strip()) < 15

    # 3-Tier Outcome:
    # 1. Below 30: Rejected as spam / mock / fake
    if new_complaint.status == "rejected" or integrity_score < 30 or is_nonsense or is_too_short:
        db.delete(new_complaint)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submission Rejected: Fake, randomly written, or low-integrity issue detected by AI Credibility Auditor (Integrity Rating: {integrity_score}% < 30%). Please provide a genuine, detailed campus grievance."
        )
    # 2. 30 to 60: Pending additional info/documents (email dispatched by engine)
    elif integrity_score < 60:
        new_complaint.status = "pending_info"
        db.commit()
        db.refresh(new_complaint)
    # 3. 60 and above: Accepted and verified directly
    else:
        new_complaint.status = "verified"
        db.commit()
        db.refresh(new_complaint)
    
    return new_complaint


@router.post("/{complaint_id}/provide-info", response_model=ComplaintOut)
def provide_additional_info(
    complaint_id: str,
    additional_info: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found."
        )

    # Only the student who submitted the complaint or admin can provide info
    if current_user.role == "student" and complaint.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to provide info for this grievance."
        )

    # Strictly check that the complaint is in the 30-60 range (pending_info)
    if complaint.status != "pending_info":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Additional information can only be submitted for grievances currently marked as 'pending_info' (30-60 score range)."
        )

    if (not additional_info or not additional_info.strip()) and (not file or not file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide text details or upload a file as requested by the AI."
        )

    # 1. Append additional info text if provided
    if additional_info and additional_info.strip():
        complaint.description = f"{complaint.description}\n\n[Additional Information Provided by Student]:\n{additional_info.strip()}"
        db.add(Comment(
            complaint_id=complaint.id,
            user_id=current_user.id,
            content=f"Student Provided Requested Information:\n{additional_info.strip()}",
            is_internal=False,
            is_ai_generated=False
        ))

    # 2. Attach and verify uploaded file if provided
    if file and file.filename:
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
        db.flush()
        
        # Run AI evidence verification
        from app.services.ai_agent import run_ai_evidence_verification
        run_ai_evidence_verification(attachment.id, db)

    db.commit()
    db.refresh(complaint)

    # 3. Re-run multi-agent integrity assessment pipeline with the newly added info & documents
    from app.services.engine import run_integrity_assessment_pipeline
    assessment = run_integrity_assessment_pipeline(complaint.id, db)
    db.refresh(complaint)

    # 4. If upgraded to verified (>= 60), send status update notification
    if complaint.status == "verified" and current_user.email:
        try:
            dept_name = complaint.department.name if complaint.department else "Assigned Department"
            dispatch_status_update_notification(
                student_email=current_user.email,
                student_name=current_user.full_name,
                complaint_title=complaint.title,
                complaint_id=complaint.id,
                new_status="verified",
                updated_by="AI Governance Auditor",
                changes_summary=f"Additional evidence verified successfully. Grievance integrity rating is now {assessment.get('integrity_score', 60)}/100 and routed to {dept_name}."
            )
        except Exception as e:
            print(f"Failed to dispatch verification email: {e}")

    return complaint



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
        

    
    # Return updated list of complaints
    if current_user.role == "student":
        query = db.query(Complaint).filter(Complaint.student_id == current_user.id)
    elif current_user.role == "department_head":
        dept_name = current_user.department.name if current_user.department else ""
        query = db.query(Complaint).filter(
            or_(
                Complaint.department_id == current_user.department_id,
                Complaint.category == dept_name
            )
        )
    else:
        query = db.query(Complaint)
    return query.all()

@router.get("/", response_model=List[ComplaintListItem])
def list_complaints(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    category: Optional[str] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint)
    
    # Apply role-based filtration
    if current_user.role == "admin":
        # Admin / Dean sees everything, no filtration applied
        pass
    elif current_user.role == "department_head":
        # Department heads see complaints for their department/category
        if current_user.department_id:
            dept_name = current_user.department.name if current_user.department else ""
            query = query.filter(
                or_(
                    Complaint.department_id == current_user.department_id,
                    Complaint.category == dept_name
                )
            )
        else:
            # Not assigned a department yet
            return []
    else:
        # Secure by default: students and unrecognized roles can only see their own complaints
        query = query.filter(Complaint.student_id == current_user.id)
            
    # Filters
    if status:
        query = query.filter(Complaint.status == status)
    if urgency:
        query = query.filter(Complaint.urgency == urgency)
    if category:
        query = query.filter(Complaint.category == category)
    if department_id:
        query = query.filter(Complaint.department_id == department_id)
        
    # Outer join Department and Student User for comprehensive search capability
    query = query.outerjoin(Department, Complaint.department_id == Department.id).outerjoin(User, Complaint.student_id == User.id)

    # Search title, description, category, location, student name, department name
    if search:
        search_clean = search.strip()
        search_pattern = f"%{search_clean}%"
        
        # If searching by category string with slashes (e.g. "WiFi/IT Services" or "Water & Sanitation")
        # Split tokens for multi-keyword fuzzy matching
        tokens = search_clean.replace('/', ' ').replace('&', ' ').split()
        token_filters = []
        for t in tokens:
            if len(t) > 1:
                tp = f"%{t}%"
                token_filters.append(
                    or_(
                        Complaint.title.ilike(tp),
                        Complaint.description.ilike(tp),
                        Complaint.category.ilike(tp),
                        Complaint.location.ilike(tp),
                        Complaint.urgency.ilike(tp),
                        Complaint.status.ilike(tp),
                        Department.name.ilike(tp),
                        User.full_name.ilike(tp),
                    )
                )

        primary_filter = or_(
            Complaint.title.ilike(search_pattern),
            Complaint.description.ilike(search_pattern),
            Complaint.category.ilike(search_pattern),
            Complaint.location.ilike(search_pattern),
            Complaint.urgency.ilike(search_pattern),
            Complaint.status.ilike(search_pattern),
            Department.name.ilike(search_pattern),
            User.full_name.ilike(search_pattern),
        )

        if token_filters:
            query = query.filter(or_(primary_filter, and_(*token_filters)))
        else:
            query = query.filter(primary_filter)
        
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
    elif current_user.role == "department_head":
        dept_name = current_user.department.name if current_user.department else ""
        if complaint.department_id != current_user.department_id and complaint.category != dept_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view complaints from other departments."
            )
        
    # Filter comments: 
    # - Students must NOT see internal administrative comments
    # - Deans (admin) must NOT see private notes written by department heads
    all_comments = complaint.comments
    if current_user.role == "student":
        complaint.comments = [c for c in all_comments if not c.is_internal]
    elif current_user.role == "admin":
        complaint.comments = [
            c for c in all_comments 
            if not (c.is_internal and c.user and c.user.role == "department_head")
        ]
        
    # Sort comments by creation date ascending
    complaint.comments = sorted(complaint.comments, key=lambda x: x.created_at)
        
    return complaint

@router.post("/{complaint_id}/comment", response_model=CommentOut)
def add_comment(
    complaint_id: str,
    comment_in: CommentCreate,
    background_tasks: BackgroundTasks,
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
    if current_user.role == "department_head":
        dept_name = current_user.department.name if current_user.department else ""
        dept_code = current_user.department.code if current_user.department else ""
        matches_dept = (
            (complaint.department_id is not None and complaint.department_id == current_user.department_id) or
            (bool(complaint.category) and complaint.category in [dept_name, dept_code]) or
            complaint.department_id is None
        )
        if not matches_dept:
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

    # Real-time Email Notification Dispatcher
    if not comment_in.is_internal and current_user.role != "student" and complaint.student:
        background_tasks.add_task(
            dispatch_comment_notification,
            recipient_email=complaint.student.email,
            recipient_name=complaint.student.full_name,
            complaint_title=complaint.title,
            comment_author=current_user.full_name,
            comment_content=comment_in.content
        )

    return new_comment

@router.patch("/{complaint_id}/status", response_model=ComplaintOut)
def update_complaint_status(
    complaint_id: str,
    update_in: ComplaintUpdateStatus,
    background_tasks: BackgroundTasks,
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
    if current_user.role == "department_head":
        dept_name = current_user.department.name if current_user.department else ""
        dept_code = current_user.department.code if current_user.department else ""
        matches_dept = (
            (complaint.department_id is not None and complaint.department_id == current_user.department_id) or
            (bool(complaint.category) and complaint.category in [dept_name, dept_code])
        )
        if not matches_dept:
            # Allow if it's currently unassigned (None), but they are claiming it for their department
            if complaint.department_id is not None or update_in.department_id != current_user.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Department heads can only manage complaints within their department."
                )
            
    changes = []
    user_friendly_sentences = []
    old_status = complaint.status
    
    if update_in.status and update_in.status != complaint.status:
        formatted_status = update_in.status.replace('_', ' ').title()
        changes.append(f"Status updated to '{formatted_status}'")
        if update_in.status == "resolved":
            user_friendly_sentences.append(f"Your grievance has been marked as Resolved by {current_user.full_name}.")
        elif update_in.status == "in_progress":
            user_friendly_sentences.append(f"Your grievance is now under active work by {current_user.full_name}.")
        elif update_in.status == "rejected":
            user_friendly_sentences.append(f"Your grievance was reviewed and marked as Rejected by {current_user.full_name}.")
        else:
            user_friendly_sentences.append(f"Status updated to {formatted_status} by {current_user.full_name}.")
        complaint.status = update_in.status
        
    if update_in.urgency and update_in.urgency != complaint.urgency:
        formatted_urgency = update_in.urgency.replace('_', ' ').title()
        changes.append(f"Urgency updated to '{formatted_urgency}'")
        user_friendly_sentences.append(f"Priority level adjusted to {formatted_urgency} by {current_user.full_name}.")
        complaint.urgency = update_in.urgency
        
    if update_in.department_id is not None and update_in.department_id != complaint.department_id:
        dept = db.query(Department).filter(Department.id == update_in.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target department does not exist."
            )
        changes.append(f"Assigned to '{dept.name}'")
        user_friendly_sentences.append(f"Grievance assigned to {dept.name} by {current_user.full_name}.")
        complaint.department_id = update_in.department_id
        
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
        changes.append(f"Linked to related grievance: {target.title}")
        user_friendly_sentences.append(f"Linked to existing case: '{target.title}'.")
    elif update_in.is_duplicate is False and complaint.is_duplicate:
        complaint.is_duplicate = False
        
    if user_friendly_sentences:
        friendly_message = " ".join(user_friendly_sentences)
        system_comment = Comment(
            complaint_id=complaint.id,
            content=f"Official Update: {friendly_message}",
            is_internal=False,
            is_ai_generated=False
        )
        db.add(system_comment)

        # Dispatch real-time email to student's Gmail/Email in background
        if complaint.student:
            background_tasks.add_task(
                dispatch_status_update_notification,
                student_email=complaint.student.email,
                student_name=complaint.student.full_name,
                complaint_title=complaint.title,
                complaint_id=complaint.id,
                new_status=complaint.status,
                updated_by=current_user.full_name,
                changes_summary=friendly_message
            )
        
    db.commit()
    db.refresh(complaint)
    return complaint


