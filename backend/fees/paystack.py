"""Paystack Checkout + Dedicated Virtual Accounts for school fees."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from decimal import ROUND_HALF_UP, Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction

from .models import FeePaymentEntry, FeeRecord

logger = logging.getLogger(__name__)

PAYSTACK_API = "https://api.paystack.co"
FEES_EMAIL_DOMAIN = "fees.peaceconceptschool.ng"


class PaystackError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def paystack_configured() -> bool:
    return bool((getattr(settings, "PAYSTACK_SECRET_KEY", None) or "").strip())


def paystack_public_key() -> str:
    return (getattr(settings, "PAYSTACK_PUBLIC_KEY", None) or "").strip()


def _secret() -> str:
    webhook = (getattr(settings, "PAYSTACK_WEBHOOK_SECRET", None) or "").strip()
    if webhook:
        return webhook
    return (getattr(settings, "PAYSTACK_SECRET_KEY", None) or "").strip()


def naira_to_kobo(amount: Decimal) -> int:
    kobo = (Decimal(amount) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(kobo)


def kobo_to_naira(kobo: int) -> Decimal:
    return (Decimal(kobo) / Decimal("100")).quantize(Decimal("0.01"))


def verify_signature(raw_body: bytes, signature: str) -> bool:
    secret = _secret()
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(digest, signature)


def _request(method: str, path: str, payload: dict | None = None) -> dict:
    if not paystack_configured():
        raise PaystackError("Online payments are not configured.", status=503)
    url = f"{PAYSTACK_API}{path}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=body, method=method)
    request.add_header("Authorization", f"Bearer {settings.PAYSTACK_SECRET_KEY.strip()}")
    request.add_header("Content-Type", "application/json")
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        raw = exc.read().decode("utf-8") if exc.fp else ""
        message = _error_message(raw) or f"Paystack HTTP {exc.code}"
        raise PaystackError(message, status=502) from exc
    except URLError as exc:
        raise PaystackError("Could not reach Paystack.", status=502) from exc
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise PaystackError("Invalid Paystack response.", status=502) from exc
    if not data.get("status"):
        raise PaystackError(data.get("message") or "Paystack request failed.", status=502)
    return data


def _error_message(raw: str) -> str:
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return raw[:240]
    if isinstance(data, dict):
        return str(data.get("message") or "")[:240]
    return ""


def new_reference(fee_record_id: int) -> str:
    return f"PCS-{fee_record_id}-{uuid.uuid4().hex[:12]}"


def checkout_email(user, student) -> str:
    from notifications.recipients import is_placeholder_email

    for raw in (
        getattr(user, "email", "") or "",
        getattr(student, "guardian_email", "") or "",
        getattr(student, "email", "") or "",
    ):
        email = raw.strip()
        if email and "@" in email and not is_placeholder_email(email):
            return email
    return f"{student.student_id.lower()}@{FEES_EMAIL_DOMAIN}"


def initialize_transaction(*, email: str, amount_kobo: int, reference: str, callback_url: str, metadata: dict) -> dict:
    payload = {
        "email": email,
        "amount": amount_kobo,
        "currency": "NGN",
        "reference": reference,
        "callback_url": callback_url,
        "metadata": metadata,
        "channels": ["card", "bank", "ussd", "bank_transfer", "qr"],
    }
    data = _request("POST", "/transaction/initialize", payload)
    return data.get("data") or {}


def verify_transaction(reference: str) -> dict:
    data = _request("GET", f"/transaction/verify/{reference}")
    return data.get("data") or {}


def outstanding_fee_record(student) -> FeeRecord | None:
    from academics.models import Term

    qs = FeeRecord.objects.filter(student=student)
    unpaid = qs.exclude(status=FeeRecord.Status.PAID)
    active_term = Term.objects.filter(is_active=True).order_by("-id").first()
    if active_term:
        match = unpaid.filter(term=active_term).first()
        if match:
            return match
    match = unpaid.order_by("term_id").first()
    if match:
        return match
    return qs.order_by("-id").first()


def resolve_fee_record(payload: dict) -> FeeRecord | None:
    data = payload.get("data") or payload
    metadata = data.get("metadata") or {}
    record_id = metadata.get("fee_record_id")
    if record_id:
        return FeeRecord.objects.select_related("student").filter(id=record_id).first()

    from accounts.models import StudentProfile

    customer = data.get("customer") or {}
    customer_code = customer.get("customer_code") or ""
    if customer_code:
        student = StudentProfile.objects.filter(paystack_customer_code=customer_code).first()
        if student:
            return outstanding_fee_record(student)

    authorization = data.get("authorization") or {}
    account_number = (
        authorization.get("receiver_bank_account_number")
        or authorization.get("account_number")
        or (data.get("dedicated_account") or {}).get("account_number")
        or ""
    )
    if account_number:
        student = StudentProfile.objects.filter(paystack_account_number=account_number).first()
        if student:
            return outstanding_fee_record(student)
    return None


@transaction.atomic
def credit_paystack_payment(*, reference: str, amount: Decimal, fee_record: FeeRecord, note: str = "") -> tuple[FeeRecord, bool]:
    reference = (reference or "").strip()
    if not reference:
        raise PaystackError("Missing Paystack reference.", status=400)
    locked = FeeRecord.objects.select_for_update().get(pk=fee_record.pk)
    existing = (
        FeePaymentEntry.objects.select_for_update()
        .filter(reference=reference)
        .first()
    )
    if existing:
        return existing.fee_record, False
    FeePaymentEntry.objects.create(
        fee_record=locked,
        amount=amount,
        method=FeePaymentEntry.Method.PAYSTACK,
        reference=reference,
        note=note or "Paystack",
    )
    locked.amount_paid = (locked.amount_paid or Decimal("0")) + amount
    locked.save()
    return locked, True


def apply_successful_charge(payload: dict) -> tuple[FeeRecord | None, bool]:
    data = payload.get("data") or payload
    status = (data.get("status") or "").lower()
    if status not in ("success", "successful"):
        return None, False
    reference = data.get("reference") or ""
    amount = kobo_to_naira(int(data.get("amount") or 0))
    if amount <= 0 or not reference:
        return None, False
    record = resolve_fee_record(payload)
    if record is None:
        logger.warning("Paystack charge %s did not match a fee record", reference)
        return None, False
    return credit_paystack_payment(
        reference=reference,
        amount=amount,
        fee_record=record,
        note=f"Paystack {(data.get('channel') or 'checkout')}",
    )


def customer_email_for(student) -> str:
    return f"{student.student_id.lower()}@{FEES_EMAIL_DOMAIN}"


def ensure_dedicated_account(student) -> dict:
    """Create or reuse a Paystack dedicated NUBAN for this student."""
    if student.paystack_account_number and student.paystack_account_bank:
        return {
            "account_number": student.paystack_account_number,
            "account_bank": student.paystack_account_bank,
            "account_name": student.paystack_account_name,
        }
    if not paystack_configured():
        raise PaystackError("Online payments are not configured.", status=503)

    customer_code = student.paystack_customer_code
    if not customer_code:
        parts = (student.full_name or student.student_id).strip().split(None, 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else student.student_id
        try:
            created = _request(
                "POST",
                "/customer",
                {
                    "email": customer_email_for(student),
                    "first_name": first[:50],
                    "last_name": last[:50],
                    "metadata": {"student_id": student.student_id},
                },
            )
            customer_code = (created.get("data") or {}).get("customer_code") or ""
        except PaystackError:
            fetched = _request("GET", f"/customer/{customer_email_for(student)}")
            customer_code = (fetched.get("data") or {}).get("customer_code") or ""
        if not customer_code:
            raise PaystackError("Could not create Paystack customer.", status=502)
        student.paystack_customer_code = customer_code

    bank = (getattr(settings, "PAYSTACK_DVA_BANK", None) or "wema-bank").strip()
    assigned = _request(
        "POST",
        "/dedicated_account",
        {
            "customer": customer_code,
            "preferred_bank": bank,
        },
    )
    info = assigned.get("data") or {}
    bank_info = info.get("bank") or {}
    student.paystack_account_number = info.get("account_number") or ""
    student.paystack_account_bank = bank_info.get("name") or bank
    student.paystack_account_name = info.get("account_name") or ""
    if not student.paystack_account_number:
        raise PaystackError("Paystack did not return a virtual account number.", status=502)
    student.save(
        update_fields=[
            "paystack_customer_code",
            "paystack_account_number",
            "paystack_account_bank",
            "paystack_account_name",
        ]
    )
    return {
        "account_number": student.paystack_account_number,
        "account_bank": student.paystack_account_bank,
        "account_name": student.paystack_account_name,
    }
