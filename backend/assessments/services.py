from collections import defaultdict
from decimal import Decimal

from django.db.models import Prefetch

from academics.models import Subject
from assessments.models import AssessmentScore


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
