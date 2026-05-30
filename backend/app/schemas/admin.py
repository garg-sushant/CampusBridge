from pydantic import BaseModel
from typing import Dict, List

class DepartmentStats(BaseModel):
    department_name: str
    count: int

class UrgencyStats(BaseModel):
    urgency: str
    count: int

class CategoryStats(BaseModel):
    category: str
    count: int

class AdminDashboardStats(BaseModel):
    total_complaints: int
    active_complaints: int
    resolved_complaints: int
    resolution_rate: float  # Percentage of resolved vs total
    duplicate_count: int
    fake_count: int
    department_distribution: List[DepartmentStats]
    urgency_distribution: List[UrgencyStats]
    category_distribution: List[CategoryStats]
