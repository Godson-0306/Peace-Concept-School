# JAMB CBT integration notes
#
# This school portal only provides a progress shell for JAMB CBT.
# Drop your existing JAMB CBT repository in later and wire it here.
#
# Suggested integration points
# ----------------------------
# 1. Student UI mount
#    Frontend route: /app/assessments/jamb
#    Replace the placeholder page with your JAMB CBT SPA embed or Next.js routes.
#
# 2. Progress storage (already modeled)
#    Model: cbt.models.JambAttempt
#    Fields: student, title, score_percent, subjects_json, taken_at, source, meta
#    Do NOT write JAMB scores into assessments.AssessmentScore.
#
# 3. Progress API
#    GET /api/cbt/jamb/progress/  — returns attempts for the logged-in student
#    After integration, POST from your JAMB engine to create JambAttempt rows
#    (add a write endpoint when the external app is connected).
#
# 4. Auth
#    Reuse portal session cookies (credentials: include) or issue a short-lived
#    token from /api/auth/me/ for the embedded JAMB app.
#
# 5. Branding
#    Apply PCIMS blue/pink brand and logo when redesigning the external UI.
