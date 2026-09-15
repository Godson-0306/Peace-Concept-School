"""School section bands used for fee schedules."""

from __future__ import annotations

from academics.defaults import CLASS_LEVEL_FEE_SECTION

FEE_SECTIONS = (
    ("creche", "Creche"),
    ("pre_nursery", "Pre-Nursery"),
    ("nursery", "Nursery"),
    ("primary", "Primary"),
    ("jss", "JSS"),
    ("ss", "SS"),
)

FEE_SECTION_LABELS = dict(FEE_SECTIONS)

FEE_SECTION_HINTS = {
    "creche": "Creche only",
    "pre_nursery": "Pre-Nursery only",
    "nursery": "Nursery 1–2",
    "primary": "Basic 1–5",
    "jss": "JSS1–3",
    "ss": "SS1–3",
}

# Class-level display names → fee section key (includes legacy aliases).
CLASS_LEVEL_TO_SECTION: dict[str, str] = {
    **CLASS_LEVEL_FEE_SECTION,
    "Daycare": "pre_nursery",
    "Nursery1": "nursery",
    "Nursery2": "nursery",
    "Primary 1": "primary",
    "Primary 2": "primary",
    "Primary 3": "primary",
    "Primary 4": "primary",
    "Primary 5": "primary",
    "JSS 1": "jss",
    "JSS 2": "jss",
    "JSS 3": "jss",
    "SS 1": "ss",
    "SS 2": "ss",
    "SS 3": "ss",
    "SSS1": "ss",
    "SSS2": "ss",
    "SSS3": "ss",
    "day_care": "pre_nursery",
}


def section_for_class_level(level) -> str | None:
    """Prefer the ClassLevel.fee_section column; fall back to name mapping."""
    if level is None:
        return None
    stored = (getattr(level, "fee_section", None) or "").strip()
    if stored == "day_care":
        return "pre_nursery"
    if stored:
        return stored
    return section_for_class_level_name(getattr(level, "name", None))


def section_for_class_level_name(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip()
    if key in CLASS_LEVEL_TO_SECTION:
        return CLASS_LEVEL_TO_SECTION[key]
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


def fee_sections_catalog() -> list[dict]:
    from academics.models import ClassLevel

    levels = list(ClassLevel.objects.order_by("order", "name"))
    by_section: dict[str, list[str]] = {key: [] for key, _label in FEE_SECTIONS}
    for level in levels:
        section = section_for_class_level(level)
        if section in by_section:
            by_section[section].append(level.name)
    return [
        {
            "key": key,
            "label": label,
            "hint": FEE_SECTION_HINTS.get(key, label),
            "class_names": by_section.get(key, []),
        }
        for key, label in FEE_SECTIONS
    ]
