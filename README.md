# Peace Concept International Mission Schools

School website and management system for Peace Concept International Mission Schools
(Day Care · Nursery · Basic · JSS · SS).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind — public website + login-gated `/app` portals
- **Backend:** Django 5 + Django REST Framework
- **Database:** PostgreSQL in production (SQLite locally by default)
- **Async:** Celery + Redis (email/WhatsApp notifications on result publish)
- **Hosting blueprint:** [`render.yaml`](render.yaml) for API, worker, Postgres, Redis; frontend on Vercel

## Public website pages

- `/` Home · `/about` · `/admissions` · `/academics` · `/news` · `/gallery` · `/contact` (enquiry + application forms)
- `/login` — no public registration; Admin provisions all accounts

## Quick start (local)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — Next.js proxies `/api/*` to Django on port 8000.

### Demo logins (from `seed_demo`)

Staff use the **Staff** tab (Username + password). Students use the **Student** tab (Student ID + password).

| Role | Portal | Username / Student ID | Password |
|------|--------|-----------------------|----------|
| Admin | Staff | `admin` | AdminPass123! |
| Principal | Staff | `principal` | Principal123! |
| Teacher | Staff | `teacher1` | Teacher123! |
| Accountant | Staff | `accountant` | Accountant123! |
| Store | Staff | `store1` | Store123! |
| Parent | Staff | `parent1` | Parent123! |
| Student | Student | `PCS025001` (first seeded student) | Student123! |

## Product notes

- Account Type (system role) + Position (HOD / VP / Form Teacher) layered permissions
- Student IDs: `PCS0YYNNN` (e.g. PCS025001)
- Grading: CA1/20 + CA2/20 + Exam/60; additional assessments count in total but not average divisor
- Fee-gated results: Accountant marks Paid manually (no payment gateway); unlocked terms stay visible
- Result publish notifies guardians via email + WhatsApp stub
