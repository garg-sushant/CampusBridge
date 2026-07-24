import sys
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Align python path to backend root
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Set isolated test database URL before importing app configuration
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.base import Department, User

# In-memory SQLite for isolated test runs
DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine

@pytest.fixture(scope="session")
def TestingSessionLocal(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db(engine, TestingSessionLocal):
    # Establish transaction-isolated database connection per test
    connection = engine.connect()
    transaction = connection.begin()
    db_session = TestingSessionLocal(bind=connection)

    # Seed baseline departments
    departments_data = [
        {"name": "Hostel Administration", "code": "HOSTEL"},
        {"name": "WiFi/IT Services", "code": "IT"},
        {"name": "Electrical Maintenance", "code": "ELECTRICAL"},
        {"name": "Water & Sanitation", "code": "WATER"}
    ]
    depts = {}
    for d in departments_data:
        dept = Department(name=d["name"], code=d["code"])
        db_session.add(dept)
    db_session.flush()

    # Seed baseline users
    student = User(
        email="test_student@campus.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Alice Student",
        role="student",
        trust_score=100.0
    )
    admin = User(
        email="test_admin@campus.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Bob Admin",
        role="admin",
        trust_score=100.0
    )
    dept_head = User(
        email="test_head@campus.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Charlie Head",
        role="department_head",
        department_id=1,  # Hostel Administration
        trust_score=100.0
    )

    db_session.add(student)
    db_session.add(admin)
    db_session.add(dept_head)
    db_session.commit()

    yield db_session

    db_session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db):
    # Dependency override helper
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def student_headers(db):
    user = db.query(User).filter(User.email == "test_student@campus.edu").first()
    token = create_access_token(data={"sub": user.email, "email": user.email, "role": user.role, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers(db):
    user = db.query(User).filter(User.email == "test_admin@campus.edu").first()
    token = create_access_token(data={"sub": user.email, "email": user.email, "role": user.role, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def staff_headers(db):
    user = db.query(User).filter(User.email == "test_head@campus.edu").first()
    token = create_access_token(data={"sub": user.email, "email": user.email, "role": user.role, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}
