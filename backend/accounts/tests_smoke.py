"""Smoke tests for core management-system workflows."""

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import AcademicSession, ClassArm, ClassLevel, Subject, Term
from accounts.models import AccountType, PositionAssignment, PositionType, StaffProfile, StudentProfile, User
from assessments.models import AssessmentScore, AttendanceRecord
from assessments.views import results_visible_for_student
from cbt.models import CbtChoice, CbtPaper, CbtQuestion
from fees.models import FeeRecord, FeeStructure
from fees.views import ensure_bill_for_student
from identity.services import build_id_card_pdf
from website.models import Enquiry


class SchoolFixtureMixin:
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.session = AcademicSession.objects.create(
            name="2025/2026", start_year=2025, is_active=True
        )
        self.term = Term.objects.create(
            session=self.session,
            number=1,
            is_active=True,
            results_entry_open=True,
        )
        self.level = ClassLevel.objects.create(name="JSS1", order=10)
        self.arm = ClassArm.objects.create(class_level=self.level, name="A")
        self.subject = Subject.objects.create(
            name="Mathematics", class_level=self.level, code="MTH"
        )
        self.admin = User.objects.create_user(
            email="admin@test.local",
            password="AdminPass123!",
            username="admin",
            account_type=AccountType.ADMIN,
            must_change_password=False,
        )
        self.student_user = User.objects.create_user(
            email="student@test.local",
            password="StudentPass123!",
            username="PCS025999",
            account_type=AccountType.STUDENT,
            must_change_password=False,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            student_id="PCS025999",
            full_name="Test Student",
            admission_year=2025,
            class_arm=self.arm,
            gender="male",
        )


