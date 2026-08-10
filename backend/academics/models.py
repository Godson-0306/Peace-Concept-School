from django.conf import settings
from django.db import models, transaction


class AcademicSession(models.Model):
    name = models.CharField(max_length=32, unique=True)  # e.g. 2025/2026
    start_year = models.PositiveIntegerField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_year"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_active:
            AcademicSession.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class Term(models.Model):
    class TermNumber(models.IntegerChoices):
        FIRST = 1, "1st Term"
        SECOND = 2, "2nd Term"
        THIRD = 3, "3rd Term"

    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE, related_name="terms")
    number = models.PositiveSmallIntegerField(choices=TermNumber.choices)
    name = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=False)
    results_entry_open = models.BooleanField(
        default=False,
        help_text="When true, teachers may enter and edit scores for this term.",
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    next_term_resumption = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("session", "number")
        ordering = ["session", "number"]

    def __str__(self):
        return f"{self.session.name} — {self.get_number_display()}"

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = self.get_number_display()
        if self.is_active:
            Term.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class ClassLevel(models.Model):
    name = models.CharField(max_length=32, unique=True)  # JSS1, SSS2
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class ClassArm(models.Model):
    class_level = models.ForeignKey(ClassLevel, on_delete=models.CASCADE, related_name="arms")
    name = models.CharField(max_length=8)  # A, B
    label = models.CharField(max_length=32, blank=True)  # JSS1A

    class Meta:
        unique_together = ("class_level", "name")
        ordering = ["class_level__order", "name"]

    def __str__(self):
        return self.label or f"{self.class_level.name}{self.name}"

    def save(self, *args, **kwargs):
        if not self.label:
            self.label = f"{self.class_level.name}{self.name}"
        super().save(*args, **kwargs)


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Subject(models.Model):
    class SubjectType(models.TextChoices):
        SUBJECT = "subject", "Subject"
        ADDITIONAL = "additional_assessment", "Additional Assessment"

    name = models.CharField(max_length=120)
    code = models.CharField(max_length=32, blank=True)
    class_level = models.ForeignKey(ClassLevel, on_delete=models.CASCADE, related_name="subjects")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="subjects"
    )
    subject_type = models.CharField(
        max_length=32, choices=SubjectType.choices, default=SubjectType.SUBJECT
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("name", "class_level")
        ordering = ["class_level__order", "name"]

    def __str__(self):
        return f"{self.name} ({self.class_level.name})"


class TeacherAssignment(models.Model):
    staff = models.ForeignKey(
        "accounts.StaffProfile", on_delete=models.CASCADE, related_name="assignments"
    )
    class_arm = models.ForeignKey(ClassArm, on_delete=models.CASCADE, related_name="teacher_assignments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="teacher_assignments")
    session = models.ForeignKey(
        AcademicSession, on_delete=models.CASCADE, related_name="teacher_assignments"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("staff", "class_arm", "subject", "session")
        ordering = ["staff__full_name", "class_arm__label", "subject__name"]

    def __str__(self):
        return f"{self.staff.full_name} → {self.class_arm} / {self.subject.name}"


class StudentIdSequence(models.Model):
    admission_year = models.PositiveIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    @classmethod
    def next_student_id(cls, admission_year: int) -> str:
        prefix = getattr(settings, "SCHOOL_STUDENT_ID_PREFIX", "PCS")
        yy = f"{admission_year % 100:02d}"
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(
                admission_year=admission_year,
                defaults={"last_number": 0},
            )
            seq.last_number += 1
            seq.save(update_fields=["last_number"])
            return f"{prefix}0{yy}{seq.last_number:03d}"
