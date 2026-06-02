# CampusBridge – Campus Grievance & Governance Portal

CampusBridge is a full-stack, AI-powered institutional governance and redressal portal built for modern universities. It streamlines campus-wide operations by triaging, routing, verifying, and resolving student-filed institutional grievances transparently and officially.

---

## 🏛️ Project Architecture & Components

The workspace is organized into two primary segments:
1. **`backend/`**: A high-performance REST API service built with **FastAPI**, **SQLAlchemy**, and SQLite, featuring an agentic xAI Grok LLM triaging connector and safety evidence vision audits.
2. **`frontend/`**: A modern user interface built using **Next.js (App Router)**, **React 19**, **TypeScript**, and **TailwindCSS**, utilizing HSL color palettes and glassmorphism.

---

## 🤖 Grok LLM / ChatGrok AI Agent Integration

CampusBridge features a fully integrated **xAI Grok / ChatGrok** AI agent pipeline in `backend/app/services/ai_agent.py`. 

### Agentic Capabilities:
- **Intelligent Classification & Routing:** Replaces keyword rules with advanced semantic understanding. Grok reads student grievance descriptions and returns a structured JSON payload identifying the precise department code and classification justification.
- **Urgency & Severity Evaluation:** Analyzes complaints to dynamically escalate severity (`critical`, `high`, `medium`, `low`) for rapid safety responses.
- **Evidence Audit Verification:** Inspects uploaded files to reject mock placeholders, generic graphics, or selfies, actively updating student credibility ratings (-5% trust rating on spam, +2% credit on verified maintenance photos).
- **Graceful Offline Fallback:** If no API key is configured, the system automatically falls back to local offline TF-IDF/heuristic matching rules, maintaining seamless local and test suite operations.

---

## ⚙️ Environment Variables Setup

### Backend Configurations (`backend/.env`)
Create a `.env` file inside the `backend/` directory or copy the provided `backend/.env.example`:
```ini
# Database connection URL
DATABASE_URL=sqlite:///./campus_governance.db

# JWT Security Configurations
SECRET_KEY=9a15f02c6114b30bccebe7d4ad22a00c7db5204ef971cdfb1c557fa678d45391
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Local server upload directory for evidence files
UPLOAD_DIR=uploads

# xAI Grok / ChatGrok LLM Integration Settings
# Enter your Grok developer API key (console.x.ai) below to activate the live LLM agent:
GROK_API_KEY=your_chatgrok_api_key_here
CHATGROK_API_KEY=your_chatgrok_api_key_here
GROK_API_URL=https://api.x.ai/v1
GROK_MODEL=grok-beta
```

### Frontend Configurations (`frontend/.env.local`)
Create a `.env.local` file inside the `frontend/` directory or copy `frontend/.env.example`:
```ini
# URL pointing to the FastAPI backend API service
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## 🚀 Step-by-Step Installation & Startup

### 1. Backend Service Setup
First, navigate to the `backend/` directory, set up your Python virtual environment, install dependencies, and seed default governance data.

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows Powershell)
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Create tables & seed institutional data (Default students, IT head, Warden, Dean)
python seed.py

# Launch development server (Runs on http://localhost:8000)
uvicorn app.main:app --reload
```

### 2. Frontend Client Setup
In a new terminal window, navigate to the `frontend/` directory, install packages, and boot the Next.js portal.

```bash
cd frontend

# Install Node modules
npm install

# Run TypeScript compilation checks
npm run lint

# Launch Next.js portal (Runs on http://localhost:3000)
npm run dev
```

---

## 🔑 Seed User Logins

The application is pre-seeded with test accounts representing each clearance tier. Login buttons are provided on the Sign-In screen for rapid verification:

- **🎓 Student Portal:**
  - **Email:** `student@campus.edu` | **Password:** `studentpassword`
  - **Email:** `student2@campus.edu` | **Password:** `studentpassword`
- **🏢 Department Purview Desk:**
  - **Email:** `ithead@campus.edu` (WiFi/IT Services Head) | **Password:** `itpassword`
  - **Email:** `hostelhead@campus.edu` (Hostel Warden Head) | **Password:** `hostelpassword`
- **🏛️ Dean Admin Console (clearance):**
  - **Email:** `admin@campus.edu` | **Password:** `adminpassword`

---

## 🛡️ Core Built Features

1. **Tab-Isolated Multi-Sessions (`sessionStorage`):** Allows users to concurrently log into completely different accounts across separate browser tabs (e.g. Dean console in Tab 1, Student portal in Tab 2) without auth conflicts.
2. **Duplicate Tab Auto-Refresh:** Duplicating any active portal tab clones the JWT token and triggers exactly **one** automatic client-side refresh to rebuild local component states.
3. **Automated AI Triaging:** triages text descriptions to assign claims instantly across Hostel, IT, Electrical, and Water departments.
4. **Visual Evidence Verification:** Automatically parses uploads, penalizing spam files (-5.0% trust rating) and crediting verified maintenance photos (+2.0%).
5. **Cross-Grievance Semantic Matcher:** Deduplicates reports by automatically linking complaints matching pre-existing cases.

---

## 🧪 Automated Testing Verification

Verify that all authentication APIs, claim restrictions, and posting routines function perfectly using the custom test suite:

```bash
cd backend
.\venv\Scripts\python C:\Users\Dell\.gemini\antigravity\brain\04eac6c2-68b6-4a1c-991c-ebf0072b5e22\scratch\run_api_tests.py
```
*Expected output: `Ran 5 tests ... OK`*
