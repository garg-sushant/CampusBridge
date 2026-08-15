from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.auth import UserOut
from app.schemas.departments import DepartmentOut

class AttachmentOut(BaseModel):
    id: int
    complaint_id: str
    file_url: str
    file_type: str
    ai_verification_status: str
    ai_verification_explanation: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CommentCreate(BaseModel):
    content: str
    is_internal: bool = False

class CommentOut(BaseModel):
    id: int
    complaint_id: str
    content: str
    is_internal: bool
    is_ai_generated: bool
    created_at: datetime
    user: Optional[UserOut] = None

    model_config = ConfigDict(from_attributes=True)

class ComplaintBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    category: str = Field(..., max_length=100)
    location: str = Field(..., max_length=255)

class ComplaintCreate(ComplaintBase):
    pass

class ComplaintUpdateStatus(BaseModel):
    status: Optional[str] = None
    department_id: Optional[int] = None
    urgency: Optional[str] = None
    is_duplicate: Optional[bool] = None
    duplicate_of_id: Optional[str] = None

class ComplaintOut(ComplaintBase):
    id: str
    student_id: int
    status: str
    urgency: str
    department_id: Optional[int] = None
    info_requested: Optional[str] = None
    is_duplicate: bool
    duplicate_of_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    student: UserOut
    department: Optional[DepartmentOut] = None
    attachments: List[AttachmentOut] = []
    comments: List[CommentOut] = []

    model_config = ConfigDict(from_attributes=True)

class ComplaintListItem(ComplaintBase):
    id: str
    student_id: int
    status: str
    urgency: str
    department_id: Optional[int] = None
    info_requested: Optional[str] = None
    is_duplicate: bool
    created_at: datetime
    updated_at: datetime
    student: UserOut
    department: Optional[DepartmentOut] = None
    attachments: List[AttachmentOut] = []

    model_config = ConfigDict(from_attributes=True)

