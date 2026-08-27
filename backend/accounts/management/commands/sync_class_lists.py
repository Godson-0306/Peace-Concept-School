from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from academics.models import ClassArm
from accounts.management.commands.import_term_results import (
    DEFAULT_PASSWORD,
    admission_year_from_regno,
    parse_file_meta,
    parse_student_cell,
)
from accounts.models import AccountType, PromotionStatus, StudentProfile, User

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "openpyxl is required. Install it with: pip install openpyxl"
    ) from exc


class Command(BaseCommand):
    help = (
        "Place students from class-list Excel files into those classes and "
        "move everyone else to Ex-Students."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "files",
            nargs="+",
            help="Class-list Excel files (same NAME + PCS id layout as result sheets)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to the database",
        )
        parser.add_argument(
            "--no-create",
            action="store_true",
            help="Do not create students who appear on a list but are missing from the database",
        )

    def handle(self, *args, **options):
        paths = [Path(item) for item in options["files"]]
        missing = [str(path) for path in paths if not path.exists()]
        if missing:
            raise CommandError("File not found:\n  " + "\n  ".join(missing))

        listed = self._load_listed_students(paths)
        if not listed:
            raise CommandError("No students with a PCS id found in the given files.")

        conflicts = [
            (sid, entries)
            for sid, entries in listed.items()
            if len({item["class_key"] for item in entries}) > 1
        ]
        if conflicts:
            lines = []
            for sid, entries in conflicts:
                places = ", ".join(
                    f"{item['class_label']} ({item['source']})" for item in entries
                )
                lines.append(f"  {sid}: {places}")
            raise CommandError(
                "Student appears in more than one class list:\n" + "\n".join(lines)
            )

        # Last row for a student in a file wins; one entry per id after conflict check.
        by_id = {sid: entries[-1] for sid, entries in listed.items()}
        class_arms = {
            (arm.class_level.name, arm.name): arm
            for arm in ClassArm.objects.select_related("class_level")
        }

        students = list(StudentProfile.objects.select_related("user", "class_arm", "class_arm__class_level"))
        by_student_id = {s.student_id.upper(): s for s in students}

        placed = defaultdict(int)
        created = 0
        updated = 0
        unchanged = 0
        missing_ids: list[tuple[str, str, str]] = []
        to_ex: list[StudentProfile] = []

        listed_ids = set(by_id)
        for student in students:
            if student.student_id.upper() not in listed_ids:
                to_ex.append(student)

        with transaction.atomic():
            for student_id, row in sorted(by_id.items(), key=lambda item: item[1]["class_label"]):
                arm = class_arms.get((row["level_name"], row["arm_name"]))
                if arm is None:
                    raise CommandError(
                        f"Missing class arm {row['level_name']} {row['arm_name']} "
                        "- seed class levels first."
                    )
                student = by_student_id.get(student_id)
                if student is None:
                    missing_ids.append((student_id, row["full_name"], row["class_label"]))
                    if options["no_create"]:
                        continue
                    if options["dry_run"]:
                        created += 1
                        placed[row["class_label"]] += 1
                        continue
                    student = self._create_student(student_id, row["full_name"], arm)
                    by_student_id[student_id] = student
                    created += 1
                    placed[row["class_label"]] += 1
                    continue

                changed = self._place_student(
                    student,
                    full_name=row["full_name"],
                    class_arm=arm,
                    dry_run=options["dry_run"],
                )
                if changed:
                    updated += 1
                else:
                    unchanged += 1
                placed[row["class_label"]] += 1

            graduated = 0
            already_ex = 0
            for student in to_ex:
                if not student.is_active and student.class_arm_id is None:
                    already_ex += 1
                    continue
                graduated += 1
                if options["dry_run"]:
                    continue
                student.is_active = False
                student.class_arm = None
                student.promotion_status = PromotionStatus.GRADUATED
                student.save(
                    update_fields=[
                        "is_active",
                        "class_arm",
                        "promotion_status",
                        "updated_at",
                    ]
                )

            if options["dry_run"]:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(f"Files: {len(paths)}"))
        self.stdout.write(f"Listed students (unique PCS ids): {len(by_id)}")
        if options["dry_run"]:
            self.stdout.write("Dry run - no database changes.")
        self.stdout.write(
            f"Placed existing: updated {updated}, unchanged {unchanged}"
        )
        self.stdout.write(
            f"Created: {created}"
            + (" (skipped - --no-create)" if options["no_create"] else "")
        )
        if missing_ids and options["no_create"]:
            self.stdout.write("Missing from database:")
            for sid, name, klass in missing_ids:
                self.stdout.write(f"  {sid}  {name}  -> {klass}")
        self.stdout.write(
            f"Moved to Ex-Students: {graduated} "
            f"(already Ex-Student: {already_ex})"
        )
        self.stdout.write("By class:")
        for label in sorted(placed):
            self.stdout.write(f"  {label}: {placed[label]}")

    def _load_listed_students(self, paths: list[Path]) -> dict[str, list[dict]]:
        listed: dict[str, list[dict]] = defaultdict(list)
        for path in paths:
            _session, level_name, arm_name, _term, _year = parse_file_meta(path)
            class_label = f"{level_name} {arm_name}"
            class_key = (level_name, arm_name)
            wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
            ws = wb.active
            count = 0
            skipped = 0
            for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
                student_id, full_name = parse_student_cell(row[0] if row else None)
                if not student_id:
                    if full_name:
                        skipped += 1
                    continue
                listed[student_id].append(
                    {
                        "student_id": student_id,
                        "full_name": full_name,
                        "level_name": level_name,
                        "arm_name": arm_name,
                        "class_label": class_label,
                        "class_key": class_key,
                        "source": path.name,
                    }
                )
                count += 1
            wb.close()
            self.stdout.write(f"{path.name}: {count} students -> {class_label}")
            if skipped:
                self.stdout.write(f"  skipped rows without PCS id: {skipped}")
        return listed

    def _place_student(
        self,
        student: StudentProfile,
        *,
        full_name: str,
        class_arm: ClassArm,
        dry_run: bool,
    ) -> bool:
        fields = []
        if full_name and student.full_name != full_name:
            student.full_name = full_name
            fields.append("full_name")
        if student.class_arm_id != class_arm.id:
            student.class_arm = class_arm
            fields.append("class_arm")
        if not student.is_active:
            student.is_active = True
            fields.append("is_active")
        if student.promotion_status == PromotionStatus.GRADUATED:
            student.promotion_status = PromotionStatus.PENDING
            fields.append("promotion_status")
        if not fields:
            return False
        if not dry_run:
            student.save(update_fields=[*fields, "updated_at"])
        return True

    def _create_student(
        self, student_id: str, full_name: str, class_arm: ClassArm
    ) -> StudentProfile:
        email = f"{student_id.lower()}@students.peaceconceptschool.ng"
        name = full_name or student_id
        parts = name.split(" ", 1)
        user = User.objects.create_user(
            email=email,
            password=DEFAULT_PASSWORD,
            username=email,
            account_type=AccountType.STUDENT,
            first_name=parts[0],
            last_name=parts[1] if len(parts) > 1 else "",
            must_change_password=False,
            is_active=True,
        )
        return StudentProfile.objects.create(
            user=user,
            student_id=student_id.upper(),
            full_name=name,
            admission_year=admission_year_from_regno(student_id),
            class_arm=class_arm,
            email=email,
            is_active=True,
            promotion_status=PromotionStatus.PENDING,
        )
