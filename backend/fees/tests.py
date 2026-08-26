"""Paystack checkout, webhook, and dedicated virtual accounts."""

import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import AccountType, ParentProfile, User
from accounts.tests_smoke import SchoolFixtureMixin
from fees.models import FeePaymentEntry, FeeRecord
from fees.paystack import apply_successful_charge, kobo_to_naira, naira_to_kobo


@override_settings(
    PAYSTACK_SECRET_KEY="sk_test_secret",
    PAYSTACK_PUBLIC_KEY="pk_test_public",
)
class PaystackFeeTests(SchoolFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.record = FeeRecord.objects.create(
            student=self.student,
            term=self.term,
            amount_due=Decimal("50000.00"),
            amount_paid=Decimal("0"),
        )
        self.parent_user = User.objects.create_user(
            email="parent.pay@example.com",
            password="ParentPass123!",
            username="parentpay",
            account_type=AccountType.PARENT,
            must_change_password=False,
        )
        self.parent = ParentProfile.objects.create(
            user=self.parent_user, full_name="Paying Parent"
        )
        self.parent.children.add(self.student)
        self.api = APIClient()

    def _sign(self, body: bytes) -> str:
        return hmac.new(b"sk_test_secret", body, hashlib.sha512).hexdigest()

    def test_naira_kobo_roundtrip(self):
        self.assertEqual(naira_to_kobo(Decimal("50000.00")), 5000000)
        self.assertEqual(kobo_to_naira(5000000), Decimal("50000.00"))

    def test_pay_requires_configuration(self):
        with override_settings(PAYSTACK_SECRET_KEY=""):
            self.api.force_authenticate(user=self.parent_user)
            res = self.api.post(f"/api/fee-records/{self.record.id}/pay/")
        self.assertEqual(res.status_code, 503)

    def test_parent_initializes_checkout_for_balance(self):
        self.api.force_authenticate(user=self.parent_user)

        def fake_request(method, path, payload=None):
            self.assertEqual(path, "/transaction/initialize")
            self.assertEqual(payload["amount"], 5000000)
            return {
                "status": True,
                "data": {
                    "authorization_url": "https://checkout.paystack.com/test",
                    "access_code": "acc_test",
                    "reference": payload["reference"],
                },
            }

        with patch("fees.paystack._request", side_effect=fake_request):
            res = self.api.post(f"/api/fee-records/{self.record.id}/pay/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["authorization_url"], "https://checkout.paystack.com/test")
        self.assertEqual(res.data["access_code"], "acc_test")

    def test_unrelated_user_cannot_pay(self):
        stranger = User.objects.create_user(
            email="stranger@example.com",
            password="Stranger123!",
            username="stranger",
            account_type=AccountType.PARENT,
        )
        ParentProfile.objects.create(user=stranger, full_name="Stranger")
        self.api.force_authenticate(user=stranger)
        res = self.api.post(f"/api/fee-records/{self.record.id}/pay/")
        self.assertEqual(res.status_code, 404)

    def test_webhook_credits_bill_and_unlocks_results(self):
        body = json.dumps(
            {
                "event": "charge.success",
                "data": {
                    "status": "success",
                    "reference": "PCS-wh-1",
                    "amount": 5000000,
                    "channel": "card",
                    "metadata": {"fee_record_id": self.record.id},
                },
            }
        ).encode()
        res = self.client.post(
            "/api/payments/paystack/webhook/",
            data=body,
            content_type="application/json",
            headers={"X-Paystack-Signature": self._sign(body)},
        )
        self.assertEqual(res.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.amount_paid, Decimal("50000.00"))
        self.assertEqual(self.record.status, FeeRecord.Status.PAID)
        self.assertTrue(self.record.results_unlocked)
        self.assertEqual(FeePaymentEntry.objects.filter(method="paystack").count(), 1)

        res2 = self.client.post(
            "/api/payments/paystack/webhook/",
            data=body,
            content_type="application/json",
            headers={"X-Paystack-Signature": self._sign(body)},
        )
        self.assertEqual(res2.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.amount_paid, Decimal("50000.00"))
        self.assertEqual(FeePaymentEntry.objects.filter(reference="PCS-wh-1").count(), 1)

    def test_invalid_webhook_signature_rejected(self):
        body = b'{"event":"charge.success","data":{}}'
        res = self.client.post(
            "/api/payments/paystack/webhook/",
            data=body,
            content_type="application/json",
            headers={"X-Paystack-Signature": "deadbeef"},
        )
        self.assertEqual(res.status_code, 400)
        self.record.refresh_from_db()
        self.assertEqual(self.record.amount_paid, Decimal("0"))

    def test_verify_endpoint_credits_once(self):
        self.api.force_authenticate(user=self.parent_user)

        def fake_request(method, path, payload=None):
            return {
                "status": True,
                "data": {
                    "status": "success",
                    "reference": "PCS-verify-1",
                    "amount": 5000000,
                    "channel": "card",
                    "metadata": {"fee_record_id": self.record.id},
                },
            }

        with patch("fees.paystack._request", side_effect=fake_request):
            res = self.api.post(
                "/api/fee-records/verify-paystack/",
                {"reference": "PCS-verify-1"},
                format="json",
            )
        self.assertEqual(res.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, FeeRecord.Status.PAID)

    def test_paid_bill_cannot_initialize(self):
        self.record.amount_paid = Decimal("50000")
        self.record.save()
        self.api.force_authenticate(user=self.parent_user)
        res = self.api.post(f"/api/fee-records/{self.record.id}/pay/")
        self.assertEqual(res.status_code, 400)

    def test_accountant_still_records_offline_payment(self):
        self.api.force_authenticate(user=self.admin)
        res = self.api.patch(
            f"/api/fee-records/{self.record.id}/",
            {
                "payment": {
                    "amount": "10000.00",
                    "method": "cash",
                    "reference": "CASH-1",
                    "note": "Walk-in",
                }
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.amount_paid, Decimal("10000.00"))
        self.assertEqual(self.record.status, FeeRecord.Status.PARTIAL)
        self.assertFalse(self.record.results_unlocked)

    def test_accountant_cannot_manually_post_paystack_method(self):
        self.api.force_authenticate(user=self.admin)
        res = self.api.patch(
            f"/api/fee-records/{self.record.id}/",
            {"payment": {"amount": "1000", "method": "paystack"}},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_virtual_account_assign_and_webhook_match(self):
        self.api.force_authenticate(user=self.parent_user)

        def fake_request(method, path, payload=None):
            if path == "/customer":
                return {"status": True, "data": {"customer_code": "CUS_TEST"}}
            if path == "/dedicated_account":
                return {
                    "status": True,
                    "data": {
                        "account_number": "0123456789",
                        "account_name": "PCIMS/PCS025999",
                        "bank": {"name": "Wema Bank"},
                    },
                }
            raise AssertionError(path)

        with patch("fees.paystack._request", side_effect=fake_request):
            res = self.api.post(f"/api/fee-records/{self.record.id}/virtual-account/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["virtual_account_number"], "0123456789")
        self.student.refresh_from_db()
        self.assertEqual(self.student.paystack_customer_code, "CUS_TEST")

        body = json.dumps(
            {
                "event": "charge.success",
                "data": {
                    "status": "success",
                    "reference": "PCS-dva-1",
                    "amount": 2000000,
                    "channel": "dedicated_nuban",
                    "customer": {"customer_code": "CUS_TEST"},
                    "authorization": {"receiver_bank_account_number": "0123456789"},
                },
            }
        ).encode()
        hook = self.client.post(
            "/api/payments/paystack/webhook/",
            data=body,
            content_type="application/json",
            headers={"X-Paystack-Signature": self._sign(body)},
        )
        self.assertEqual(hook.status_code, 200)
        self.record.refresh_from_db()
        self.assertEqual(self.record.amount_paid, Decimal("20000.00"))
        self.assertEqual(self.record.status, FeeRecord.Status.PARTIAL)

    def test_apply_charge_helper_skips_failed_status(self):
        record, created = apply_successful_charge(
            {"data": {"status": "failed", "reference": "x", "amount": 100}}
        )
        self.assertIsNone(record)
        self.assertFalse(created)
