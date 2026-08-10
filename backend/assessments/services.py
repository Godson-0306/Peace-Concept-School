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
        ).only("id", "name")
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
