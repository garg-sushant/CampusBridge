# CampusBridge – Smart Campus Grievance & Governance Portal

CampusBridge is a full-stack, AI-powered institutional governance and redressal platform built for modern universities. It streamlines campus-wide operations by triaging, routing, verifying, and resolving student-filed grievances transparently and officially.

---

## 🏛️ Technology Stack & Architecture

- **Backend**: **Python 3.11**, **FastAPI**, **SQLAlchemy ORM**, **SQLite / PostgreSQL Database**, **Pytest**.
- **Frontend**: **Next.js (App Router)**, **React 19**, **TypeScript**, **NextAuth.js (Google OAuth & Credentials)**, **TailwindCSS**, Glassmorphic Design System.
- **AI Engine**: **Groq / OpenAI GPT-OSS 120B Pipeline** (`openai/gpt-oss-120b`) for automated grievance triaging, urgency level scoring (`critical`, `high`, `medium`, `low`), and multi-agent integrity credibility audits.
- **Realtime Notifications**: **Gmail / SMTP Background Email Dispatcher** (`BackgroundTasks` + HTML Templates) and live portal timeline updates.

---

## 🤖 AI Agent Capabilities & Anti-Spam Safeguards

1. **Pre-Submission AI Evaluation**: Synchronously audits issue descriptions. Submissions detected as fake, randomly written (e.g. `asdf`, `test`), or scoring an **Integrity Trust Rating < 40%** are immediately blocked and purged from the portal without being stored.
2. **Daily Submission Quota Limit**: Restricts each student email ID to a maximum of **5 grievance submissions per calendar day** to prevent spamming and abuse.
3. **Intelligent Classification & Routing**: Reads student grievance descriptions and routes claims instantly to the responsible department (Hostel, IT, Electrical, Water, Transport, Finance, Academic, Canteen, Library).
4. **Authenticity & Proof Verification**: Audits uploaded evidence photos/PDFs against report descriptions, penalizing fake placeholders (`-10.0%` trust score) and crediting verified proof (`+5.0%`).
5. **Dynamic Urgency Rating**: Automatically evaluates safety hazards and escalates urgency levels (**`CRITICAL`**, **`HIGH`**, **`MEDIUM`**, **`LOW`**).
6. **Dean's Priority Issue Clusters & Department Desks**: Groups campus issues into department desks with one-click back navigation for executive oversight.

---

## 🔑 Demo Account Credentials

The platform includes pre-configured accounts for the Dean of Campus Governance, Department Heads, and Students:

| Department / Role | Email Address | Password | Clearance Level |
| :--- | :--- | :--- | :--- |
| **Dean of Campus Governance** | `admin@campus.edu` | `adminpassword` | Dean / System Admin |
| **Hostel Administration** | `hostelhead@campus.edu` | `hostelpassword` | Department Head |
| **WiFi/IT Services** | `ithead@campus.edu` | `itpassword` | Department Head |
| **Electrical Maintenance** | `electricalhead@campus.edu` | `electricalpassword` | Department Head |
| **Water & Sanitation** | `waterhead@campus.edu` | `waterpassword` | Department Head |
| **Transport Department** | `transporthead@campus.edu` | `transportpassword` | Department Head |
| **Finance/Scholarship Cell** | `financehead@campus.edu` | `financepassword` | Department Head |
| **Academic Administration** | `academichead@campus.edu` | `academicpassword` | Department Head |
| **Canteen Management** | `canteenhead@campus.edu` | `canteenpassword` | Department Head |
| **Library Management** | `libraryhead@campus.edu` | `librarypassword` | Department Head |
| **Student Account (Demo)** | `student@campus.edu` | `studentpassword` | Student Clearance |

---

## ⚙️ Environment Configurations

### 1. Backend Environment (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and update values:
```ini
# Database Connection URL (SQLite default or PostgreSQL)
DATABASE_URL=sqlite:///./campus_governance.db

# JWT Security (Generate using: openssl rand -hex 32)
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Upload Directory
UPLOAD_DIR=uploads


# Groq LLM Settings (console.groq.com)
GROK_API_KEY=your_groq_api_key_here
CHATGROK_API_KEY=your_chatgrok_api_key_here
GROK_API_URL=https://api.groq.com/openai/v1
GROK_MODEL=openai/gpt-oss-120b

# Realtime Gmail SMTP Email Dispatcher Settings
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_NAME=CampusBridge Governance Portal
```

### 2. Frontend Environment (`frontend/.env.local`)
Copy `frontend/.env.example` to `frontend/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Google OAuth & NextAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

---

## 🚀 Installation & Local Development

### 1. Backend Service
```bash
cd backend

# Create & activate Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell (or source venv/bin/activate on Linux/Mac)

# Install dependencies
pip install -r requirements.txt

# Seed Database with sample complaints across departments
python seed.py --reset

# Start FastAPI server (Runs on http://localhost:8000)
uvicorn app.main:app --reload
```

### 2. Frontend Portal
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js Development Server (Runs on http://localhost:3000)
npm run dev
```

---

## 🧪 Automated Testing & Code Verification

Run backend unit test suite:
```bash
pytest backend/tests
```

Run frontend production build & typecheck:
```bash
cd frontend
npm run build
```
