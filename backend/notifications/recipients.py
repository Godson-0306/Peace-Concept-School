"""Guardian contact collection for result-publish notices."""

from __future__ import annotations

import re

PLACEHOLDER_EMAIL_DOMAIN = "parents.peaceconceptschool.ng"

_PHONE_DIGITS = re.compile(r"\D+")


def is_placeholder_email(email: str) -> bool:
    local = (email or "").strip().lower()
    return local.endswith(f"@{PLACEHOLDER_EMAIL_DOMAIN}")


def guardian_emails(student) -> list[str]:
    """Unique real inboxes: guardian_email plus linked parent user emails."""
    seen: set[str] = set()
    out: list[str] = []
    candidates: list[str] = []
    if getattr(student, "guardian_email", None):
        candidates.append(student.guardian_email)
    parents = getattr(student, "parents", None)
    if parents is not None:
        for parent in parents.all():
            user = getattr(parent, "user", None)
            if user and user.email:
                candidates.append(user.email)
    for raw in candidates:
        email = (raw or "").strip()
        if not email or "@" not in email:
            continue
        key = email.lower()
        if key in seen or is_placeholder_email(email):
            continue
        seen.add(key)
        out.append(email)
    return out


def to_e164_ng(raw: str) -> str:
    """Normalize a Nigerian (or already-international) number to digits with country code."""
    digits = _PHONE_DIGITS.sub("", raw or "")
    if not digits:
        return ""
    if digits.startswith("234") and len(digits) >= 12:
        return digits
    if digits.startswith("0") and len(digits) == 11:
        return "234" + digits[1:]
    if len(digits) == 10:
        return "234" + digits
    return digits


def guardian_whatsapp_numbers(student) -> list[str]:
    """Unique E.164 numbers from student WhatsApp / guardian phone fields."""
    raw_values = [
        getattr(student, "whatsapp_phone", "") or "",
        getattr(student, "guardian_phone", "") or "",
        getattr(student, "father_whatsapp", "") or "",
        getattr(student, "mother_whatsapp", "") or "",
    ]
    seen: set[str] = set()
    out: list[str] = []
    for raw in raw_values:
        e164 = to_e164_ng(raw)
        if not e164 or e164 in seen:
            continue
        seen.add(e164)
        out.append(e164)
    return out
