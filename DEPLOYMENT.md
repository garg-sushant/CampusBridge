# 🚀 CampusBridge Production Deployment Guide

This guide covers deploying the **CampusBridge** platform to production environments such as **Vercel** (Frontend) and **Render / Railway / Render** (Backend API), or via **Docker**.

---

## 📋 Pre-Deployment Checklist

- [x] All `.env` and `.env.local` files are ignored in `.gitignore`.
- [x] Public API endpoint configuration (`NEXT_PUBLIC_API_URL`) handles environment overrides.
- [x] Health check endpoints (`/health` and `/api/health`) are active for uptime monitoring.
- [x] Pre-submission AI auditing, 5-issue/day rate limiting, and multi-role auth are verified.

---

## 1. Deploying Backend API to Render / Railway

### Option A: Render (Recommended for FastAPI)

1. Push your repository to **GitHub / GitLab**.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New + > Web Service**.
3. Connect your repository.
4. Set the build configuration:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables in Render:
   - `DATABASE_URL`: Your PostgreSQL database URL (Render PostgreSQL or Supabase/Neon).
   - `SECRET_KEY`: Generate a random 64-character key (`openssl rand -hex 32`).
   - `ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`
   - `GROK_API_KEY`: Your xAI Grok developer API key.
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
   - `SMTP_USER` & `SMTP_PASSWORD`: (Optional) Gmail App Password for SMTP email notifications.
6. Deploy the Web Service and copy your API backend URL (e.g., `https://campusbridge-api.onrender.com`).

---

## 2. Deploying Frontend to Vercel

1. Log into [Vercel Dashboard](https://vercel.com/) and click **Add New > Project**.
2. Import your repository and choose `frontend` as the Framework Root Directory.
3. Configure Environment Variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: `https://campusbridge-api.onrender.com/api`
   - `NEXTAUTH_URL`: `https://your-custom-domain.vercel.app`
   - `NEXTAUTH_SECRET`: Generate a random secret string.
   - `GOOGLE_CLIENT_ID`: Your Google Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google Client Secret.
4. Click **Deploy**. Vercel will build and publish your Next.js application automatically.

---

## 3. Database Migration & Seeding in Production

To seed production databases or initialize default department records:

```bash
cd backend
python seed.py --reset
```

---

## 🔍 Health & Monitoring Checks

- **API Uptime Probe**: `GET https://your-backend-url.com/health` -> returns `{"status": "healthy"}`
- **Swagger Documentation**: `GET https://your-backend-url.com/docs`
