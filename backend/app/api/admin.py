from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List
from app.core.database import get_db
from app.core.security import require_staff, get_current_user
from app.models.base import Complaint, Department, User
from app.schemas.admin import AdminDashboardStats, DepartmentStats, UrgencyStats, CategoryStats

router = APIRouter(prefix="/admin", tags=["Admin Portal"])

@router.get("/stats", response_model=AdminDashboardStats)
def get_dashboard_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    # Base queries
    complaint_query = db.query(Complaint)
    
    # If department head, restrict complaint queries to their assigned department or category name
    if current_user.role == "department_head":
        if current_user.department_id:
            dept_name = current_user.department.name if current_user.department else ""
            complaint_query = complaint_query.filter(
                or_(
                    Complaint.department_id == current_user.department_id,
                    Complaint.category == dept_name
                )
            )
        else:
            complaint_query = complaint_query.filter(Complaint.id == "none")
        
    # Total count
    total_complaints = complaint_query.count()
    
    # Active complaints (everything except resolved and rejected)
    active_complaints = complaint_query.filter(
        Complaint.status.in_(["submitted", "verified", "assigned", "in_progress"])
    ).count()
    
    # Resolved complaints
    resolved_complaints = complaint_query.filter(Complaint.status == "resolved").count()
    
    # Resolution Rate
    resolution_rate = 0.0
    if total_complaints > 0:
        resolution_rate = round((resolved_complaints / total_complaints) * 100, 2)
        
    # Duplicate and Fake count
    duplicate_count = complaint_query.filter(Complaint.is_duplicate == True).count()
    
    # A rejected complaint is treated as a spam/fake complaint
    fake_count = complaint_query.filter(Complaint.status == "rejected").count()
    
    # Department Distribution
    dept_query = db.query(
        Department.name, 
        func.count(Complaint.id)
    ).join(
        Complaint, 
        Complaint.department_id == Department.id, 
        isouter=True
    )
    if current_user.role == "department_head":
        if current_user.department_id:
            dept_query = dept_query.filter(Department.id == current_user.department_id)
        else:
            dept_query = dept_query.filter(Department.id == -1)
        
    dept_distribution_raw = dept_query.group_by(Department.name).all()
    
    dept_distribution = [
        DepartmentStats(department_name=name, count=count) 
        for name, count in dept_distribution_raw
    ]
    
    # Urgency Distribution
    urgency_query = db.query(
        Complaint.urgency, 
        func.count(Complaint.id)
    )
    if current_user.role == "department_head":
        if current_user.department_id:
            dept_name = current_user.department.name if current_user.department else ""
            urgency_query = urgency_query.filter(
                or_(
                    Complaint.department_id == current_user.department_id,
                    Complaint.category == dept_name
                )
            )
        else:
            urgency_query = urgency_query.filter(Complaint.id == "none")
    urgency_distribution_raw = urgency_query.group_by(Complaint.urgency).all()
    
    urgency_distribution = [
        UrgencyStats(urgency=urgency, count=count) 
        for urgency, count in urgency_distribution_raw
    ]
    
    # Category Distribution
    category_query = db.query(
        Complaint.category, 
        func.count(Complaint.id)
    )
    if current_user.role == "department_head":
        if current_user.department_id:
            dept_name = current_user.department.name if current_user.department else ""
            category_query = category_query.filter(
                or_(
                    Complaint.department_id == current_user.department_id,
                    Complaint.category == dept_name
                )
            )
        else:
            category_query = category_query.filter(Complaint.id == "none")
    category_distribution_raw = category_query.group_by(Complaint.category).all()
    
    category_distribution = [
        CategoryStats(category=cat, count=count) 
        for cat, count in category_distribution_raw
    ]
    
    return AdminDashboardStats(
        total_complaints=total_complaints,
        active_complaints=active_complaints,
        resolved_complaints=resolved_complaints,
        resolution_rate=resolution_rate,
        duplicate_count=duplicate_count,
        fake_count=fake_count,
        department_distribution=dept_distribution,
        urgency_distribution=urgency_distribution,
        category_distribution=category_distribution
    )
