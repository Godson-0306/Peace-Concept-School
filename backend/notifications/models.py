from django.db import models


class NotificationLog(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        STUBBED = "stubbed", "Stubbed"

    channel = models.CharField(max_length=16, choices=Channel.choices)
    recipient = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    related_student_id = models.CharField(max_length=32, blank=True)
    term = models.ForeignKey(
        "academics.Term",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notification_logs",
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["related_student_id", "term", "channel", "status"],
                name="notificatio_related_idx",
            ),
        ]

    def __str__(self):
        return f"{self.channel} → {self.recipient} ({self.status})"
