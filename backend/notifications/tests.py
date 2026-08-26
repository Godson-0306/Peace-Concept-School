"""Guardian result-publish notices: recipients, email PDF, WhatsApp Graph."""

from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings

from accounts.models import AccountType, ParentProfile, User
from accounts.tests_smoke import SchoolFixtureMixin
from assessments.models import AssessmentScore
from fees.models import FeeRecord, FeeStructure
from notifications.models import NotificationLog
from notifications.recipients import guardian_emails, guardian_whatsapp_numbers, to_e164_ng
from notifications.tasks import notify_guardians_results_published


class RecipientHelperTests(TestCase):
    def test_to_e164_ng_normalizes_local_numbers(self):
        self.assertEqual(to_e164_ng("08012345678"), "2348012345678")
        self.assertEqual(to_e164_ng("+234 801 234 5678"), "2348012345678")
        self.assertEqual(to_e164_ng("8012345678"), "2348012345678")
        self.assertEqual(to_e164_ng(""), "")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class NotifyGuardiansTests(SchoolFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.student.guardian_email = "guardian@example.com"
        self.student.guardian_phone = "08012345678"
        self.student.whatsapp_phone = "+2348012345678"
        self.student.father_whatsapp = "08099990000"
        self.student.save()
        AssessmentScore.objects.create(
            student=self.student,
            subject=self.subject,
            term=self.term,
            class_arm=self.arm,
            ca1=Decimal("15"),
            ca2=Decimal("15"),
            exam=Decimal("50"),
            status=AssessmentScore.Status.PUBLISHED,
        )

    def _run(self):
        return notify_guardians_results_published(self.term.id, self.arm.id)

    def test_collects_emails_and_whatsapp_numbers(self):
        parent_user = User.objects.create_user(
            email="parent.real@example.com",
            password="ParentPass123!",
            username="parent1",
            account_type=AccountType.PARENT,
        )
        placeholder_user = User.objects.create_user(
            email="pcs025999@parents.peaceconceptschool.ng",
            password="ParentPass123!",
            username="parent2",
            account_type=AccountType.PARENT,
        )
        ParentProfile.objects.create(user=parent_user, full_name="Real Parent").children.add(
            self.student
        )
        ParentProfile.objects.create(
            user=placeholder_user, full_name="Placeholder Parent"
        ).children.add(self.student)

        emails = guardian_emails(self.student)
        self.assertEqual(emails, ["guardian@example.com", "parent.real@example.com"])
        numbers = guardian_whatsapp_numbers(self.student)
        self.assertEqual(numbers, ["2348012345678", "2348099990000"])

    def test_email_attaches_pdf_when_unlocked(self):
        with patch(
            "notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake"
        ) as pdf:
            self._run()
        pdf.assert_called_once()
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["guardian@example.com"])
        self.assertTrue(message.attachments)
        self.assertEqual(message.attachments[0][2], "application/pdf")
        log = NotificationLog.objects.get(channel=NotificationLog.Channel.EMAIL)
        self.assertEqual(log.status, NotificationLog.Status.SENT)
        self.assertEqual(log.term_id, self.term.id)
        self.assertIn("attached", message.body.lower())

    def test_locked_fees_sends_summary_without_pdf(self):
        structure = FeeStructure.objects.create(
            session=self.session,
            section="jss",
            student_type="new",
            amount=Decimal("50000"),
        )
        FeeRecord.objects.create(
            student=self.student,
            term=self.term,
            fee_structure=structure,
            amount_due=Decimal("50000"),
            amount_paid=Decimal("0"),
            results_unlocked=False,
        )
        with patch("notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake") as pdf:
            self._run()
        pdf.assert_not_called()
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(mail.outbox[0].attachments)
        self.assertIn("after fees are cleared", mail.outbox[0].body)

    def test_notice_includes_virtual_account(self):
        self.student.paystack_account_number = "0123456789"
        self.student.paystack_account_bank = "Wema Bank"
        self.student.paystack_account_name = "PCIMS/PCS025999"
        self.student.save()
        with patch("notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake"):
            self._run()
        self.assertIn("0123456789", mail.outbox[0].body)
        self.assertIn("Wema Bank", mail.outbox[0].body)

    def test_whatsapp_stubs_without_credentials(self):
        with patch("notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake"):
            self._run()
        logs = NotificationLog.objects.filter(channel=NotificationLog.Channel.WHATSAPP)
        self.assertEqual(logs.count(), 2)
        self.assertTrue(all(log.status == NotificationLog.Status.STUBBED for log in logs))
        self.assertEqual({log.recipient for log in logs}, {"2348012345678", "2348099990000"})

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        WHATSAPP_TOKEN="test-token",
        WHATSAPP_PHONE_NUMBER_ID="123456",
        WHATSAPP_TEMPLATE_NAME="results_published",
        WHATSAPP_TEMPLATE_LANG="en",
    )
    def test_whatsapp_graph_sends_template_and_media(self):
        calls = []

        def fake_graph(method, url, **kwargs):
            calls.append((method, url, kwargs))
            if url.endswith("/media"):
                return {"id": "MEDIA123"}
            return {"messages": [{"id": "wamid.1"}]}

        with (
            patch("notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake"),
            patch("notifications.tasks._graph_json", side_effect=fake_graph),
        ):
            self._run()

        media_calls = [c for c in calls if c[1].endswith("/media")]
        message_calls = [c for c in calls if c[1].endswith("/messages")]
        self.assertEqual(len(media_calls), 1)
        self.assertGreaterEqual(len(message_calls), 2)
        logs = NotificationLog.objects.filter(channel=NotificationLog.Channel.WHATSAPP)
        self.assertTrue(all(log.status == NotificationLog.Status.SENT for log in logs))
        first_payload = message_calls[0][2]["json_body"]
        self.assertEqual(first_payload["type"], "template")
        self.assertEqual(first_payload["template"]["name"], "results_published")
        header = first_payload["template"]["components"][0]
        self.assertEqual(header["type"], "header")
        self.assertEqual(header["parameters"][0]["document"]["id"], "MEDIA123")

    def test_second_publish_same_term_does_not_resend(self):
        with patch("notifications.tasks._report_pdf_bytes", return_value=b"%PDF-fake"):
            self._run()
            first_count = NotificationLog.objects.count()
            self._run()
        self.assertEqual(NotificationLog.objects.count(), first_count)
        self.assertEqual(len(mail.outbox), 1)
