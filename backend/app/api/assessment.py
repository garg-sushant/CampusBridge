from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.base import User, Complaint, Attachment, DecisionLog, AuditTrail
from app.schemas.assessment import ComplaintSubmit, AssessmentDetail, AuditTrailOut
from app.services.engine import run_integrity_assessment_pipeline

router = APIRouter(prefix="/assessment", tags=["AI Assessment & Auditing"])

@router.post("/submit", response_model=AssessmentDetail, status_code=status.HTTP_201_CREATED)
def submit_complaint(
    payload: ComplaintSubmit, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Submits a new campus grievance and automatically triggers the AI multi-agent evaluation pipeline.
    """
    # 1. Check permissions - only student and admin can submit complaints
    if current_user.role not in ["student", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students and administrators can submit complaints."
        )

    from datetime import datetime, timezone
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

    # 2. Persist the metadata of the complaint
    new_complaint = Complaint(
        title=payload.title,
        description=payload.description,
        student_id=current_user.id,
        category=payload.category,
        location=payload.location,
        status="submitted"
    )

    db.add(new_complaint)
    db.flush()  # Populates ID
    
    # 3. Persist the evidence file attachments if uploaded
    if payload.attachments:
        for file_url in payload.attachments:
            db.add(Attachment(
                complaint_id=new_complaint.id, 
                file_url=file_url, 
                file_type="image/jpeg",
                ai_verification_status="pending"
            ))
            
    db.commit()
    
    # 4. Automatically trigger the AI evaluation pipeline
    try:
        assessment_res = run_integrity_assessment_pipeline(new_complaint.id, db)
        db.refresh(new_complaint)
        if new_complaint.status == "rejected" or assessment_res.get("integrity_score", 100) < 40:
            db.delete(new_complaint)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Submission Rejected: Fake, randomly written, or low-integrity issue detected by AI Credibility Auditor (Integrity Rating < 40%). Please provide a genuine, detailed campus grievance."
            )
        return assessment_res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Complaint created but AI assessment engine failed: {str(e)}"
        )


@router.post("/{id}/evaluate", response_model=AssessmentDetail)
def re_evaluate_complaint(
    id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually triggers re-evaluation of a specific grievance report (e.g. after review or evidence update).
    """
    complaint = db.query(Complaint).filter(Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        
    try:
        return run_integrity_assessment_pipeline(complaint.id, db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{id}/assessment", response_model=AssessmentDetail)
def get_complaint_assessment(
    id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the sealed AI and deterministic decision logs for a specific grievance.
    """
    log = db.query(DecisionLog).filter(DecisionLog.complaint_id == id).order_by(DecisionLog.created_at.desc()).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment log not found for this complaint.")
        
    return {
        "complaint_id": log.complaint_id,
        "integrity_score": log.integrity_score,
        "severity": log.severity_level,
        "decision": log.decision,
        "confidence": log.confidence,
        "reasoning": log.reasoning_summary.split("\n"),
        "evaluated_at": log.created_at
    }

@router.get("/{id}/audit-trail", response_model=List[AuditTrailOut])
def get_complaint_audit_trail(
    id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the chronological, tamper-proof audit trails for safety and transparency checks.
    """
    trails = db.query(AuditTrail).filter(AuditTrail.complaint_id == id).order_by(AuditTrail.created_at.asc()).all()
    return trails
