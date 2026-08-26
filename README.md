# Peace Concept International Mission Schools

School website and management system for Peace Concept International Mission Schools
(Day Care · Nursery · Basic · JSS · SS).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind — public website + login-gated `/app` portals
- **Backend:** Django 6 + Django REST Framework
- **Database:** PostgreSQL in production (SQLite locally by default)
- **Async:** Celery + Redis (email/WhatsApp notifications on result publish)
- **Hosting blueprint:** [`render.yaml`](render.yaml) for API, worker, Postgres, Redis, persistent media disk; frontend on Vercel
- **Media:** Local disk (`MEDIA_ROOT`, Render disk at `/var/data/media`) or S3 when `AWS_STORAGE_BUCKET_NAME` is set
- **Email:** Console locally; set `EMAIL_HOST` (+ user/password) for SMTP in production

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

Staff use the **Staff** tab (Username + password). Students use the **Student** tab (Student ID + password). Parents use the **Parent** tab (parent username + password).

| Role | Portal | Username / Student ID | Password |
|------|--------|-----------------------|----------|
| Admin | Staff | `admin` | AdminPass123! |
| Accountant | Staff | `accountant` | Accountant123! |
| Store | Staff | `store1` | Store123! |

Additional staff/students come from roster imports (`import_staff_roster`, `import_student_roster`) with password usually `school`.

- Fee-gated results: unpaid bills lock student/parent result views. Students with **no bill yet** stay unlocked until Accounts generates bills. Enrolling a student auto-creates a bill for the active term when a matching fee structure exists. Parents/students can pay online via Paystack when `PAYSTACK_SECRET_KEY` is set; accountants still record cash/POS/transfer.

## Product notes

- Account Type (system role) + Position (HOD / VP / Form Teacher) layered permissions
- Student IDs: `PCS0YYNNN` (e.g. PCS025001)
- Grading: CA1/20 + CA2/20 + Exam/60; additional assessments count in total but not average divisor
- Fee-gated results: Paystack checkout + dedicated transfer account (when keys are set); accountant still records cash/POS/transfer; unlocked terms stay visible
- Inventory: `/app/inventory` for admin/accountant/store staff — catalogs, stock movements, sales (separate from tuition)
- Result publish notifies guardians via email + WhatsApp stub
- JAMB CBT practice: `/app/assessments/jamb` embeds the static engine under `frontend/public/jamb-cbt/` (progress only — never school report scores)
