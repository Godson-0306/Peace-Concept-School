from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


SCORE_FIELD_VALIDATORS = [MinValueValidator(0)]
CA_VALIDATORS = [MinValueValidator(0), MaxValueValidator(20)]
EXAM_VALIDATORS = [MinValueValidator(0), MaxValueValidator(60)]
FORM_RATING_VALIDATORS = [MinValueValidator(0), MaxValueValidator(5)]


class AssessmentScore(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="scores"
    )
    subject = models.ForeignKey("academics.Subject", on_delete=models.CASCADE, related_name="scores")
    term = models.ForeignKey("academics.Term", on_delete=models.CASCADE, related_name="scores")
    class_arm = models.ForeignKey(
        "academics.ClassArm", on_delete=models.CASCADE, related_name="scores"
    )
    ca1 = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=CA_VALIDATORS
    )
    ca2 = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=CA_VALIDATORS
    )
    exam = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, validators=EXAM_VALIDATORS
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entered_scores",
    )
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("student", "subject", "term")

    @property
    def total(self):
        return (self.ca1 or 0) + (self.ca2 or 0) + (self.exam or 0)

    def __str__(self):
        return f"{self.student.student_id} {self.subject.name} {self.term}"


class FormClassRecord(models.Model):
    class_arm = models.ForeignKey(
        "academics.ClassArm", on_delete=models.CASCADE, related_name="form_records"
    )
    term = models.ForeignKey("academics.Term", on_delete=models.CASCADE, related_name="form_records")
    number_in_class = models.PositiveIntegerField(default=0)
    date_of_resumption = models.DateField(null=True, blank=True)
    next_term_resumption = models.DateField(null=True, blank=True)
    days_opened = models.PositiveIntegerField(default=0)
    teacher_remark_template = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("class_arm", "term")


class StudentFormRecord(models.Model):
    """Form-class sheet: attendance, remark, and default affective/psychomotor ratings."""

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="form_records"
    )
    term = models.ForeignKey(
        "academics.Term", on_delete=models.CASCADE, related_name="student_form_records"
    )
    class_arm = models.ForeignKey("academics.ClassArm", on_delete=models.CASCADE)
    days_present = models.PositiveIntegerField(default=0)
    days_absent = models.PositiveIntegerField(default=0)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    teacher_remark = models.TextField(blank=True)
    # Default form-class assessments (used for all classes) — max 5
    reading = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    verbal_fluency = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    games = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    tool_handling = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    handwriting = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    leadership = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    punctuality = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    self_control = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    politeness = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    neatness = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    obedience = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    honesty = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    creativity = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    attentiveness = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    # Legacy aliases kept for older report code
    cooperation = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    sports = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=FORM_RATING_VALIDATORS
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "term")


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="attendance"
    )
    class_arm = models.ForeignKey(
        "academics.ClassArm", on_delete=models.CASCADE, related_name="attendance"
    )
    term = models.ForeignKey("academics.Term", on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PRESENT)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        unique_together = ("student", "date")
        ordering = ["-date"]
