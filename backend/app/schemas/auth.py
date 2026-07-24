from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: str = "student"  # student, admin, department_head
    department_id: Optional[int] = None

class UserOut(UserBase):
    id: int
    role: str
    department_id: Optional[int] = None
    trust_score: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class GoogleLoginRequest(BaseModel):
    email: EmailStr
    id_token: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = "student"
    department_id: Optional[int] = None


