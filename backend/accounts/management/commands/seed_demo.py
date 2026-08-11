from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import AccountType, ParentProfile, PositionAssignment, PositionType, StaffProfile, StudentProfile, User
from academics.models import (
    AcademicSession,
    ClassArm,
    ClassLevel,
    Department,
    StudentIdSequence,
    Subject,
    TeacherAssignment,
)
from fees.models import FeeRecord, FeeStructure
from inventory.models import Inventory, InventoryAssignment, StockItem
from website.models import NewsPost


def ensure_user(email, password, account_type, first_name, last_name, **extra):
    user = User.objects.filter(email=email).first()
    if user:
        username = extra.get("username")
        if username and user.username != username:
            user.username = username
            user.set_password(password)
            user.must_change_password = False
            user.save(update_fields=["username", "password", "must_change_password"])
        return user, False
    user = User.objects.create_user(
        email=email,
        password=password,
        account_type=account_type,
        first_name=first_name,
        last_name=last_name,
        must_change_password=False,
        **extra,
    )
    return user, True


class Command(BaseCommand):
    help = "Seed Peace Concept International Mission Schools demo data"

    @transaction.atomic
    def handle(self, *args, **options):
        admin_user, _ = ensure_user(
            "admin@peaceconceptschool.ng",
            "AdminPass123!",
            AccountType.ADMIN,
            "System",
            "Admin",
            username="admin",
            is_staff=True,
            is_superuser=True,
        )
        StaffProfile.objects.get_or_create(
            user=admin_user,
            defaults={"full_name": "System Admin", "phone_number": "08000000000"},
        )

        session, _ = AcademicSession.objects.get_or_create(
            name="2025/2026", defaults={"start_year": 2025, "is_active": True}
        )
        from academics.services.terms import ensure_session_terms

        ensure_session_terms(session)
        terms = list(session.terms.order_by("number"))
        for term in terms:
            if term.number == 1:
                changed = False
                if not term.next_term_resumption:
                    term.next_term_resumption = date(2026, 1, 12)
                    changed = True
                if not term.is_active:
                    term.is_active = True
                    changed = True
                if changed:
                    term.save()

        level_names = [
            "Day Care",
            "Nursery 1",
            "Nursery 2",
            "Basic 1",
            "Basic 2",
            "Basic 3",
            "Basic 4",
            "Basic 5",
            "JSS1",
            "JSS2",
            "JSS3",
            "SS1",
            "SS2",
            "SS3",
        ]
        for order, name in enumerate(level_names, start=1):
            level, _ = ClassLevel.objects.get_or_create(name=name, defaults={"order": order})
            if level.order != order:
                level.order = order
                level.save(update_fields=["order"])
            for arm in ("A", "B"):
                ClassArm.objects.get_or_create(class_level=level, name=arm)
        # Normalize legacy SSS* levels into SS* and drop unused duplicates.
        for legacy, canonical in (("SSS1", "SS1"), ("SSS2", "SS2"), ("SSS3", "SS3")):
            old = ClassLevel.objects.filter(name=legacy).first()
            new = ClassLevel.objects.filter(name=canonical).first()
            if old and new and old.id != new.id:
                for arm in old.arms.all():
                    target, _ = ClassArm.objects.get_or_create(
                        class_level=new, name=arm.name
                    )
                    arm.students.update(class_arm=target)
                    arm.teacher_assignments.update(class_arm=target)
                    arm.delete()
                old.subjects.update(class_level=new)
                old.delete()

        sciences, _ = Department.objects.get_or_create(name="Sciences")
        humanities, _ = Department.objects.get_or_create(name="Humanities")

        jss1 = ClassLevel.objects.get(name="JSS1")
        for name, dept, stype in [
            ("Mathematics", sciences, Subject.SubjectType.SUBJECT),
            ("English Language", humanities, Subject.SubjectType.SUBJECT),
            ("Basic Science", sciences, Subject.SubjectType.SUBJECT),
            ("Basic Technology", sciences, Subject.SubjectType.SUBJECT),
            ("Agricultural Science", sciences, Subject.SubjectType.SUBJECT),
            ("Civic Education", humanities, Subject.SubjectType.SUBJECT),
            ("Computer Practical", sciences, Subject.SubjectType.ADDITIONAL),
        ]:
            Subject.objects.get_or_create(
                name=name,
                class_level=jss1,
                defaults={"department": dept, "subject_type": stype},
            )

        # Principal
        principal_user, _ = ensure_user(
            "principal@peaceconceptschool.ng",
            "Principal123!",
            AccountType.PRINCIPAL,
            "Ada",
            "Okeke",
            username="principal",
        )
        StaffProfile.objects.get_or_create(
            user=principal_user, defaults={"full_name": "Ada Okeke", "gender": "Female"}
        )

        # Accountant
        acc_user, _ = ensure_user(
            "accountant@peaceconceptschool.ng",
            "Accountant123!",
            AccountType.ACCOUNTANT,
            "Chidi",
            "Eze",
            username="accountant",
        )
        StaffProfile.objects.get_or_create(
            user=acc_user, defaults={"full_name": "Chidi Eze", "gender": "Male"}
        )

        # Teacher + Form Teacher + HOD
        teacher_user, _ = ensure_user(
            "teacher@peaceconceptschool.ng",
            "Teacher123!",
            AccountType.TEACHER,
            "Ngozi",
            "Balogun",
            username="teacher1",
        )
        teacher_staff, _ = StaffProfile.objects.get_or_create(
            user=teacher_user, defaults={"full_name": "Ngozi Balogun", "gender": "Female"}
        )
        jss1a = ClassArm.objects.get(class_level=jss1, name="A")
        math = Subject.objects.get(name="Mathematics", class_level=jss1)
        basic_sci = Subject.objects.get(name="Basic Science", class_level=jss1)
        TeacherAssignment.objects.get_or_create(
            staff=teacher_staff, class_arm=jss1a, subject=math, session=session
        )
        TeacherAssignment.objects.get_or_create(
            staff=teacher_staff, class_arm=jss1a, subject=basic_sci, session=session
        )
        PositionAssignment.objects.get_or_create(
            staff=teacher_staff,
            position=PositionType.FORM_TEACHER,
            class_arm=jss1a,
        )
        PositionAssignment.objects.get_or_create(
            staff=teacher_staff,
            position=PositionType.HOD,
            department=sciences,
        )

        # Store staff
        store_user, _ = ensure_user(
            "store@peaceconceptschool.ng",
            "Store123!",
            AccountType.STORE_STAFF,
            "Tunde",
            "Adeyemi",
            username="store1",
        )
        store_staff, _ = StaffProfile.objects.get_or_create(
            user=store_user, defaults={"full_name": "Tunde Adeyemi", "gender": "Male"}
        )
        uniforms, _ = Inventory.objects.get_or_create(
            name="Uniforms", defaults={"category": "Apparel", "description": "School uniforms"}
        )
        InventoryAssignment.objects.get_or_create(inventory=uniforms, staff=store_staff)
        StockItem.objects.get_or_create(
            inventory=uniforms,
            name="JSS Shirt",
            defaults={"quantity": 50, "unit_price": 4500},
        )

        # Students
        for i, name in enumerate(["Amaka Nwosu", "Ibrahim Bello", "Funke Adeola"], start=1):
            email = f"student{i}@peaceconceptschool.ng"
            user, created = ensure_user(
                email,
                "Student123!",
                AccountType.STUDENT,
                name.split()[0],
                name.split()[-1],
            )
            defaults = {
                "full_name": name,
                "gender": "Female" if i != 2 else "Male",
                "admission_year": 2025,
                "class_arm": jss1a,
                "guardian_name": f"Guardian of {name.split()[0]}",
                "guardian_email": f"guardian{i}@example.com",
                "guardian_phone": f"0801111000{i}",
            }
            student = StudentProfile.objects.filter(user=user).first()
            if not student:
                defaults["student_id"] = StudentIdSequence.next_student_id(2025)
                student = StudentProfile.objects.create(user=user, **defaults)
            FeeStructure.objects.get_or_create(
                name="Tuition",
                term=terms[0],
                class_level=jss1,
                defaults={"session": session, "amount": 150000},
            )
            structure = FeeStructure.objects.get(name="Tuition", term=terms[0], class_level=jss1)
            FeeRecord.objects.get_or_create(
                student=student,
                term=terms[0],
                defaults={
                    "fee_structure": structure,
                    "amount_due": structure.amount,
                    "amount_paid": structure.amount if i == 1 else 0,
                },
            )

        # Parent linked to first student
        parent_user, _ = ensure_user(
            "parent@peaceconceptschool.ng",
            "Parent123!",
            AccountType.PARENT,
            "Grace",
            "Nwosu",
            username="parent1",
        )
        parent, _ = ParentProfile.objects.get_or_create(
            user=parent_user, defaults={"full_name": "Grace Nwosu", "phone_number": "08022223333"}
        )
        first_student = StudentProfile.objects.filter(full_name="Amaka Nwosu").first()
        if first_student:
            parent.children.add(first_student)

        NewsPost.objects.get_or_create(
            slug="session-2025-2026-resumption",
            defaults={
                "title": "Session 2025/2026 Resumption",
                "summary": "Students resume for the new academic session.",
                "body": "Peace Concept International Mission Schools welcomes all students to the 2025/2026 academic session. Resumption details are available at the school office.",
                "is_published": True,
            },
        )

        first_student_id = (
            StudentProfile.objects.filter(full_name="Amaka Nwosu")
            .values_list("student_id", flat=True)
            .first()
            or "PCS025001"
        )
        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write("Staff login uses Username + password:")
        self.stdout.write("  Admin: admin / AdminPass123!")
        self.stdout.write("  Principal: principal / Principal123!")
        self.stdout.write("  Teacher: teacher1 / Teacher123!")
        self.stdout.write("  Accountant: accountant / Accountant123!")
        self.stdout.write("  Store: store1 / Store123!")
        self.stdout.write("  Parent: parent1 / Parent123!")
        self.stdout.write("Student login uses Student ID + password:")
        self.stdout.write(f"  Student: {first_student_id} / Student123!")
