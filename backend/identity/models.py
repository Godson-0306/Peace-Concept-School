from django.db import models


class StudentIdCard(models.Model):
    student = models.OneToOneField(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="id_card"
    )
    barcode_value = models.CharField(max_length=64)
    barcode_image = models.ImageField(upload_to="idcards/barcodes/", blank=True, null=True)
    qr_image = models.ImageField(upload_to="idcards/qr/", blank=True, null=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"ID Card — {self.student.student_id}"
