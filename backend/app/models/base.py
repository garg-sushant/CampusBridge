import uuid
from sqlalchemy import TypeDecorator, Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import timezone
from app.core.database import Base

class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
        return value


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")  # student, admin, department_head
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    trust_score = Column(Float, nullable=False, default=100.0)
    created_at = Column(UTCDateTime(), server_default=func.now())

    # Relationships
    department = relationship("Department", back_populates="members", foreign_keys=[department_id])
    complaints = relationship("Complaint", back_populates="student", foreign_keys="[Complaint.student_id]")
    comments = relationship("Comment", back_populates="user")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(UTCDateTime(), server_default=func.now())

    # Relationships
    members = relationship("User", back_populates="department", foreign_keys="[User.department_id]")
    complaints = relationship("Complaint", back_populates="department", foreign_keys="[Complaint.department_id]")

class Complaint(Base):
    __tablename__ = "complaints"

    # UUID primary key that supports SQLite (stored as string) or Postgres (stored as UUID)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(100), nullable=False)  # WiFi, Electricity, Canteen, etc.
    status = Column(String(50), nullable=False, default="submitted")  # submitted, verified, assigned, in_progress, resolved, rejected
    urgency = Column(String(50), nullable=False, default="medium")  # low, medium, high, critical
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    location = Column(String(255), nullable=False)
    is_duplicate = Column(Boolean, nullable=False, default=False)
    duplicate_of_id = Column(String(36), ForeignKey("complaints.id"), nullable=True)
    created_at = Column(UTCDateTime(), server_default=func.now())
    updated_at = Column(UTCDateTime(), server_default=func.now(), onupdate=func.now())

    # Relationships
    student = relationship("User", back_populates="complaints", foreign_keys=[student_id])
    department = relationship("Department", back_populates="complaints", foreign_keys=[department_id])
    attachments = relationship("Attachment", back_populates="complaint", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="complaint", cascade="all, delete-orphan")
    
    # Self-referential relationship for duplicates
    duplicate_of = relationship("Complaint", remote_side=[id], backref="duplicates")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    file_url = Column(String(512), nullable=False)
    file_type = Column(String(100), nullable=False)
    ai_verification_status = Column(String(50), nullable=False, default="pending")  # pending, verified, rejected, skipped
    ai_verification_explanation = Column(Text, nullable=True)
    created_at = Column(UTCDateTime(), server_default=func.now())

    # Relationships
    complaint = relationship("Complaint", back_populates="attachments")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null if system/AI comment
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False)
    is_ai_generated = Column(Boolean, nullable=False, default=False)
    created_at = Column(UTCDateTime(), server_default=func.now())

    # Relationships
    complaint = relationship("Complaint", back_populates="comments")
    user = relationship("User", back_populates="comments")
