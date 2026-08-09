from django.conf import settings
from django.db import models


class FeeStructure(models.Model):
    name = models.CharField(max_length=120)
    session = models.ForeignKey(
        "academics.AcademicSession", on_delete=models.CASCADE, related_name="fee_structures"
    )
    term = models.ForeignKey("academics.Term", on_delete=models.CASCADE, related_name="fee_structures")
    class_level = models.ForeignKey(
        "academics.ClassLevel", on_delete=models.CASCADE, related_name="fee_structures"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "term", "class_level")

    def __str__(self):
        return f"{self.name} — {self.class_level} — {self.term}"


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
    """Manual offline payment recorded by Accountant."""

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        TRANSFER = "transfer", "Bank Transfer"
        POS = "pos", "POS"
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
