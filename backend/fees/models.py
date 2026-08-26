from django.conf import settings
from django.db import models

from .sections import FEE_SECTIONS


class FeeStructure(models.Model):
    """Per-session tuition rate for a school section and student type."""

    class StudentType(models.TextChoices):
        NEW = "new", "New Students"
        RETURNING = "returning", "Returning Students"

    session = models.ForeignKey(
        "academics.AcademicSession", on_delete=models.CASCADE, related_name="fee_structures"
    )
    section = models.CharField(max_length=16, choices=FEE_SECTIONS)
    student_type = models.CharField(max_length=16, choices=StudentType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("session", "section", "student_type")
        ordering = ["session", "section", "student_type"]

    def __str__(self):
        return f"{self.session} — {self.get_section_display()} — {self.get_student_type_display()}"


class FeeRecord(models.Model):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="fee_records"
    )
    term = models.ForeignKey("academics.Term", on_delete=models.CASCADE, related_name="fee_records")
    fee_structure = models.ForeignKey(
        FeeStructure, on_delete=models.SET_NULL, null=True, blank=True, related_name="records"
    )
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNPAID)
    # Once paid/unlocked for a term, results stay visible even if later unpaid elsewhere
    results_unlocked = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "term")
        ordering = ["student__full_name", "term_id"]

    def refresh_status(self):
        if self.amount_paid <= 0:
            self.status = self.Status.UNPAID
        elif self.amount_paid >= self.amount_due:
            self.status = self.Status.PAID
            self.results_unlocked = True
        else:
            self.status = self.Status.PARTIAL

    def save(self, *args, **kwargs):
        self.refresh_status()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.student_id} — {self.term} — {self.status}"


class FeePaymentEntry(models.Model):
    """Offline (accountant) or online (Paystack) payment against a bill."""

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        TRANSFER = "transfer", "Bank Transfer"
        POS = "pos", "POS"
        PAYSTACK = "paystack", "Paystack"
        OTHER = "other", "Other"

    fee_record = models.ForeignKey(FeeRecord, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.CASH)
    reference = models.CharField(max_length=120, blank=True)
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference"],
                condition=~models.Q(reference=""),
                name="uniq_fee_payment_reference",
            )
        ]
