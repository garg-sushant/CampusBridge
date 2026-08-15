import pytest
from app.models.base import Complaint, Comment, TrustScoreHistory, User

def test_submit_complaint_success(client, student_headers, db):
    payload = {
        "title": "WiFi is down in hostel rooms",
        "description": "The internet connection has been extremely slow and keeps dropping continuously since morning.",
        "category": "WiFi/IT Services",
        "location": "Hostel Block C, Room 102"
    }
    response = client.post("/api/complaints/submit", json=payload, headers=student_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "submitted"
    assert data["department_id"] is not None
    assert data["urgency"] in ["medium", "high"]

    # Verify db trust history entry was created
    student_user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    history = db.query(TrustScoreHistory).filter(TrustScoreHistory.user_id == student_user.id).all()
    assert len(history) > 0
    assert history[0].delta > 0

def test_submit_complaint_forbidden_role(client, staff_headers):
    # Department heads should not be allowed to submit complaints
    payload = {
        "title": "IT room needs cleaning",
        "description": "The IT maintenance room has a lot of dust accumulated and requires sanitation.",
        "category": "WiFi/IT Services",
        "location": "Admin Block Floor 1"
    }
    response = client.post("/api/complaints/submit", json=payload, headers=staff_headers)
    assert response.status_code == 403

def test_list_complaints_student_purview(client, student_headers, admin_headers, db):
    student_user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    admin_user = db.query(User).filter(User.email == "test_admin@campus.edu").first()

    # Seed 2 complaints: one from our student, one from another student
    comp1 = Complaint(
        title="Restroom tap leak",
        description="Water is continuously leaking from the tap in block A rest room.",
        student_id=student_user.id,
        category="Water & Sanitation",
        location="Hostel Block A, Restroom"
    )
    comp2 = Complaint(
        title="Library power socket broken",
        description="Power socket near seat 24 is broken and sparking.",
        student_id=admin_user.id,
        category="Electrical Maintenance",
        location="Library Floor 1"
    )
    db.add(comp1)
    db.add(comp2)
    db.commit()

    # List as student
    response = client.get("/api/complaints/", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    # Student Alice should only see her own complaint (comp1)
    assert len(data) == 1
    assert data[0]["title"] == "Restroom tap leak"

def test_post_comment_student_constraints(client, student_headers, db):
    student_user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    comp = Complaint(
        title="Restroom tap leak",
        description="Water is continuously leaking from the tap in block A rest room.",
        student_id=student_user.id,
        category="Water & Sanitation",
        location="Hostel Block A, Restroom"
    )
    db.add(comp)
    db.commit()

    # Student posting public comment is allowed
    payload = {"content": "Plumber team, please hurry.", "is_internal": False}
    response = client.post(f"/api/complaints/{comp.id}/comment", json=payload, headers=student_headers)
    assert response.status_code == 200

    # Student trying to post internal comment is forbidden
    payload = {"content": "Private note.", "is_internal": True}
    response = client.post(f"/api/complaints/{comp.id}/comment", json=payload, headers=student_headers)
    assert response.status_code == 403

def test_patch_complaint_status_partial_success(client, staff_headers, db):
    student_user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    # Department head can update complaint status/urgency/department
    comp = Complaint(
        title="Hostel fan broken",
        description="Room 105 fan is not spinning and makes clicking sounds.",
        student_id=student_user.id,
        category="Hostel Administration",
        department_id=1, # hostel administration
        location="Hostel Block B, Room 105"
    )
    db.add(comp)
    db.commit()

    # Make PATCH update without status (status is now Optional in schema)
    payload = {"urgency": "high"}
    response = client.patch(f"/api/complaints/{comp.id}/status", json=payload, headers=staff_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["urgency"] == "high"
    assert data["status"] == "submitted" # remains unchanged

def test_daily_complaint_quota_limit(client, student_headers, db):
    # Create 5 complaints for the student for today
    student_user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    for i in range(5):
        comp = Complaint(
            title=f"Valid issue {i+1}",
            description=f"Detailed constructive grievance report number {i+1} regarding hostel amenities.",
            student_id=student_user.id,
            category="Hostel Administration",
            location="Block A, Room 101"
        )
        db.add(comp)
    db.commit()

    # The 6th submission should be rejected with 400 Bad Request
    payload = {
        "title": "Sixth issue attempt",
        "description": "Attempting to file a sixth issue in a single day.",
        "category": "Hostel Administration",
        "location": "Block A, Room 101"
    }
    response = client.post("/api/complaints/submit", json=payload, headers=student_headers)
    assert response.status_code == 400
    assert "Daily Submission Limit Reached" in response.json()["detail"]

