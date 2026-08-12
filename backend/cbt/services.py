"""Normal CBT auto-marking and AssessmentScore write-back."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from assessments.models import AssessmentScore
from cbt.models import CbtAnswer, CbtAttempt, CbtPaper


COMPONENT_MAX = {
    CbtPaper.ScoreComponent.CA1: Decimal("20"),
    CbtPaper.ScoreComponent.CA2: Decimal("20"),
    CbtPaper.ScoreComponent.EXAM: Decimal("60"),
}


def paper_total_marks(paper: CbtPaper) -> Decimal:
    total = Decimal("0")
    for q in paper.questions.all():
        total += Decimal(q.marks)
    return total


def scale_score(earned: Decimal, total: Decimal, component: str) -> Decimal:
    cap = COMPONENT_MAX.get(component, Decimal("20"))
    if total <= 0:
        return Decimal("0")
    raw = (earned / total) * cap
    if raw < 0:
        raw = Decimal("0")
    if raw > cap:
        raw = cap
    return raw.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def attempt_deadline(attempt: CbtAttempt):
    return attempt.started_at + timedelta(minutes=attempt.paper.duration_minutes)


def is_attempt_expired(attempt: CbtAttempt, now=None) -> bool:
    now = now or timezone.now()
    return now > attempt_deadline(attempt)


@transaction.atomic
def score_attempt(attempt: CbtAttempt, *, force: bool = False) -> CbtAttempt:
    """
    Mark MCQ answers, scale into CA1/CA2/Exam cap, upsert AssessmentScore.
    """
    attempt = (
        CbtAttempt.objects.select_related(
            "paper", "paper__subject", "paper__class_arm", "paper__term", "student"
        )
        .prefetch_related("answers__selected_choice", "paper__questions__choices")
        .get(pk=attempt.pk)
    )
    if attempt.status == CbtAttempt.Status.SUBMITTED and not force:
        return attempt

    paper = attempt.paper
    earned = Decimal("0")
    total = Decimal("0")
    answers = {a.question_id: a for a in attempt.answers.all()}

    for question in paper.questions.all():
        total += Decimal(question.marks)
        answer = answers.get(question.id)
        if not answer or not answer.selected_choice_id:
            continue
        if answer.selected_choice and answer.selected_choice.is_correct:
            earned += Decimal(question.marks)

    scaled = scale_score(earned, total, paper.score_component)
    attempt.earned_marks = earned
    attempt.paper_total = total
    attempt.scaled_score = scaled
    attempt.status = CbtAttempt.Status.SUBMITTED
    attempt.submitted_at = timezone.now()
    attempt.written_to_results = False
    attempt.save(
        update_fields=[
            "earned_marks",
            "paper_total",
            "scaled_score",
            "status",
            "submitted_at",
            "written_to_results",
        ]
    )

    write_scaled_to_results(attempt)
    return attempt


@transaction.atomic
def write_scaled_to_results(attempt: CbtAttempt) -> AssessmentScore:
    paper = attempt.paper
    student = attempt.student
    field = paper.score_component
    defaults = {
        "class_arm": paper.class_arm,
        field: attempt.scaled_score,
        "entered_by": paper.created_by,
    }
    score, created = AssessmentScore.objects.get_or_create(
        student=student,
        subject=paper.subject,
        term=paper.term,
        defaults={
            "class_arm": paper.class_arm,
            "ca1": Decimal("0"),
            "ca2": Decimal("0"),
            "exam": Decimal("0"),
            field: attempt.scaled_score,
            "entered_by": paper.created_by,
            "status": AssessmentScore.Status.DRAFT,
        },
    )
    if not created:
        setattr(score, field, attempt.scaled_score)
        score.class_arm = paper.class_arm
        if paper.created_by_id:
            score.entered_by = paper.created_by
        score.save(update_fields=[field, "class_arm", "entered_by", "updated_at"])

    attempt.written_to_results = True
    attempt.save(update_fields=["written_to_results"])
    return score


@transaction.atomic
def submit_attempt(attempt: CbtAttempt, answers: list[dict]) -> CbtAttempt:
    """
    answers: [{question_id, choice_id}, ...]
    Allows submit after expiry (auto-submit path) but still marks whatever was sent.
    """
    if attempt.status == CbtAttempt.Status.SUBMITTED:
        raise ValueError("This attempt has already been submitted.")

    paper = attempt.paper
    question_ids = set(paper.questions.values_list("id", flat=True))
    for item in answers:
        qid = item.get("question_id") or item.get("question")
        cid = item.get("choice_id") or item.get("selected_choice")
        if qid not in question_ids:
            continue
        from cbt.models import CbtChoice

        choice_obj = None
        if cid:
            choice_obj = CbtChoice.objects.filter(id=cid, question_id=qid).first()
        CbtAnswer.objects.update_or_create(
            attempt=attempt,
            question_id=qid,
            defaults={"selected_choice": choice_obj},
        )

    return score_attempt(attempt)
