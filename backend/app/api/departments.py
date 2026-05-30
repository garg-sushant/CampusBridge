from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.models.base import Department, User
from app.schemas.departments import DepartmentCreate, DepartmentOut

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("/", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_in: DepartmentCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Check if duplicate name or code
    existing_name = db.query(Department).filter(Department.name == dept_in.name).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with name '{dept_in.name}' already exists."
        )
    existing_code = db.query(Department).filter(Department.code == dept_in.code).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{dept_in.code}' already exists."
        )
        
    new_dept = Department(name=dept_in.name, code=dept_in.code)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept
