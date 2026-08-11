"""Daily attendance marking, gate clock-in, and term roll-up."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Iterable

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from academics.models import ClassArm, Term
from accounts.models import StudentProfile
from assessments.models import AttendanceRecord, FormClassRecord, StudentFormRecord


PRESENT_STATUSES = {
    AttendanceRecord.Status.PRESENT,
    AttendanceRecord.Status.LATE,
}


def parse_late_after() -> time:
    raw = getattr(settings, "SCHOOL_ATTENDANCE_LATE_AFTER", "08:30") or "08:30"
    try:
        hour_s, minute_s = raw.strip().split(":", 1)
        return time(hour=int(hour_s), minute=int(minute_s))
    except (TypeError, ValueError):
        return time(8, 30)


def status_for_clock_in(at: datetime | None = None) -> str:
    when = at or timezone.localtime()
    if timezone.is_naive(when):
        when = timezone.make_aware(when, timezone.get_current_timezone())
    local_t = timezone.localtime(when).time().replace(tzinfo=None)
    late_after = parse_late_after()
    if local_t > late_after:
        return AttendanceRecord.Status.LATE
    return AttendanceRecord.Status.PRESENT


def recompute_term_attendance(student: StudentProfile, term: Term) -> StudentFormRecord:
    """
    Roll daily AttendanceRecord rows into StudentFormRecord days_present / days_absent.
    Present + Late count as present; Absent counts as absent.
    """
    qs = AttendanceRecord.objects.filter(student=student, term=term)
    present = qs.filter(status__in=PRESENT_STATUSES).count()
    absent = qs.filter(status=AttendanceRecord.Status.ABSENT).count()
    class_arm = student.class_arm
    defaults = {
        "days_present": present,
        "days_absent": absent,
    }
    if class_arm_id := (class_arm.id if class_arm else None):
        defaults["class_arm_id"] = class_arm_id
    record, _ = StudentFormRecord.objects.update_or_create(
        student=student,
        term=term,
        defaults=defaults,
    )
    return record


def sync_days_opened(class_arm: ClassArm, term: Term) -> FormClassRecord:
    opened = (
        AttendanceRecord.objects.filter(class_arm=class_arm, term=term)
        .values("date")
        .distinct()
        .count()
    )
    record, _ = FormClassRecord.objects.update_or_create(
        class_arm=class_arm,
        term=term,
        defaults={"days_opened": opened, "number_in_class": StudentProfile.objects.filter(
            class_arm=class_arm, is_active=True
        ).count()},
    )
    return record


@transaction.atomic
def upsert_daily_marks(
    *,
    class_arm: ClassArm,
    term: Term,
    on_date: date,
    marks: Iterable[dict],
    marked_by=None,
) -> dict:
    """
    marks: iterable of {"student": StudentProfile|id, "status": "present"|"absent"|"late"}
    """
    valid = {c.value for c in AttendanceRecord.Status}
    touched: list[StudentProfile] = []
    saved = 0

    for item in marks:
        student = item.get("student")
        if student is None:
            continue
        if not isinstance(student, StudentProfile):
            student = StudentProfile.objects.filter(id=student).first()
            if not student:
                continue
        status_value = str(item.get("status") or AttendanceRecord.Status.PRESENT).lower()
        if status_value not in valid:
            continue

        AttendanceRecord.objects.update_or_create(
            student=student,
            date=on_date,
            defaults={
                "class_arm": class_arm,
                "term": term,
                "status": status_value,
                "marked_by": marked_by,
            },
        )
        touched.append(student)
        saved += 1

    for student in touched:
        recompute_term_attendance(student, term)
    sync_days_opened(class_arm, term)

    return {"saved": saved, "students": len(touched)}


@transaction.atomic
def clock_in(
    *,
    student_code: str,
    marked_by=None,
    at: datetime | None = None,
    on_date: date | None = None,
) -> dict:
    """
    Gate clock-in by student ID (QR payload). Uses active term and student's class arm.
    """
    code = (student_code or "").strip().upper()
    if not code:
        raise ValueError("Student code is required.")

    student = StudentProfile.objects.select_related("class_arm").filter(
        student_id__iexact=code, is_active=True
    ).first()
    if not student:
        raise LookupError(f"No active student found for {code}.")
    if not student.class_arm_id:
        raise ValueError(f"{student.student_id} has no class assigned.")

    term = Term.objects.filter(is_active=True).select_related("session").first()
    if not term:
        raise ValueError("No active term is set.")

    when = at or timezone.localtime()
    day = on_date or timezone.localdate()
    status_value = status_for_clock_in(when)

    existing = AttendanceRecord.objects.filter(student=student, date=day).first()
    already_marked = existing is not None
    if existing:
        # Gate clock-in does not downgrade an existing Present to Late, but upgrades
        # Absent → Present/Late and keeps Late if already late.
        if existing.status == AttendanceRecord.Status.ABSENT:
            existing.status = status_value
            existing.class_arm = student.class_arm
            existing.term = term
            existing.marked_by = marked_by
            existing.save(
                update_fields=["status", "class_arm", "term", "marked_by"]
            )
            already_marked = False
        elif (
            existing.status == AttendanceRecord.Status.PRESENT
            and status_value == AttendanceRecord.Status.LATE
        ):
            # Keep present if already present earlier.
            status_value = existing.status
        else:
            status_value = existing.status
    else:
        AttendanceRecord.objects.create(
            student=student,
            class_arm=student.class_arm,
            term=term,
            date=day,
            status=status_value,
            marked_by=marked_by,
        )

    form = recompute_term_attendance(student, term)
    sync_days_opened(student.class_arm, term)

    return {
        "student": {
            "id": student.id,
            "student_id": student.student_id,
            "full_name": student.full_name,
            "class_arm": student.class_arm.label or str(student.class_arm),
        },
        "term": {"id": term.id, "name": term.name},
        "date": day.isoformat(),
        "status": status_value,
        "already_marked": already_marked,
        "days_present": form.days_present,
        "days_absent": form.days_absent,
        "message": (
            f"{student.full_name} already marked {status_value} for today."
            if already_marked
            else f"{student.full_name} clocked in as {status_value}."
        ),
    }


def build_register_payload(*, class_arm: ClassArm, term: Term, on_date: date) -> dict:
    students = list(
        StudentProfile.objects.filter(class_arm=class_arm, is_active=True)
        .order_by("full_name")
        .only("id", "full_name", "student_id")
    )
    existing = {
        row.student_id: row
        for row in AttendanceRecord.objects.filter(
            class_arm=class_arm, term=term, date=on_date, student_id__in=[s.id for s in students]
        )
    }
    rows = []
    counts = {"present": 0, "absent": 0, "late": 0, "unmarked": 0}
    for student in students:
        record = existing.get(student.id)
        status_value = record.status if record else None
        if status_value in counts:
            counts[status_value] += 1
        else:
            counts["unmarked"] += 1
        rows.append(
            {
                "student_id": student.id,
                "student_code": student.student_id,
                "student_name": student.full_name,
                "status": status_value,
                "record_id": record.id if record else None,
            }
        )
    return {
        "date": on_date.isoformat(),
        "term": {"id": term.id, "name": term.name, "number": term.number},
        "class_arm": {
            "id": class_arm.id,
            "name": class_arm.name,
            "label": class_arm.label or str(class_arm),
        },
        "counts": counts,
        "rows": rows,
    }
