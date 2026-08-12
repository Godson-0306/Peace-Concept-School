from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from decimal import Decimal


class CbtPaper(models.Model):
    class PaperType(models.TextChoices):
        NORMAL = "normal", "Normal CBT"

    class ScoreComponent(models.TextChoices):
        CA1 = "ca1", "CA1"
        CA2 = "ca2", "CA2"
        EXAM = "exam", "Exam"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"

    title = models.CharField(max_length=255)
    paper_type = models.CharField(
        max_length=16, choices=PaperType.choices, default=PaperType.NORMAL
    )
    score_component = models.CharField(max_length=8, choices=ScoreComponent.choices)
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE, related_name="cbt_papers"
    )
    class_arm = models.ForeignKey(
        "academics.ClassArm", on_delete=models.CASCADE, related_name="cbt_papers"
    )
    term = models.ForeignKey(
        "academics.Term", on_delete=models.CASCADE, related_name="cbt_papers"
    )
    duration_minutes = models.PositiveIntegerField(default=30)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cbt_papers_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_score_component_display()})"

    @property
    def component_max(self) -> int:
        if self.score_component == self.ScoreComponent.EXAM:
            return 60
        return 20


class CbtQuestion(models.Model):
    paper = models.ForeignKey(CbtPaper, on_delete=models.CASCADE, related_name="questions")
    prompt = models.TextField()
    order = models.PositiveSmallIntegerField(default=1)
    marks = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=1,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("paper", "order")

    def __str__(self):
        return f"Q{self.order}: {self.prompt[:40]}"


class CbtChoice(models.Model):
    class Label(models.TextChoices):
        A = "A", "A"
        B = "B", "B"
        C = "C", "C"
        D = "D", "D"

    question = models.ForeignKey(
        CbtQuestion, on_delete=models.CASCADE, related_name="choices"
    )
    label = models.CharField(max_length=1, choices=Label.choices)
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["label"]
        unique_together = ("question", "label")

    def __str__(self):
        return f"{self.label}. {self.text[:40]}"


class CbtAttempt(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        SUBMITTED = "submitted", "Submitted"

    paper = models.ForeignKey(CbtPaper, on_delete=models.CASCADE, related_name="attempts")
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="cbt_attempts"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    earned_marks = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    paper_total = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    scaled_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.IN_PROGRESS
    )
    written_to_results = models.BooleanField(default=False)

    class Meta:
        unique_together = ("paper", "student")
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.student.student_id} → {self.paper.title}"


class CbtAnswer(models.Model):
    attempt = models.ForeignKey(
        CbtAttempt, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(
        CbtQuestion, on_delete=models.CASCADE, related_name="answers"
    )
    selected_choice = models.ForeignKey(
        CbtChoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="selections",
    )

    class Meta:
        unique_together = ("attempt", "question")


class JambAttempt(models.Model):
    """
    Placeholder progress row for the external JAMB CBT module.
    Scores stay here for student progress monitoring only — never write to AssessmentScore.
    """

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="jamb_attempts"
    )
    title = models.CharField(max_length=255, blank=True, default="JAMB Practice")
    score_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    subjects_json = models.JSONField(default=list, blank=True)
    taken_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(
        max_length=64,
        blank=True,
        default="pending_integration",
        help_text="Filled when the external JAMB CBT repo is wired in.",
    )
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-taken_at"]

    def __str__(self):
        return f"{self.student.student_id} JAMB {self.score_percent}%"
