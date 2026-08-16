from datetime import date
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import AccountType, StaffProfile, User
from academics.models import (
    AcademicSession,
    ClassArm,
    ClassLevel,
    Department,
    Subject,
)
from fees.models import FeeStructure
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
        if not settings.DEBUG or os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
            raise CommandError(
                "seed_demo is for local development only and must not run on a live database."
            )
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

        from academics.services.subjects import sync_nursery_daycare_subjects

        sync_nursery_daycare_subjects(replace_others=True)

        # Inventory catalog + demo store staff assignment.
        uniforms, _ = Inventory.objects.get_or_create(
            name="Uniforms",
            defaults={"category": "Apparel", "description": "School uniforms"},
        )
        books, _ = Inventory.objects.get_or_create(
            name="Books & Stationery",
            defaults={"category": "Academics", "description": "Exercise books and pens"},
        )
        for inv, name, qty, price, sku in [
            (uniforms, "JSS Shirt", 50, 4500, "UNI-JSS-SHIRT"),
            (uniforms, "JSS Trouser", 40, 5500, "UNI-JSS-TROU"),
            (uniforms, "SS Blouse", 35, 5000, "UNI-SS-BLOUSE"),
            (books, "Exercise Book 60 leaves", 200, 400, "BK-EX-60"),
            (books, "Biro (blue)", 500, 100, "BK-BIRO-BLU"),
        ]:
            StockItem.objects.get_or_create(
                inventory=inv,
                name=name,
                defaults={"quantity": qty, "unit_price": price, "sku": sku},
            )

        store_user, _ = ensure_user(
            "store1@peaceconceptschool.ng",
            "Store123!",
            AccountType.STORE_STAFF,
            "Store",
            "Keeper",
            username="store1",
        )
        store_staff, _ = StaffProfile.objects.get_or_create(
            user=store_user,
            defaults={"full_name": "Store Keeper", "phone_number": "08011112222"},
        )
        InventoryAssignment.objects.get_or_create(
            inventory=uniforms,
            staff=store_staff,
            defaults={"is_active": True},
        )
        InventoryAssignment.objects.get_or_create(
            inventory=books,
            staff=store_staff,
            defaults={"is_active": True},
        )

        accountant_user, _ = ensure_user(
            "accountant@peaceconceptschool.ng",
            "Accountant123!",
            AccountType.ACCOUNTANT,
            "School",
            "Accountant",
            username="accountant",
        )
        StaffProfile.objects.get_or_create(
            user=accountant_user,
            defaults={"full_name": "School Accountant", "phone_number": "08033334444"},
        )

        # Students are imported from real User List rosters
        # (manage.py import_student_roster). Seed section fee grid for demos.
        from fees.sections import FEE_SECTIONS

        demo_amounts = {
            "day_care": {"new": 80000, "returning": 70000},
            "nursery": {"new": 90000, "returning": 80000},
            "primary": {"new": 110000, "returning": 100000},
            "jss": {"new": 150000, "returning": 140000},
            "ss": {"new": 160000, "returning": 150000},
        }
        for section_key, _label in FEE_SECTIONS:
            for student_type in ("new", "returning"):
                FeeStructure.objects.update_or_create(
                    session=session,
                    section=section_key,
                    student_type=student_type,
                    defaults={
                        "amount": demo_amounts[section_key][student_type],
                        "is_active": True,
                    },
                )

        NewsPost.objects.get_or_create(
            slug="session-2025-2026-resumption",
            defaults={
                "title": "Session 2025/2026 Resumption",
                "summary": "Students resume for the new academic session.",
                "body": "Peace Concept International Mission Schools welcomes all students to the 2025/2026 academic session. Resumption details are available at the school office.",
                "is_published": True,
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write("Staff login uses Username + password:")
        self.stdout.write("  Admin: admin / AdminPass123!")
        self.stdout.write("  Accountant: accountant / Accountant123!")
        self.stdout.write("  Store: store1 / Store123!")
        self.stdout.write(
            "Staff roster: run `python manage.py import_staff_roster` "
            "(username from roster + password `school`)."
        )
        self.stdout.write(
            "Students: run `python manage.py import_student_roster` "
            "(login with Student ID + password from roster, usually `school`)."
        )
        self.stdout.write(
            "First Term scores: run `python manage.py import_term_results` "
            "(activates 2025/2026 + First Term from class Excel sheets)."
        )
