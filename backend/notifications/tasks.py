from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from assessments.models import AssessmentScore
from assessments.services import compute_student_result
from notifications.models import NotificationLog


def _send_email(recipient, subject, body, student_code=""):
    log = NotificationLog.objects.create(
        channel=NotificationLog.Channel.EMAIL,
        recipient=recipient,
        subject=subject,
        body=body,
        related_student_id=student_code,
        status=NotificationLog.Status.PENDING,
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [recipient], fail_silently=False)
        log.status = NotificationLog.Status.SENT
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "sent_at"])
    except Exception as exc:  # noqa: BLE001
        log.status = NotificationLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=["status", "error_message"])


def _send_whatsapp_stub(recipient, body, student_code=""):
    """WhatsApp Business API stub — logs only until credentials are wired."""
    NotificationLog.objects.create(
        channel=NotificationLog.Channel.WHATSAPP,
        recipient=recipient,
        subject="Results published",
        body=body,
        related_student_id=student_code,
        status=NotificationLog.Status.STUBBED,
        sent_at=timezone.now(),
    )


@shared_task
def notify_guardians_results_published(term_id: int, class_arm_id: int):
    scores = (
        AssessmentScore.objects.filter(
            term_id=term_id,
            class_arm_id=class_arm_id,
            status=AssessmentScore.Status.PUBLISHED,
        )
        .select_related("student")
        .distinct()
    )
    seen = set()
    for score in scores:
        student = score.student
        if student.id in seen:
            continue
        seen.add(student.id)
        result = compute_student_result(student.id, term_id)
        summary_lines = [
            f"{row['subject_name']}: {row['total']}" for row in result["subjects"][:12]
        ]
        body = (
            f"Dear Guardian,\n\n"
            f"Results for {student.full_name} ({student.student_id}) have been published.\n"
            f"Total: {result['total']} | Average: {result['average']:.2f}\n\n"
            + "\n".join(summary_lines)
            + "\n\nLog in to the Peace Concept School portal to view the full report "
            "(subject to fee clearance).\n\nPeace Concept School"
        )
        if student.guardian_email:
            _send_email(
                student.guardian_email,
                f"Results published — {student.full_name}",
                body,
                student.student_id,
            )
        if student.guardian_phone:
            _send_whatsapp_stub(student.guardian_phone, body, student.student_id)
    return {"notified_students": len(seen)}
