from django.conf import settings
from django.db import models


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
    ca1 = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    ca2 = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    exam = models.DecimalField(max_digits=5, decimal_places=2, default=0)
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
    punctuality = models.PositiveSmallIntegerField(null=True, blank=True)
    neatness = models.PositiveSmallIntegerField(null=True, blank=True)
    politeness = models.PositiveSmallIntegerField(null=True, blank=True)
    honesty = models.PositiveSmallIntegerField(null=True, blank=True)
    cooperation = models.PositiveSmallIntegerField(null=True, blank=True)
    leadership = models.PositiveSmallIntegerField(null=True, blank=True)
    handwriting = models.PositiveSmallIntegerField(null=True, blank=True)
    sports = models.PositiveSmallIntegerField(null=True, blank=True)
    tool_handling = models.PositiveSmallIntegerField(null=True, blank=True)
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
