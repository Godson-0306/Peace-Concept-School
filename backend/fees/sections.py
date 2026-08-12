"""School section bands used for fee schedules."""

from __future__ import annotations

# Canonical fee sections (Day Care separate from Nursery).
FEE_SECTIONS = (
    ("day_care", "Day Care"),
    ("nursery", "Nursery"),
    ("primary", "Primary"),
    ("jss", "JSS"),
    ("ss", "SS"),
)

FEE_SECTION_LABELS = dict(FEE_SECTIONS)

# Class-level display names → fee section key.
CLASS_LEVEL_TO_SECTION: dict[str, str] = {
    "Day Care": "day_care",
    "Daycare": "day_care",
    "Nursery 1": "nursery",
    "Nursery 2": "nursery",
    "Nursery1": "nursery",
    "Nursery2": "nursery",
    "Basic 1": "primary",
    "Basic 2": "primary",
    "Basic 3": "primary",
    "Basic 4": "primary",
    "Basic 5": "primary",
    "Primary 1": "primary",
    "Primary 2": "primary",
    "Primary 3": "primary",
    "Primary 4": "primary",
    "Primary 5": "primary",
    "JSS1": "jss",
    "JSS2": "jss",
    "JSS3": "jss",
    "JSS 1": "jss",
    "JSS 2": "jss",
    "JSS 3": "jss",
    "SS1": "ss",
    "SS2": "ss",
    "SS3": "ss",
    "SS 1": "ss",
    "SS 2": "ss",
    "SS 3": "ss",
    "SSS1": "ss",
    "SSS2": "ss",
    "SSS3": "ss",
}


def section_for_class_level_name(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip()
    if key in CLASS_LEVEL_TO_SECTION:
        return CLASS_LEVEL_TO_SECTION[key]
    # Soft match: ignore spaces / case for common patterns.
    compact = key.replace(" ", "").lower()
    for label, section in CLASS_LEVEL_TO_SECTION.items():
        if label.replace(" ", "").lower() == compact:
            return section
    return None


def student_fee_type(*, admission_year: int, session_start_year: int) -> str:
    """New students = admitted in this session's start year; otherwise returning."""
    if admission_year == session_start_year:
        return "new"
    return "returning"
