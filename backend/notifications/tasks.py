from __future__ import annotations

import json
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from assessments.models import AssessmentScore
from assessments.services import compute_student_result
from notifications.models import NotificationLog
from notifications.recipients import guardian_emails, guardian_whatsapp_numbers

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
_DONE_STATUSES = (
    NotificationLog.Status.SENT,
    NotificationLog.Status.STUBBED,
)

_http = None


def _pool():
    global _http
    if _http is None:
        import urllib3

        _http = urllib3.PoolManager()
    return _http


def _frontend_url() -> str:
    return (getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000").rstrip("/")


def _portal_login_url() -> str:
    return f"{_frontend_url()}/login?portal=parent"


def _term_label(term) -> str:
    name = (getattr(term, "name", None) or "").strip()
    if name:
        return name
    number = getattr(term, "number", None)
    if number:
        return f"Term {number}"
    return str(term)


def _whatsapp_configured() -> bool:
    token = (getattr(settings, "WHATSAPP_TOKEN", None) or "").strip()
    phone_id = (getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", None) or "").strip()
    return bool(token and phone_id)


def _channel_already_sent(student_code: str, term_id: int, channel: str) -> bool:
    return NotificationLog.objects.filter(
        related_student_id=student_code,
        term_id=term_id,
        channel=channel,
        status__in=_DONE_STATUSES,
    ).exists()


def _template_text(value) -> str:
    text = " ".join(str(value if value is not None else "").split())
    return (text[:1024] if text else "-")


def _build_body(student, term, result, *, unlocked: bool) -> str:
    summary_lines = [f"{row['subject_name']}: {row['total']}" for row in result["subjects"][:12]]
    school = getattr(settings, "SCHOOL_NAME", "Peace Concept International Mission Schools")
    fee_note = (
        "The full report card is attached. You can also view it on the portal."
        if unlocked
        else (
            "The full report card will be available on the portal after fees are cleared. "
            "This message is a summary only."
        )
    )
    dva_lines = ""
    number = (getattr(student, "paystack_account_number", None) or "").strip()
    if number:
        bank = (getattr(student, "paystack_account_bank", None) or "Wema Bank").strip()
        name = (getattr(student, "paystack_account_name", None) or "").strip()
        dva_lines = (
            f"\nPay fees by bank transfer:\n"
            f"Bank: {bank}\n"
            f"Account number: {number}\n"
            + (f"Account name: {name}\n" if name else "")
        )
    return (
        f"Dear Guardian,\n\n"
        f"Results for {student.full_name} ({student.student_id}) have been published.\n"
        f"Term: {_term_label(term)}\n"
        f"Total: {result['total']} | Average: {result['average']:.2f}\n\n"
        + "\n".join(summary_lines)
        + f"\n\n{fee_note}\n"
        f"{dva_lines}"
        f"Portal: {_portal_login_url()}\n\n"
        f"{school}"
    )


def _report_pdf_bytes(student, term) -> bytes | None:
    from identity.services import build_report_card_pdf

    try:
        return build_report_card_pdf(student, term)
    except Exception:
        logger.exception(
            "Report PDF failed for %s term %s",
            getattr(student, "student_id", student),
            getattr(term, "id", term),
        )
        return None


def _finish_log(log, *, status, error=""):
    log.status = status
    log.error_message = error
    if status in (NotificationLog.Status.SENT, NotificationLog.Status.STUBBED):
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "error_message", "sent_at"])
    else:
        log.save(update_fields=["status", "error_message"])


def _send_email(recipient, subject, body, student_code, term, pdf_bytes=None, pdf_name=""):
    log = NotificationLog.objects.create(
        channel=NotificationLog.Channel.EMAIL,
        recipient=recipient,
        subject=subject,
        body=body,
        related_student_id=student_code,
        term=term,
        status=NotificationLog.Status.PENDING,
    )
    try:
        message = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        if pdf_bytes:
            message.attach(pdf_name or "report-card.pdf", pdf_bytes, "application/pdf")
        message.send(fail_silently=False)
        _finish_log(log, status=NotificationLog.Status.SENT)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Email failed for %s", recipient)
        _finish_log(log, status=NotificationLog.Status.FAILED, error=str(exc))


def _graph_json(method: str, url: str, *, token: str, json_body=None, fields=None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    kwargs = {"headers": headers, "timeout": 30.0}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
        kwargs["body"] = json.dumps(json_body).encode("utf-8")
    if fields is not None:
        kwargs["fields"] = fields
    response = _pool().request(method, url, **kwargs)
    raw = response.data.decode("utf-8") if response.data else "{}"
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {"error": {"message": raw or f"HTTP {response.status}"}}
    if response.status >= 400:
        err = data.get("error") if isinstance(data, dict) else None
        message = (err or {}).get("message") if isinstance(err, dict) else None
        raise RuntimeError(message or f"Graph HTTP {response.status}")
    return data if isinstance(data, dict) else {}


def _whatsapp_media_id(pdf_bytes: bytes, filename: str) -> str:
    token = settings.WHATSAPP_TOKEN.strip()
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_id}/media"
    data = _graph_json(
        "POST",
        url,
        token=token,
        fields={
            "messaging_product": "whatsapp",
            "type": "application/pdf",
            "file": (filename, pdf_bytes, "application/pdf"),
        },
    )
    media_id = data.get("id") or ""
    if not media_id:
        raise RuntimeError("WhatsApp media upload returned no id")
    return media_id


