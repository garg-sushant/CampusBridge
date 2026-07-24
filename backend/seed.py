import sys
import os
import argparse
import random

# Align python path to backend root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.base import User, Department, Complaint, Comment, Attachment, AuditTrail, DecisionLog, TrustScoreHistory


def seed_database(reset: bool = False):
    print("Initialising database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        if reset:
            print("Resetting existing database tables...")
            db.query(Attachment).delete()
            db.query(Comment).delete()
            db.query(AuditTrail).delete()
            db.query(DecisionLog).delete()
            db.query(TrustScoreHistory).delete()
            db.query(Complaint).delete()
            db.query(User).delete()
            db.query(Department).delete()
            db.commit()
            print("Cleared existing records.")
        elif db.query(Department).first():
            print("Database already contains data. Clearing and re-seeding full fresh dataset...")
            db.query(Attachment).delete()
            db.query(Comment).delete()
            db.query(AuditTrail).delete()
            db.query(DecisionLog).delete()
            db.query(TrustScoreHistory).delete()
            db.query(Complaint).delete()
            db.query(User).delete()
            db.query(Department).delete()
            db.commit()
            print("Cleared existing records.")

            db.query(TrustScoreHistory).delete()
            db.query(Complaint).delete()
            db.query(User).delete()
            db.query(Department).delete()
            db.commit()

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
            db.flush()
            depts[dept["code"]] = d

        print("Seeding campus users (Admin, Department Heads, Students)...")
        # Admin User
        admin_user = User(
            email="admin@campus.edu",
            hashed_password=get_password_hash("adminpassword"),
            full_name="Dean of Campus Governance",
            role="admin",
            trust_score=100.0
        )
        db.add(admin_user)

        # Department Heads for all departments
        dept_heads_data = [
            {"email": "hostelhead@campus.edu", "pass": "hostelpassword", "name": "Dr. Sunita Rao (Hostel Warden)", "dept": "HOSTEL"},
            {"email": "ithead@campus.edu", "pass": "itpassword", "name": "Prof. Rajesh Sharma (IT Head)", "dept": "IT"},
            {"email": "electricalhead@campus.edu", "pass": "electricalpassword", "name": "Eng. Vikram Singh (Electrical Head)", "dept": "ELECTRICAL"},
            {"email": "waterhead@campus.edu", "pass": "waterpassword", "name": "Dr. Ananya Roy (Sanitation Officer)", "dept": "WATER"},
            {"email": "transporthead@campus.edu", "pass": "transportpassword", "name": "Mr. Ramesh Kumar (Transport Incharge)", "dept": "TRANSPORT"},
            {"email": "financehead@campus.edu", "pass": "financepassword", "name": "Ms. Meena Gupta (Finance Officer)", "dept": "FINANCE"},
            {"email": "academichead@campus.edu", "pass": "academicpassword", "name": "Prof. K. V. Subramanian (Academic Dean)", "dept": "ACADEMIC"},
            {"email": "canteenhead@campus.edu", "pass": "canteenpassword", "name": "Chef Suresh Verma (Mess Manager)", "dept": "CANTEEN"},
            {"email": "libraryhead@campus.edu", "pass": "librarypassword", "name": "Dr. Pratibha Joshi (Chief Librarian)", "dept": "LIBRARY"},
        ]

        dept_head_users = {}
        for dh in dept_heads_data:
            user = User(
                email=dh["email"],
                hashed_password=get_password_hash(dh["pass"]),
                full_name=dh["name"],
                role="department_head",
                department_id=depts[dh["dept"]].id,
                trust_score=100.0
            )
            db.add(user)
            db.flush()
            dept_head_users[dh["dept"]] = user

        # Student Users (20 students for realistic distribution)
        student_names = [
            "Amit Patel", "Priya Nair", "Rohan Deshmukh", "Sneha Reddy", "Kavya Sen",
            "Arjun Mehta", "Ananya Sharma", "Rahul Verma", "Neha Gupta", "Vikram Joshi",
            "Divya Rao", "Siddharth Malhotra", "Pooja Hegde", "Aditya Roy", "Isha Kapoor",
            "Manish Kumar", "Ritu Singh", "Karan Johar", "Tarun Saxena", "Shreya Ghoshal"
        ]

        students = []
        for i, name in enumerate(student_names):
            email = f"student{i+1}@campus.edu" if i > 0 else "student@campus.edu"
            u = User(
                email=email,
                hashed_password=get_password_hash("studentpassword"),
                full_name=name,
                role="student",
                trust_score=round(random.uniform(85.0, 100.0), 1)
            )
            db.add(u)
            db.flush()
            students.append(u)

        print("Seeding ~85 comprehensive complaints across all 9 departments...")

        # Raw Complaint Data categorized by department code
        raw_complaints = {
            "HOSTEL": [
                ("Elevator A door safety sensor failing in Girls Hostel 3", "Elevator A door closes forcefully without sensing objects, causing risk of physical injury.", "critical", "in_progress", "Girls Hostel 3, Elevator A"),
                ("Water heater element burned out in Block C washrooms", "Geyser heating coils broken on 2nd floor washrooms. No hot water available in morning.", "medium", "assigned", "Hostel Block C, Floor 2"),
                ("Broken window latch allowing cold wind in Room 314", "Window frame latch mechanism snapped off during storm, causing rain and cold draft inside room.", "low", "resolved", "Hostel Block A, Room 314"),
                ("Missing mattress replacement in Room 108, Boys Hostel 2", "Student assigned room with torn mattress. Requesting replacement mattress.", "low", "submitted", "Boys Hostel 2, Room 108"),
                ("Noisy exhaust fans in Hostel Mess kitchen causing sleep disturbance", "Exhaust blower fan rattling continuously past midnight above ground floor rooms.", "medium", "assigned", "Hostel Mess Ground Floor"),
                ("Stray dog pack roaming near Hostel 4 entrance at night", "Pack of stray dogs barking aggressively at students entering hostel past 10 PM.", "high", "in_progress", "Boys Hostel 4 Gate"),
                ("Pest control needed for bed bugs in Hostel Block D Room 204", "Persistent bed bug infestation despite basic sprays. Requesting professional fumigation.", "high", "assigned", "Hostel Block D, Room 204"),
                ("Broken study desk chair in Hostel 1 Room 512", "Wooden study chair backrest snapped. Need replacement desk furniture.", "low", "resolved", "Boys Hostel 1, Room 512"),
                ("Laundry room washing machine #3 drain clogged", "Washing machine #3 overflows soapy water onto floor during spin cycle.", "medium", "resolved", "Hostel Block B Laundry Facility")
            ],
            "IT": [
                ("WiFi in Hostel Block B disconnected for 3 days", "Since Monday night, the IT-Guest and IT-Student networks in Block B are dropping connections.", "medium", "submitted", "Hostel Block B, Floor 2"),
                ("Projector HDMI port damaged in Main Auditorium B", "Main projector display port displays blue lines when connected to laptops during lectures.", "low", "resolved", "Main Auditorium B"),
                ("High latency & packet loss on WiFi network in Library", "Ping times exceeding 1200ms on Central Library 2nd floor WiFi access point.", "high", "in_progress", "Central Library 2nd Floor"),
                ("Ethernet wall jack port #2 dead in CS Lab 401", "Network port #2 provides no link signal for workstation machine.", "low", "assigned", "CS Building, Lab 401"),
                ("Portal login session timeout resetting student exam submissions", "Campus portal logs out users mid-quiz without auto-saving answer drafts.", "critical", "assigned", "Online Exam Portal"),
                ("VPN credentials for IEEE research journal database expired", "Off-campus proxy portal throwing 403 authorization error for enrolled M.Tech scholars.", "medium", "in_progress", "Digital Library Server"),
                ("Wireless router in Academic Block 1 broadcasting low signal", "Router AP-104 dropping coverage in hall 102 during peak lecture hours.", "medium", "resolved", "Academic Block 1, Room 102"),
                ("Smart Board touch calibration failure in Seminar Hall 2", "Interactive whiteboard touch input shifted 5 inches to the left.", "low", "resolved", "Seminar Hall 2"),
                ("Student Printing kiosk terminal offline in Student Center", "Card reader on self-service print station failing to deduct print credit.", "medium", "submitted", "Student Activity Center"),
                ("Lab computer #14 keyboard keys unresponsive", "Spacebar and Enter key stuck on Desktop station #14 in CAD Lab.", "low", "resolved", "Mechanical Engineering CAD Lab")
            ],
            "ELECTRICAL": [
                ("Classroom 402 AC units leaking water and tripping power", "Air conditioners in lecture hall 402 leaking water and tripping breaker when set below 24 degrees.", "high", "in_progress", "Academic Block 2, Room 402"),
                ("Power fluctuations tripping workstation GPUs in CS Lab 3", "Voltage drops cause deep learning workstations to reboot unexpectedly during lab sessions.", "high", "resolved", "CS Dept, Computer Lab 3"),
                ("Streetlight pole #7 near South Gate entrance flickering continuously", "Main perimeter LED pole light strobing and going dark at night.", "low", "assigned", "South Gate Perimeter Road"),
                ("Exposed wiring bundle near Staircase B on Ground Floor", "Electrical conduit cover missing near ground floor stairwell. Live wires exposed.", "critical", "assigned", "Science Complex Staircase B"),
                ("Ceiling fan regulator broken in Room 201, Mechanical Block", "Fan stuck on highest speed setting causing excessive noise during class.", "low", "resolved", "Mechanical Block, Room 201"),
                ("Main circuit breaker trip in Biotech Research Lab", "Power failure in lab cold room storing temperature-sensitive reagent samples.", "critical", "in_progress", "Biotech Building, Lab 102"),
                ("Backup Generator auto-switch failure during campus power cut", "Diesel generator failed to auto-start during 30-minute blackout.", "high", "assigned", "Central Power Substation"),
                ("Emergency EXIT sign LED light dead in Science Complex", "Illuminated exit signage dark on 3rd floor corridor emergency route.", "low", "resolved", "Science Complex 3rd Floor"),
                ("Air conditioner remote sensors unresponsive in Faculty Cabin 12", "Split AC unable to regulate room temperature setting.", "low", "submitted", "Faculty Building 1, Cabin 12"),
                ("Socket overload sparking in Student Common Room 2", "Wall outlet sparking when microwave plug connected in common room.", "high", "assigned", "Hostel Common Room 2")
            ],
            "WATER": [
                ("Severe water leakage from ceiling in Mess restroom", "Continuous water leakage near central canteen restroom ceiling creating slippery floor.", "high", "assigned", "Central Canteen, Ground Floor"),
                ("Water cooler filter replacement overdue in Mechanical Building", "Drinking water dispenser tastes metallic and filter indicator light is red.", "medium", "in_progress", "Mechanical Building 2nd Floor"),
                ("Low water pressure on 4th floor washrooms of Boys Hostel 1", "Taps emitting very thin trickle of water during morning peak hours.", "medium", "submitted", "Boys Hostel 1, Floor 4"),
                ("Foul odor coming from main drainage pipe near Canteen courtyard", "Stagnant drainage water accumulating near outdoor dining tables.", "high", "in_progress", "Main Canteen Courtyard"),
                ("Broken tap handle leaking water continuously in Block B restroom", "Washbasin faucet handle broken off, wasting clean water continuously.", "low", "resolved", "Academic Block B 1st Floor"),
                ("Drinking water dispenser emitting rusty water in Sports Complex", "Water stream discolored brown after weekend shutdown.", "high", "assigned", "Sports Complex Gymnasium"),
                ("Clogged drainage in Chemistry Lab sink #4", "Chemical waste sink backing up into basin during lab experiment sessions.", "medium", "resolved", "Chemistry Dept, Lab 4"),
                ("Overflowing water tank on Girls Hostel 2 rooftop", "Rooftop tank float valve failed, causing water to spill over building facade.", "medium", "assigned", "Girls Hostel 2 Rooftop"),
                ("Flush tank valve stuck open in Academic Block 3 washroom", "Continuous running water noise in 2nd floor men's restroom.", "low", "resolved", "Academic Block 3, Floor 2")
            ],
            "TRANSPORT": [
                ("Broken window shield and door lock on Campus Shuttle #4", "Rear left window frame on Shuttle Bus #4 loose and rattles dangerously while driving.", "critical", "assigned", "Shuttle Bus #4 (Route A)"),
                ("Shuttle Bus Route B running 45 minutes late during morning rush", "Bus schedule delays causing students to miss 8:30 AM first period lectures.", "medium", "in_progress", "Campus Bus Depot"),
                ("Request for extra shuttle trips during mid-semester exam week", "Current frequency of 30 mins insufficient for 800+ commuting students.", "low", "submitted", "North Gate Bus Stop"),
                ("Electric campus buggy charging station offline at North Gate", "Charger port #1 throwing error code E-04 when buggy connected.", "medium", "assigned", "North Gate Charging Bay"),
                ("Driver overspeeding on campus perimeter ring road near Hostel 3", "Shuttle van recorded driving over 45 km/h near pedestrian crosswalks.", "high", "assigned", "Hostel Ring Road"),
                ("Broken seatbelts on Campus Transport Van #2", "Passenger seatbelts in row 2 and 3 buckled backwards and jammed.", "medium", "resolved", "Transport Van #2"),
                ("No shelter or bench at Pharmacy Block shuttle stop", "Students forced to wait in sun/rain without shade at Pharmacy building bay.", "low", "submitted", "Pharmacy Block Bay"),
                ("Bus #6 AC cooling failure during afternoon transit", "Air conditioning blower emitting hot air during peak 2 PM summer commute.", "medium", "resolved", "Shuttle Bus #6"),
                ("Parking lot #2 barrier gate sensor failing to open", "RFID gate sensor fails to recognize valid student vehicle passes.", "low", "resolved", "Student Parking Lot #2")
            ],
            "FINANCE": [
                ("Delay in Semester 4 Merit Scholarship reimbursement disbursement", "Scholarship credit pending in bank accounts despite approval 2 months ago.", "medium", "in_progress", "Admin Building, Room 104"),
                ("Incorrect fee structure reflected on online student fee portal", "Portal charging tuition fee for non-enrolled lab elective course.", "high", "assigned", "Finance Cell Window 2"),
                ("Security deposit refund pending for batch of 2025 graduates", "Caution money refund not credited 90 days post-graduation clearance.", "medium", "in_progress", "Accounts Branch Room 12"),
                ("Fee payment receipt generation failing after UPI transaction deduction", "Bank account debited Rs 25,000 but portal status shows UNPAID.", "critical", "assigned", "Online Fee Gateway"),
                ("Mess fee rebate processing delayed for sports tournament attendees", "Rebate forms submitted for 10-day inter-college event not processed.", "low", "submitted", "Finance Cell Window 4"),
                ("Duplicate fee debit error on semester registration portal", "System charged registration fee twice due to payment page reload.", "high", "resolved", "Finance Payment Gateway"),
                ("Financial assistance application status stuck in pending review for 6 weeks", "EWS scholarship application waiting verification from finance desk.", "medium", "in_progress", "Scholarship Desk"),
                ("Late fee fine wrongfully charged after online payment gateway downtime", "Rs 1,000 late fee added despite system crash on deadline evening.", "high", "resolved", "Finance Accounts Desk"),
                ("Hall ticket blocked due to fee clearance record update mismatch", "Student cleared all dues but library fine tag showing falsely in finance system.", "critical", "resolved", "Admin Examination Cell")
            ],
            "ACADEMIC": [
                ("Grade sheet discrepancy in CSE-302 Data Structures internal marks", "Portal displays 12/20 whereas graded mid-term paper shows 18/20.", "high", "assigned", "Academic Evaluation Cell"),
                ("Course registration portal crash during elective course selection", "Server crashed when 1200 students logged in simultaneously at 10 AM.", "critical", "resolved", "Academic Server Hub"),
                ("Timetable clash between Elective Artificial Intelligence and Robotics Lab", "Both compulsory elective lectures scheduled for Friday 2:00 PM slot.", "medium", "in_progress", "Academic Block 1 Room 204"),
                ("Attendance shortage warning issued despite approved medical leave", "Hospitalization leave sanctioned by HOD not updated on attendance portal.", "high", "assigned", "Dean Academics Office"),
                ("Request for re-evaluation of End-Term exam paper for Math III", "Re-eval application filed 3 weeks ago without status update.", "medium", "submitted", "Exam Evaluation Branch"),
                ("Hall ticket missing student signature & photo verification seal", "Admit card generated without official university registrar stamp.", "medium", "resolved", "Examination Cell Window 1"),
                ("Transcript request processing time exceeding 15 business days", "Official transcript needed for higher studies application pending verification.", "medium", "in_progress", "Academic Records Room"),
                ("Classroom assignment conflict for ECE 3rd Year lecture hall", "Two batches assigned to Room 302 for same Tuesday 11 AM period.", "low", "resolved", "ECE Department Block"),
                ("Delay in publishing Supplementary examination datesheet", "Exam timetable for arrears not declared 10 days prior to schedule.", "high", "assigned", "Controller of Exams Office")
            ],
            "CANTEEN": [
                ("Unhygienic food storage and raw material handling in Night Canteen", "Overnight mess staff observed storing open dairy products near waste containers.", "critical", "assigned", "Night Canteen Annex"),
                ("Stale food served in Lunch Thali at Central Mess on Tuesday", "Curry served during lunch had sour taste and stale odor.", "high", "in_progress", "Central Mess Ground Floor"),
                ("Overcharging above MRP on packaged beverages in Annex Canteen", "Store vendor charging Rs 5 extra above printed MRP on cold drink bottles.", "medium", "assigned", "Annex Canteen Counter"),
                ("Lack of drinking water glass cups in Main Canteen dining area", "No clean glasses available at water dispenser during peak lunch hours.", "low", "resolved", "Main Canteen Dining Hall"),
                ("Flies and insects near open food counters in Food Court", "Food display counter lacks mesh net screen in fast food section.", "high", "in_progress", "Campus Food Court"),
                ("Payment gateway QR scanner down at Canteen billing counter", "UPI payment terminal throwing network timeout error during rush hour.", "low", "resolved", "Central Canteen Cashier"),
                ("Burnt chapatis and undercooked rice served in Hostel 2 Mess", "Quality of dinner food degraded past 3 days in Boys Hostel 2 mess.", "medium", "submitted", "Hostel 2 Mess Kitchen"),
                ("Cleanliness issue on dining tables during peak lunch hours", "Tables left uncleaned with food scraps for 30+ minutes between meals.", "low", "resolved", "South Canteen Hall"),
                ("Request for expanded vegetarian options in South Canteen", "Limited veg meal options available on afternoon menu.", "low", "submitted", "South Canteen Counter")
            ],
            "LIBRARY": [
                ("Request for additional reference copies for Data Structures & Algorithms", "Only 2 copies of core textbook available for 120 enrolled CSE students.", "low", "resolved", "Central Library 3rd Floor"),
                ("Air conditioning units not cooling on Central Library 3rd Floor", "Quiet reading hall temperature reaching 32°C during afternoon hours.", "medium", "in_progress", "Central Library 3rd Floor"),
                ("Digital library workstation PC #8 OS crashing on PDF load", "Terminal #8 bluescreens when opening large IEEE journal PDF files.", "medium", "assigned", "Digital Library Section"),
                ("Noise level disturbance in silent reading area on 2nd Floor", "Group discussions taking place inside designated zero-noise reading room.", "low", "resolved", "Library 2nd Floor Silent Zone"),
                ("Book return RFID scanner dropping book check-in logs", "Return drop box failed to clear overdue fine from student library profile.", "high", "assigned", "Library Circulation Desk"),
                ("Missing volumes of IEEE Computer Society Research Journals", "Volume 14 (2024) missing from physical reference shelf.", "low", "submitted", "Journal Reference Room"),
                ("Library membership card renewal queue taking over 1 hour", "Single counter operational for annual card renewal during admission week.", "medium", "in_progress", "Library Admin Counter"),
                ("Broken study desk lighting lamp on Table 14", "Individual reading lamp flickering on Table 14 in postgraduate wing.", "low", "resolved", "Library PG Wing"),
                ("Late book fine charged during university holiday closure week", "System auto-calculated Rs 50 fine during official campus closure.", "medium", "resolved", "Library Accounts Counter"),
                ("Inadequate power socket outlets near study carrels in Block B", "Laptops running out of charge due to broken plug points on carrels.", "low", "submitted", "Library Block B Carrels")
            ]
        }

        total_seeded = 0
        for code, items in raw_complaints.items():
            dept = depts[code]
            dept_head = dept_head_users[code]

            for item in items:
                title, desc, urgency, status, location = item
                student = random.choice(students)

                c = Complaint(
                    title=title,
                    description=desc,
                    student_id=student.id,
                    category=dept.name,
                    status=status,
                    urgency=urgency,
                    department_id=dept.id,
                    location=location
                )
                db.add(c)
                db.flush()
                total_seeded += 1

                # Add baseline comments
                comm1 = Comment(
                    complaint_id=c.id,
                    user_id=student.id,
                    content=f"Grievance filed by {student.full_name}.",
                    is_internal=False,
                    is_ai_generated=False
                )
                db.add(comm1)

                if status in ["assigned", "in_progress", "resolved"]:
                    comm2 = Comment(
                        complaint_id=c.id,
                        user_id=dept_head.id,
                        content=f"Administrative Note: Department '{dept.name}' acknowledged claim. Status set to {status.upper()}.",
                        is_internal=False,
                        is_ai_generated=False
                    )
                    db.add(comm2)

                if status == "resolved":
                    comm3 = Comment(
                        complaint_id=c.id,
                        user_id=dept_head.id,
                        content="Maintenance work completed and verified by department team.",
                        is_internal=False,
                        is_ai_generated=False
                    )
                    db.add(comm3)

                # Attach proof screenshot for department evidence verification
                proof_map = {
                    "WATER": "/static/uploads/water_leakage_proof.png",
                    "ELECTRICAL": "/static/uploads/ac_electrical_proof.png",
                    "IT": "/static/uploads/wifi_router_proof.png",
                    "TRANSPORT": "/static/uploads/shuttle_bus_proof.png",
                    "CANTEEN": "/static/uploads/canteen_food_proof.png",
                    "HOSTEL": "/static/uploads/water_leakage_proof.png",
                    "FINANCE": "/static/uploads/ac_electrical_proof.png",
                    "ACADEMIC": "/static/uploads/wifi_router_proof.png",
                    "LIBRARY": "/static/uploads/canteen_food_proof.png",
                }

                proof_url = proof_map.get(code, "/static/uploads/water_leakage_proof.png")
                attachment = Attachment(
                    complaint_id=c.id,
                    file_url=proof_url,
                    file_type="image/png",
                    ai_verification_status="verified",
                    ai_verification_explanation=f"Grok-AI Auditor: Visual evidence screenshot for {dept.name} verified against student report description. Authenticity score +3.0%."
                )
                db.add(attachment)

                # Add Decision log

                dec_log = DecisionLog(
                    complaint_id=c.id,
                    integrity_score=random.randint(88, 99),
                    severity_level=urgency.upper(),
                    confidence=random.randint(85, 98),
                    decision="FORWARD_TO_DEPARTMENT",
                    reasoning_summary=f"Automated AI classification evaluated category as '{dept.name}' with urgency '{urgency}'."
                )
                db.add(dec_log)

                # Add Audit Trail
                audit = AuditTrail(
                    complaint_id=c.id,
                    action="PIPELINE_EVALUATED",
                    actor="SYSTEM_AGENT",
                    notes=f"Processed complaint and assigned to {dept.name} department."
                )
                db.add(audit)

        db.commit()
        print(f"Database seeded successfully with {total_seeded} mock complaints across all 9 departments!")
        print(f"Total Users: {db.query(User).count()}")
        print(f"Total Departments: {db.query(Department).count()}")
        print(f"Total Complaints: {db.query(Complaint).count()}")

        # Print per-department breakdown verification
        print("\n--- Per-Department Complaint Breakdown in PostgreSQL ---")
        for code, dept in depts.items():
            count = db.query(Complaint).filter(Complaint.department_id == dept.id).count()
            print(f" - {dept.name} ({code}): {count} complaints")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed CampusBridge database.")
    parser.add_argument("--reset", action="store_true", help="Clear existing database tables before seeding.")
    args = parser.parse_args()
    seed_database(reset=args.reset)