class AuthSmokeTests(SchoolFixtureMixin, TestCase):
    def test_health(self):
        res = self.client.get("/api/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_staff_login_and_me(self):
        res = self.client.post(
            "/api/auth/login/",
            {"portal": "staff", "identifier": "admin", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["account_type"], "admin")
        me = self.client.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["username"], "admin")

    def test_student_login(self):
        res = self.client.post(
            "/api/auth/login/",
            {
                "portal": "student",
                "identifier": "PCS025999",
                "password": "StudentPass123!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["account_type"], "student")

    def test_parent_portal_rejects_staff(self):
        res = self.client.post(
            "/api/auth/login/",
            {"portal": "parent", "identifier": "admin", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_change_password(self):
        self.client.force_authenticate(user=self.admin)
        bad = self.client.post(
            "/api/auth/change-password/",
            {"current_password": "wrong", "new_password": "NewPass12345"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "AdminPass123!",
                "new_password": "NewPass12345",
            },
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("NewPass12345"))
        self.assertFalse(self.admin.must_change_password)

    def test_student_cannot_change_password(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "StudentPass123!",
                "new_password": "NewPass12345",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.student_user.refresh_from_db()
        self.assertTrue(self.student_user.check_password("StudentPass123!"))


class FeeGateSmokeTests(SchoolFixtureMixin, TestCase):
    def test_no_bill_keeps_results_visible(self):
        self.assertTrue(results_visible_for_student(self.student, self.term))

    def test_unpaid_bill_locks_results(self):
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
            status=FeeRecord.Status.UNPAID,
        )
        self.assertFalse(results_visible_for_student(self.student, self.term))

    def test_paid_or_unlocked_allows_results(self):
        structure = FeeStructure.objects.create(
            session=self.session,
            section="jss",
            student_type="new",
            amount=Decimal("50000"),
        )
        record = FeeRecord.objects.create(
            student=self.student,
            term=self.term,
            fee_structure=structure,
            amount_due=Decimal("50000"),
            amount_paid=Decimal("50000"),
            status=FeeRecord.Status.PAID,
            results_unlocked=True,
        )
        self.assertTrue(results_visible_for_student(self.student, self.term))
        record.status = FeeRecord.Status.UNPAID
        record.amount_paid = 0
        record.results_unlocked = True
        record.save()
        self.assertTrue(results_visible_for_student(self.student, self.term))

    def test_ensure_bill_for_student(self):
        FeeStructure.objects.create(
            session=self.session,
            section="jss",
            student_type="new",
            amount=Decimal("25000"),
        )
        record = ensure_bill_for_student(self.student, term=self.term, updated_by=self.admin)
        self.assertIsNotNone(record)
        self.assertEqual(record.amount_due, Decimal("25000"))


class AttendanceSmokeTests(SchoolFixtureMixin, TestCase):
    def test_clock_in(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/attendance/clock_in/",
            {"student_code": "PCS025999"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            AttendanceRecord.objects.filter(
                student=self.student, term=self.term
            ).exists()
        )

    def test_student_my_summary(self):
        AttendanceRecord.objects.create(
            student=self.student,
            class_arm=self.arm,
            term=self.term,
            date=timezone.localdate(),
            status=AttendanceRecord.Status.PRESENT,
            marked_by=self.admin,
        )
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get("/api/attendance/my_summary/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("recent", res.data)

    def test_teacher_cannot_clock_in_or_read_register(self):
        teacher = User.objects.create_user(
            email="att-teacher@test.local",
            password="TeacherPass123!",
            username="att_teacher",
            account_type=AccountType.TEACHER,
            must_change_password=False,
        )
        self.client.force_authenticate(user=teacher)
        clock = self.client.post(
            "/api/attendance/clock_in/",
            {"student_code": "PCS025999"},
            format="json",
        )
        self.assertEqual(clock.status_code, 403)
        register = self.client.get(
            "/api/attendance/register/",
            {
                "class_arm": self.arm.id,
                "term": self.term.id,
                "date": timezone.localdate().isoformat(),
            },
        )
        self.assertEqual(register.status_code, 403)

    def test_form_teacher_can_mark_own_class_but_cannot_clock_in(self):
        teacher = User.objects.create_user(
            email="att-form@test.local",
            password="TeacherPass123!",
            username="att_form",
            account_type=AccountType.TEACHER,
            must_change_password=False,
        )
        staff = StaffProfile.objects.create(user=teacher, full_name="Form Teacher")
        PositionAssignment.objects.create(
            staff=staff,
            position=PositionType.FORM_TEACHER,
            class_arm=self.arm,
            is_active=True,
        )
        self.client.force_authenticate(user=teacher)
        today = timezone.localdate().isoformat()
        register = self.client.get(
            "/api/attendance/register/",
            {"class_arm": self.arm.id, "term": self.term.id, "date": today},
        )
        self.assertEqual(register.status_code, 200)
        bulk = self.client.post(
            "/api/attendance/bulk/",
            {
                "class_arm": self.arm.id,
                "term": self.term.id,
                "date": today,
                "marks": [{"student": self.student.id, "status": "present"}],
            },
            format="json",
        )
        self.assertEqual(bulk.status_code, 200)
        clock = self.client.post(
            "/api/attendance/clock_in/",
            {"student_code": "PCS025999"},
            format="json",
        )
        self.assertEqual(clock.status_code, 403)


class CbtSmokeTests(SchoolFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.paper = CbtPaper.objects.create(
            title="Math CA1",
            score_component=CbtPaper.ScoreComponent.CA1,
            subject=self.subject,
            class_arm=self.arm,
            term=self.term,
            status=CbtPaper.Status.PUBLISHED,
            created_by=self.admin,
        )
        q = CbtQuestion.objects.create(paper=self.paper, prompt="2+2?", order=1, marks=20)
        CbtChoice.objects.create(question=q, label="A", text="4", is_correct=True)
        CbtChoice.objects.create(question=q, label="B", text="5", is_correct=False)

    def test_published_question_rewrite_blocked(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/cbt/papers/{self.paper.id}/",
            {
                "questions": [
                    {
                        "prompt": "Hacked?",
                        "order": 1,
                        "marks": 20,
                        "choices": [
                            {"label": "A", "text": "x", "is_correct": True},
                            {"label": "B", "text": "y", "is_correct": False},
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_student_start_and_submit(self):
        self.client.force_authenticate(user=self.student_user)
        start = self.client.post(f"/api/cbt/papers/{self.paper.id}/start/")
        self.assertIn(start.status_code, (200, 201))
        attempt_id = start.data["id"]
        q = self.paper.questions.first()
        choice = q.choices.filter(is_correct=True).first()
        submit = self.client.post(
            f"/api/cbt/papers/{self.paper.id}/submit/",
            {
                "attempt_id": attempt_id,
                "answers": [{"question_id": q.id, "choice_id": choice.id}],
            },
            format="json",
        )
        self.assertEqual(submit.status_code, 200)


class IdentityPdfSmokeTests(SchoolFixtureMixin, TestCase):
    def test_id_card_pdf_bytes(self):
        pdf = build_id_card_pdf(self.student)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1000)

    def test_report_card_pdf_endpoint(self):
        AssessmentScore.objects.create(
            student=self.student,
            subject=self.subject,
            term=self.term,
            class_arm=self.arm,
            ca1=10,
            ca2=10,
            exam=40,
            status=AssessmentScore.Status.PUBLISHED,
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"/api/identity/report-card/{self.student.id}/?term={self.term.id}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("pdf", res["Content-Type"])


class EnquiryStatusSmokeTests(SchoolFixtureMixin, TestCase):
    def test_admin_can_update_enquiry_status(self):
        enquiry = Enquiry.objects.create(
            full_name="Parent One",
            email="p@test.local",
            phone="08011112222",
            subject="Fees",
            message="Hello",
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/website/enquiries/{enquiry.id}/",
            {"status": "contacted"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        enquiry.refresh_from_db()
        self.assertEqual(enquiry.status, Enquiry.Status.CONTACTED)


class JambProgressSmokeTests(SchoolFixtureMixin, TestCase):
    def test_student_can_save_jamb_progress(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(
            "/api/cbt/jamb/progress/",
            {
                "title": "JAMB Practice — Use of English, Mathematics, Biology, Chemistry",
                "score_percent": 72.5,
                "subjects_json": [
                    {"subject": "Mathematics", "percent": 70, "correct": 35, "total": 50}
                ],
                "source": "jamb-cbt-website",
                "meta": {"total_correct": 145, "total_questions": 200},
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(float(res.data["score_percent"]), 72.5)
        listing = self.client.get("/api/cbt/jamb/progress/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["integration"], "ready")
        self.assertEqual(len(listing.data["results"]), 1)

    def test_staff_cannot_post_jamb_progress(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/cbt/jamb/progress/",
            {"score_percent": 50},
            format="json",
        )
        self.assertEqual(res.status_code, 403)


class StaffResetSmokeTests(SchoolFixtureMixin, TestCase):
    def test_admin_can_reset_staff_password_to_school(self):
        from accounts.models import StaffProfile
        from accounts.passwords import DEFAULT_PASSWORD

        staff_user = User.objects.create_user(
            email="teacher@test.local",
            password="TempPass123!",
            username="teacher1",
            account_type=AccountType.TEACHER,
            must_change_password=False,
        )
        staff = StaffProfile.objects.create(user=staff_user, full_name="Test Teacher")
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/staff/{staff.id}/reset-password/")
        self.assertEqual(res.status_code, 200)
        staff_user.refresh_from_db()
        self.assertTrue(staff_user.check_password(DEFAULT_PASSWORD))


class GeneralReportAccessTests(SchoolFixtureMixin, TestCase):
    def test_teacher_cannot_fetch_general_report(self):
        teacher = User.objects.create_user(
            email="grs-teacher@test.local",
            password="TeacherPass123!",
            username="grs_teacher",
            account_type=AccountType.TEACHER,
            must_change_password=False,
        )
        self.client.force_authenticate(user=teacher)
        res = self.client.get(
            f"/api/scores/general_report/?term={self.term.id}&class_arm={self.arm.id}"
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_can_fetch_general_report(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            f"/api/scores/general_report/?term={self.term.id}&class_arm={self.arm.id}"
        )
        self.assertEqual(res.status_code, 200)
