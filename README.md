# Peace Concept School

K–12 school website and management system for Peace Concept School (Nigerian secondary context).

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

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@peaceconceptschool.ng | AdminPass123! |
| Principal | principal@peaceconceptschool.ng | Principal123! |
| Teacher | teacher@peaceconceptschool.ng | Teacher123! |
| Accountant | accountant@peaceconceptschool.ng | Accountant123! |
| Store | store@peaceconceptschool.ng | Store123! |
| Student | student1@peaceconceptschool.ng | Student123! |
| Parent | parent@peaceconceptschool.ng | Parent123! |

## Product notes

- Account Type (system role) + Position (HOD / VP / Form Teacher) layered permissions
- Student IDs: `PCS0YYNNN` (e.g. PCS025001)
- Grading: CA1/20 + CA2/20 + Exam/60; additional assessments count in total but not average divisor
- Fee-gated results: Accountant marks Paid manually (no payment gateway); unlocked terms stay visible
- Result publish notifies guardians via email + WhatsApp stub
