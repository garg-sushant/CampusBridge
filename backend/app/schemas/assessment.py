from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime

# Input Schema for Grievance Submission
class ComplaintSubmit(BaseModel):
    title: str = Field(..., min_length=5, max_length=255, json_schema_extra={"example": "Water leakage in Canteen mess area"})
    description: str = Field(..., min_length=15, json_schema_extra={"example": "Continuous dripping ceiling leakage is causing slippery floors..."})
    category: str = Field(..., json_schema_extra={"example": "Water & Sanitation"})
    location: str = Field(..., json_schema_extra={"example": "Ground Floor Restroom"})
    attachments: Optional[List[str]] = Field(default=[], description="List of visual/document file URLs")

# Structured JSON response templates parsed from Grok API
class EvidenceAgentOutput(BaseModel):
    evidence_score: int = Field(..., ge=0, le=100)
    evidence_quality: str = Field(..., pattern="^(poor|average|good)$")
    relevance_score: int = Field(..., ge=0, le=100)
    reasoning: List[str]

class QualityAgentOutput(BaseModel):
    quality_score: int = Field(..., ge=0, le=100)
    missing_information: List[str]
    reasoning: List[str]

class SeverityAgentOutput(BaseModel):
    severity: str = Field(..., pattern="^(Critical|High|Medium|Low)$")
    confidence: int = Field(..., ge=0, le=100)
    reasoning: List[str]

# Evaluated Results Summary Schema
class AssessmentDetail(BaseModel):
    complaint_id: str
    integrity_score: int
    severity: str
    decision: str
    confidence: int
    reasoning: List[str]
    evaluated_at: datetime

# Audit Trail item representation
class AuditTrailOut(BaseModel):
    id: int
    complaint_id: str
    action: str
    actor: str
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

