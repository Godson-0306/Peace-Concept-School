from __future__ import annotations

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import AccountType, PositionAssignment, StaffProfile, User
from academics.models import TeacherAssignment

DEFAULT_ROSTER = Path(__file__).resolve().parents[2] / "data" / "staff_roster.json"
DEFAULT_PASSWORD = "school"

# Keep the system admin account; everything else is replaced from the roster.
KEEP_USERNAMES = {"admin"}

JUNK_NAMES = {
    "ssdsd",
    "asas",
    "school",
    "attendance",
    "admin",
    "demo",
    "test",
    "placeholder",
}


def neat_name(value: str) -> str:
    name = re.sub(r"\s+", " ", (value or "").strip())
    name = re.sub(r"^(miss|mrs|mr|ms)\.?\s+", "", name, flags=re.I)
    if not name:
        return ""
    letters = re.sub(r"[^A-Za-z]", "", name)
    if letters and (letters.isupper() or letters.islower()):
        return name.title()
    return name


def neat_username(value: str) -> str:
    username = re.sub(r"\s+", ".", (value or "").strip().lower())
    username = re.sub(r"[^a-z0-9._-]", "", username)
    username = re.sub(r"\.+", ".", username).strip(".")
    return username


def neat_gender(value: str) -> str:
    raw = (value or "").strip().lower()
    if raw in {"m", "male"}:
        return "Male"
    if raw in {"f", "female"}:
        return "Female"
    return ""


class Command(BaseCommand):
    help = (
        "Replace placeholder staff with the real staff roster "
        "(name, username, gender only). Skips profiles without names."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(DEFAULT_ROSTER),
            help="Path to staff_roster.json",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing",
        )
        parser.add_argument(
            "--keep-demo",
            action="store_true",
            help="Do not delete staff outside the roster / keep list",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Roster file not found: {path}")

        raw_rows = json.loads(path.read_text(encoding="utf-8"))
        rows = []
        skipped = []
        seen_usernames: set[str] = set()

        for item in raw_rows:
            full_name = neat_name(str(item.get("full_name") or ""))
            username = neat_username(str(item.get("username") or ""))
            gender = neat_gender(str(item.get("gender") or ""))

            if not full_name:
                skipped.append(("missing name", item))
                continue
            if full_name.lower() in JUNK_NAMES:
                skipped.append(("junk name", full_name))
                continue
            if not username:
                skipped.append(("missing username", full_name))
                continue
            if username in KEEP_USERNAMES:
                skipped.append(("reserved username", username))
                continue
            if username in seen_usernames:
                skipped.append(("duplicate username", username))
                continue
            seen_usernames.add(username)
            rows.append(
                {
                    "full_name": full_name,
                    "username": username,
                    "gender": gender,
                }
            )

        self.stdout.write(f"Valid staff rows: {len(rows)}")
        if skipped:
            self.stdout.write(f"Skipped: {len(skipped)}")
            for reason, detail in skipped[:12]:
                self.stdout.write(f"  - {reason}: {detail}")

        if options["dry_run"]:
            for row in rows[:8]:
                self.stdout.write(
                    f"  {row['full_name']} / {row['username']} / {row['gender']}"
                )
            self.stdout.write("Dry run — no database changes.")
            return

        created = updated = 0
        with transaction.atomic():
            keep_ids: set[int] = set()
            admin = User.objects.filter(username="admin").first()
            if admin and hasattr(admin, "staff_profile"):
                keep_ids.add(admin.staff_profile.id)

            for row in rows:
                staff, was_created = self._upsert_staff(row)
                keep_ids.add(staff.id)
                if was_created:
                    created += 1
                else:
                    updated += 1

            removed = 0
            if not options["keep_demo"]:
                removed = self._purge_placeholders(keep_ids)

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created}, updated {updated}, removed placeholders {removed}"
            )
        )

    def _upsert_staff(self, row: dict) -> tuple[StaffProfile, bool]:
        username = row["username"]
        email = f"{username}@staff.peaceconceptschool.ng"
        name_parts = row["full_name"].split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        user = User.objects.filter(username__iexact=username).first()
        if user is None:
            user = User.objects.filter(email__iexact=email).first()

        if user is None:
            user = User.objects.create_user(
                email=email,
                password=DEFAULT_PASSWORD,
                username=username,
                account_type=AccountType.TEACHER,
                first_name=first_name,
                last_name=last_name,
                must_change_password=False,
                is_active=True,
            )
            staff = StaffProfile.objects.create(
                user=user,
                full_name=row["full_name"],
                gender=row["gender"],
            )
            return staff, True

        # Do not convert the reserved admin account.
        if user.username.lower() == "admin":
            raise CommandError("Refusing to overwrite admin user from staff roster.")

        user.username = username
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.account_type = AccountType.TEACHER
        user.is_active = True
        user.must_change_password = False
        user.set_password(DEFAULT_PASSWORD)
        user.save()

        staff = getattr(user, "staff_profile", None)
        if staff is None:
            staff = StaffProfile.objects.create(
                user=user,
                full_name=row["full_name"],
                gender=row["gender"],
            )
            return staff, True

        staff.full_name = row["full_name"]
        staff.gender = row["gender"]
        # Clear optional fields so profiles stay minimal for later editing.
        staff.date_of_birth = None
        staff.state_of_origin = ""
        staff.phone_number = ""
        staff.address = ""
        staff.city_of_residence = ""
        staff.home_town = ""
        staff.lga_of_residence = ""
        staff.disability = ""
        staff.save()
        return staff, False

    def _purge_placeholders(self, keep_ids: set[int]) -> int:
        removed = 0
        qs = StaffProfile.objects.select_related("user").exclude(id__in=keep_ids)
        for staff in qs:
            user = staff.user
            if user and user.username.lower() in KEEP_USERNAMES:
                continue
            # Drop teaching/position links first for clarity.
            PositionAssignment.objects.filter(staff=staff).delete()
            TeacherAssignment.objects.filter(staff=staff).delete()
            staff.delete()
            if user is not None:
                user.delete()
            removed += 1
        return removed
