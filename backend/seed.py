import sys
import os

# Align python path to backend root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.base import User, Department, Complaint, Comment

def seed_database():
    print("Initialising database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if seeding is already done
        if db.query(Department).first():
            print("Database already has records, skipping seed.")
            return
            
        print("Seeding campus departments...")
        departments_data = [
            {"name": "Hostel Administration", "code": "HOSTEL"},
            {"name": "WiFi/IT Services", "code": "IT"},
            {"name": "Electrical Maintenance", "code": "ELECTRICAL"},
            {"name": "Water & Sanitation", "code": "WATER"},
            {"name": "Transport Department", "code": "TRANSPORT"},
            {"name": "Finance/Scholarship Cell", "code": "FINANCE"},
            {"name": "Academic Administration", "code": "ACADEMIC"},
            {"name": "Canteen Management", "code": "CANTEEN"},
            {"name": "Library Management", "code": "LIBRARY"}
        ]
        
        depts = {}
        for dept in departments_data:
            d = Department(name=dept["name"], code=dept["code"])
            db.add(d)
            db.flush()  # Populates ID
            depts[dept["code"]] = d
            
        print("Seeding campus users...")
        # Admin
        admin_user = User(
            email="admin@campus.edu",
            hashed_password=get_password_hash("adminpassword"),
            full_name="Dean of Campus Governance",
            role="admin",
            trust_score=100.0
        )
        db.add(admin_user)
        
        # Department heads
        it_head = User(
            email="ithead@campus.edu",
            hashed_password=get_password_hash("itpassword"),
            full_name="Prof. Rajesh Sharma (IT Head)",
            role="department_head",
            department_id=depts["IT"].id,
            trust_score=100.0
        )
        db.add(it_head)
        
        hostel_head = User(
            email="hostelhead@campus.edu",
            hashed_password=get_password_hash("hostelpassword"),
            full_name="Dr. Sunita Rao (Hostel Warden)",
            role="department_head",
            department_id=depts["HOSTEL"].id,
            trust_score=100.0
        )
        db.add(hostel_head)
        
        # Students
        student_1 = User(
            email="student@campus.edu",
            hashed_password=get_password_hash("studentpassword"),
            full_name="Amit Patel",
            role="student",
            trust_score=100.0
        )
        db.add(student_1)
        
        student_2 = User(
            email="student2@campus.edu",
            hashed_password=get_password_hash("studentpassword"),
            full_name="Priya Nair",
            role="student",
            trust_score=95.0
        )
        db.add(student_2)
        
        db.flush()
        
        print("Seeding default campus complaints...")
        # WiFi Complaint
        wifi_complaint = Complaint(
            title="WiFi in Hostel Block B has not been working for 3 days",
            description="Since Monday night, the IT-Guest and IT-Student networks in Block B (2nd floor) are constantly dropping connections. Cannot access study materials or submit assignments.",
            student_id=student_1.id,
            category="WiFi/IT Services",
            status="submitted",
            urgency="medium",
            location="Hostel Block B, Floor 2"
        )
        db.add(wifi_complaint)
        db.flush()
        
        comment_wifi = Comment(
            complaint_id=wifi_complaint.id,
            content="Grievance filed successfully by Amit Patel.",
            is_internal=False,
            is_ai_generated=False
        )
        db.add(comment_wifi)
        
        # Water Leakage Complaint
        water_complaint = Complaint(
            title="Severe water leakage from ceiling in Mess restroom",
            description="There is continuous water leakage near the central canteens restrooms on the ground floor. It has created a slippery surface and risks causing structural damage or accidents.",
            student_id=student_2.id,
            category="Water & Sanitation",
            status="assigned",
            urgency="high",
            department_id=depts["WATER"].id,
            location="Central Canteen, Ground Floor restroom"
        )
        db.add(water_complaint)
        db.flush()
        
        comment_water_1 = Comment(
            complaint_id=water_complaint.id,
            content="Grievance filed successfully by Priya Nair.",
            is_internal=False,
            is_ai_generated=False
        )
        comment_water_2 = Comment(
            complaint_id=water_complaint.id,
            content="Administrative Action: assigned department to 'Water & Sanitation' (Updated by Dean of Campus Governance).",
            is_internal=False,
            is_ai_generated=False
        )
        comment_water_3 = Comment(
            complaint_id=water_complaint.id,
            content="Internal Note: Plumber team dispatched to inspect. Ceiling plaster looks weak.",
            is_internal=True,
            is_ai_generated=False,
            user_id=admin_user.id
        )
        db.add(comment_water_1)
        db.add(comment_water_2)
        db.add(comment_water_3)
        
        # Electricity Complaint
        elec_complaint = Complaint(
            title="Classroom 402 AC units leaking water and tripping power",
            description="The air conditioners in lecture hall 402 are making loud grinding noises and tripping the circuit breaker whenever set below 24 degrees.",
            student_id=student_1.id,
            category="Electrical Maintenance",
            status="in_progress",
            urgency="high",
            department_id=depts["ELECTRICAL"].id,
            location="Academic Block 2, Room 402"
        )
        db.add(elec_complaint)
        db.flush()
        
        comment_elec_1 = Comment(
            complaint_id=elec_complaint.id,
            content="Grievance filed successfully by Amit Patel.",
            is_internal=False,
            is_ai_generated=False
        )
        comment_elec_2 = Comment(
            complaint_id=elec_complaint.id,
            content="Administrative Action: assigned department to 'Electrical Maintenance' (Updated by Dean of Campus Governance).",
            is_internal=False,
            is_ai_generated=False
        )
        comment_elec_3 = Comment(
            complaint_id=elec_complaint.id,
            content="Technician has started repairing the compressor. Parts ordered.",
            is_internal=False,
            is_ai_generated=False,
            user_id=admin_user.id
        )
        db.add(comment_elec_1)
        db.add(comment_elec_2)
        db.add(comment_elec_3)
        
        db.commit()
        print("Database seeded successfully with test records.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
