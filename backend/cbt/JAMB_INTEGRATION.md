# JAMB CBT integration

The portal embeds the static JAMB CBT engine from
[`Godson-0306/Jamb-CBT-Website`](https://github.com/Godson-0306/Jamb-CBT-Website).

## Where it lives

| Piece | Path |
|-------|------|
| Student UI | `/app/assessments/jamb` |
| Static engine | `frontend/public/jamb-cbt/` (`index.html`, `app.js`, `styles.css`) |
| Progress model | `cbt.models.JambAttempt` |
| Progress API | `GET/POST /api/cbt/jamb/progress/` |

## Behaviour

1. Students open **Assessments → JAMB CBT** and start the embedded engine.
2. The engine generates a fresh 200-question paper (4 subjects × 50).
3. On submit, it:
   - stores the session in `localStorage`
   - `postMessage`s the report to the portal frame
   - `POST`s a `JambAttempt` row to `/api/cbt/jamb/progress/`
4. JAMB scores **never** write into `assessments.AssessmentScore`.

## Auth

The static page runs same-origin under the Next.js app, so
`credentials: "include"` reuses the portal session cookie when saving progress.

## Branding

CSS variables in `styles.css` use PCIMS blue / pink.