def _whatsapp_send_template(to: str, student, term, result, media_id: str | None, filename: str):
    token = settings.WHATSAPP_TOKEN.strip()
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    template_name = (getattr(settings, "WHATSAPP_TEMPLATE_NAME", None) or "results_published").strip()
    lang = (getattr(settings, "WHATSAPP_TEMPLATE_LANG", None) or "en").strip() or "en"
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_id}/messages"
    body_params = [
        {"type": "text", "text": _template_text(student.full_name)},
        {"type": "text", "text": _template_text(student.student_id)},
        {"type": "text", "text": _template_text(_term_label(term))},
        {"type": "text", "text": _template_text(result["total"])},
        {"type": "text", "text": _template_text(f"{result['average']:.2f}")},
        {"type": "text", "text": _template_text(_portal_login_url())},
    ]
    components = [{"type": "body", "parameters": body_params}]
    if media_id:
        components.insert(
            0,
            {
                "type": "header",
                "parameters": [
                    {
                        "type": "document",
                        "document": {"id": media_id, "filename": filename},
                    }
                ],
            },
        )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
            "components": components,
        },
    }
    try:
        _graph_json("POST", url, token=token, json_body=payload)
        return
    except RuntimeError:
        if not media_id:
            raise
        payload["template"]["components"] = [{"type": "body", "parameters": body_params}]
        _graph_json("POST", url, token=token, json_body=payload)
        _graph_json(
            "POST",
            url,
            token=token,
            json_body={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "document",
                "document": {
                    "id": media_id,
                    "filename": filename,
                    "caption": f"Report card — {student.full_name}",
                },
            },
        )


def _send_whatsapp(
    recipient,
    body,
    student,
    term,
    result,
    pdf_bytes=None,
    pdf_name="",
    media_id=None,
):
    student_code = student.student_id
    log = NotificationLog.objects.create(
        channel=NotificationLog.Channel.WHATSAPP,
        recipient=recipient,
        subject="Results published",
        body=body,
        related_student_id=student_code,
        term=term,
        status=NotificationLog.Status.PENDING,
    )
    if not _whatsapp_configured():
        _finish_log(log, status=NotificationLog.Status.STUBBED)
        return
    try:
        filename = pdf_name or f"{student_code}-report.pdf"
        if pdf_bytes and not media_id:
            media_id = _whatsapp_media_id(pdf_bytes, filename)
        _whatsapp_send_template(recipient, student, term, result, media_id, filename)
        _finish_log(log, status=NotificationLog.Status.SENT)
    except Exception as exc:  # noqa: BLE001
        logger.exception("WhatsApp failed for %s", recipient)
        _finish_log(log, status=NotificationLog.Status.FAILED, error=str(exc))


@shared_task
def notify_guardians_results_published(term_id: int, class_arm_id: int):
    from academics.models import Term
    from accounts.models import StudentProfile
    from assessments.views import results_visible_for_student

    term = Term.objects.select_related("session").filter(id=term_id).first()
    if term is None:
        return {"notified_students": 0, "error": "term_not_found"}

    student_ids = (
        AssessmentScore.objects.filter(
            term_id=term_id,
            class_arm_id=class_arm_id,
            status=AssessmentScore.Status.PUBLISHED,
        )
        .values_list("student_id", flat=True)
        .distinct()
    )

    students = StudentProfile.objects.filter(id__in=student_ids).prefetch_related("parents__user")
    notified = 0
    for student in students:
        result = compute_student_result(student.id, term_id)
        unlocked = results_visible_for_student(student, term)
        pdf_bytes = _report_pdf_bytes(student, term) if unlocked else None
        pdf_name = f"{student.student_id}-report-card.pdf"
        body = _build_body(student, term, result, unlocked=unlocked)
        subject = f"Results published — {student.full_name}"

        emails = guardian_emails(student)
        if emails and not _channel_already_sent(
            student.student_id, term_id, NotificationLog.Channel.EMAIL
        ):
            for email in emails:
                try:
                    _send_email(
                        email,
                        subject,
                        body,
                        student.student_id,
                        term,
                        pdf_bytes=pdf_bytes,
                        pdf_name=pdf_name,
                    )
                except Exception:  # noqa: BLE001
                    logger.exception("Email send crashed for %s", email)

        numbers = guardian_whatsapp_numbers(student)
        if numbers and not _channel_already_sent(
            student.student_id, term_id, NotificationLog.Channel.WHATSAPP
        ):
            media_id = None
            if pdf_bytes and _whatsapp_configured():
                try:
                    media_id = _whatsapp_media_id(pdf_bytes, pdf_name)
                except Exception:  # noqa: BLE001
                    logger.exception("WhatsApp media upload failed for %s", student.student_id)
            for number in numbers:
                try:
                    _send_whatsapp(
                        number,
                        body,
                        student,
                        term,
                        result,
                        pdf_bytes=None,
                        pdf_name=pdf_name,
                        media_id=media_id,
                    )
                except Exception:  # noqa: BLE001
                    logger.exception("WhatsApp send crashed for %s", number)

        if emails or numbers:
            notified += 1
    return {"notified_students": notified}
