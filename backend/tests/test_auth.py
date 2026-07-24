import pytest
from app.models.base import User

def test_register_student_success(client, db):
    payload = {
        "email": "new_student@campus.edu",
        "full_name": "New Student",
        "password": "strongpassword123",
        "role": "student"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new_student@campus.edu"
    assert data["role"] == "student"
    assert "id" in data

    # Verify db state
    user = db.query(User).filter(User.email == "new_student@campus.edu").first()
    assert user is not None
    assert user.full_name == "New Student"

def test_register_privilege_escalation_denied(client):
    # Attempting to register as admin should be rejected or raise 400 Bad Request
    payload = {
        "email": "malicious_admin@campus.edu",
        "full_name": "Hacker Admin",
        "password": "strongpassword123",
        "role": "admin"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    assert "Self-registration is restricted" in response.json()["detail"]

def test_login_success(client):
    # Form parameter request compatible with OAuth2 form-data
    response = client.post(
        "/api/auth/login",
        data={"username": "test_student@campus.edu", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_credentials(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "test_student@campus.edu", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

def test_get_current_user_me(client, student_headers):
    response = client.get("/api/auth/me", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test_student@campus.edu"
    assert data["role"] == "student"
