from collections import defaultdict
from decimal import Decimal

from academics.models import ClassArm, Subject
from accounts.models import StudentProfile
from assessments.models import AssessmentScore


def class_subjects_for_arm(class_arm: ClassArm):
    return list(
        Subject.objects.filter(
            class_level_id=class_arm.class_level_id,
            is_active=True,
            subject_type=Subject.SubjectType.SUBJECT,
        )
        .order_by("order", "name")
        .only("id", "name")
    )


def class_publish_blockers(term, class_arm: ClassArm) -> list[str]:
    """Requirements before a class can be published for a term."""
    blockers: list[str] = []

    if not term.next_term_resumption:
        blockers.append("Next term begins date has not been set for this term.")

    subjects = class_subjects_for_arm(class_arm)
    if not subjects:
        blockers.append(
            f"Number of subjects has not been set up for {class_arm.label or class_arm}."
        )

    students = list(
        StudentProfile.objects.filter(class_arm=class_arm, is_active=True).only("id", "full_name")
    )
    if not students:
        blockers.append(f"No active students in {class_arm.label or class_arm}.")

    if subjects and students:
        subject_ids = [s.id for s in subjects]
        existing = {
            (row["student_id"], row["subject_id"])
            for row in AssessmentScore.objects.filter(
                term=term,
                class_arm=class_arm,
                student_id__in=[s.id for s in students],
                subject_id__in=subject_ids,
            ).values("student_id", "subject_id")
        }
        expected = len(students) * len(subject_ids)
        have = len(existing)
        if have < expected:
            blockers.append(
                f"Not all results have been entered "
                f"({have}/{expected} student–subject scores)."
            )

    return blockers


def term_publish_blockers(term) -> list[str]:
    """Blockers for publishing every class arm with students in a term."""
    blockers: list[str] = []
    if not term.next_term_resumption:
        blockers.append("Next term begins date has not been set for this term.")

    arms = (
        ClassArm.objects.select_related("class_level")
        .filter(students__is_active=True)
        .distinct()
        .order_by("class_level__order", "name")
    )
    for arm in arms:
        class_blockers = class_publish_blockers(term, arm)
        # Avoid repeating the shared next-term message for every class.
        class_blockers = [
            b for b in class_blockers if "Next term begins" not in b
        ]
        for b in class_blockers:
            blockers.append(f"{arm.label or arm}: {b}")
    return blockers


def score_total(score: AssessmentScore) -> Decimal:
    return (score.ca1 or Decimal("0")) + (score.ca2 or Decimal("0")) + (score.exam or Decimal("0"))


def compute_student_result(student_id: int, term_id: int, scores=None):
    if scores is None:
        scores = list(
            AssessmentScore.objects.filter(student_id=student_id, term_id=term_id).select_related(
                "subject"
            )
        )
    total = Decimal("0")
    subject_count = 0
    subject_rows = []
    for s in scores:
        t = score_total(s)
        total += t
        if s.subject.subject_type == Subject.SubjectType.SUBJECT:
            subject_count += 1
        subject_rows.append(
            {
                "subject_id": s.subject_id,
                "subject_name": s.subject.name,
                "subject_type": s.subject.subject_type,
                "ca1": s.ca1,
                "ca2": s.ca2,
                "exam": s.exam,
                "total": t,
                "status": s.status,
            }
        )
    average = (total / subject_count) if subject_count else Decimal("0")
    return {
        "student_id": student_id,
        "term_id": term_id,
        "total": total,
        "average": average,
        "subject_count": subject_count,
        "subjects": subject_rows,
    }


def rank_class_arm(class_arm_id: int, term_id: int, published_only: bool = True):
    qs = AssessmentScore.objects.filter(class_arm_id=class_arm_id, term_id=term_id).select_related(
        "student", "subject"
    )
    if published_only:
        qs = qs.filter(status=AssessmentScore.Status.PUBLISHED)

    by_student = defaultdict(list)
    for score in qs:
        by_student[score.student_id].append(score)

    results = []
    for student_id, scores in by_student.items():
        computed = compute_student_result(student_id, term_id, scores)
        student = scores[0].student
        computed["student_name"] = student.full_name
        computed["student_code"] = student.student_id
        results.append(computed)

    results.sort(key=lambda r: r["total"], reverse=True)

    # Shared rank, next skipped (1, 2, 2, 4)
    position = 0
    last_total = None
    for index, row in enumerate(results, start=1):
        if last_total is None or row["total"] != last_total:
            position = index
            last_total = row["total"]
        row["position"] = position
    return results


def build_general_report(class_arm_id: int, term_id: int, published_only: bool = True):
    """Matrix report for General Report Sheet: all students × class subjects."""
    from academics.models import ClassArm, Term

    class_arm = (
        ClassArm.objects.select_related("class_level").filter(id=class_arm_id).first()
    )
    term = Term.objects.select_related("session").filter(id=term_id).first()
    if not class_arm or not term:
        return None

    subjects = class_subjects_for_arm(class_arm)
    students = list(
        StudentProfile.objects.filter(class_arm_id=class_arm_id, is_active=True)
        .order_by("full_name")
        .only("id", "full_name", "student_id")
    )

    qs = AssessmentScore.objects.filter(
        class_arm_id=class_arm_id, term_id=term_id
    ).select_related("subject")
    if published_only:
        qs = qs.filter(status=AssessmentScore.Status.PUBLISHED)

    scores_by_student: dict[int, dict[int, dict]] = defaultdict(dict)
    for score in qs:
        scores_by_student[score.student_id][score.subject_id] = {
            "ca1": float(score.ca1 or 0),
            "ca2": float(score.ca2 or 0),
            "exam": float(score.exam or 0),
            "total": float(score_total(score)),
            "status": score.status,
        }

    subject_count = len(subjects)
    rows = []
    for student in students:
        by_subject = scores_by_student.get(student.id, {})
        total = Decimal("0")
        cells: dict[str, dict] = {}
        for subject in subjects:
            cell = by_subject.get(subject.id)
            if cell:
                total += Decimal(str(cell["total"]))
                cells[str(subject.id)] = cell
            else:
                cells[str(subject.id)] = {
                    "ca1": 0,
                    "ca2": 0,
                    "exam": 0,
                    "total": 0,
                    "status": None,
                }
        average = (total / subject_count) if subject_count else Decimal("0")
        rows.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "student_code": student.student_id,
                "total": float(total),
                "average": float(round(average, 2)),
                "by_subject": cells,
            }
        )

    rows.sort(key=lambda r: (-r["total"], r["student_name"]))
    position = 0
    last_total = None
    for index, row in enumerate(rows, start=1):
        if last_total is None or row["total"] != last_total:
            position = index
            last_total = row["total"]
        row["position"] = position

    return {
        "session": {"id": term.session_id, "name": term.session.name},
        "term": {"id": term.id, "name": term.name, "number": term.number},
        "class_level": {
            "id": class_arm.class_level_id,
            "name": class_arm.class_level.name,
        },
        "class_arm": {
            "id": class_arm.id,
            "name": class_arm.name,
            "label": class_arm.label or str(class_arm),
        },
        "subjects": [{"id": s.id, "name": s.name} for s in subjects],
        "rows": rows,
    }
