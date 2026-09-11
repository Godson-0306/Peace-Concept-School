from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from academics.models import AcademicSession, ClassArm
from academics.services.terms import ensure_session_terms
from accounts.management.commands.import_term_results import (
    DEFAULT_RESULTS_DIR,
    parse_file_meta,
    parse_student_cell,
)
from accounts.models import PromotionStatus, StudentProfile

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "openpyxl is required. Install it with: pip install openpyxl"
    ) from exc


# Last-session class (from the result sheet) → current-session class.
PROMOTION_MAP: dict[str, str | None] = {
    "Creche": "Pre-Nursery",
    "Day Care": "Nursery 1",
    "Pre-Nursery": "Nursery 1",
    "Nursery 1": "Nursery 2",
    "Nursery 2": "Basic 1",
    "Basic 1": "Basic 2",
    "Basic 2": "Basic 3",
    "Basic 3": "Basic 4",
    "Basic 4": "Basic 5",
    "Basic 5": "JSS1",
    "JSS1": "JSS2",
    "JSS2": "JSS3",
    "JSS3": "SS1",
    "SS1": "SS2",
    "SS2": "SS3",
    "SS3": None,
}


class Command(BaseCommand):
    help = (
        "Promote students found on last-session result sheets one class up "
        "(SS3 → Ex-Students). Does not move anyone who is not on the lists."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "files",
            nargs="*",
            help="Result Excel files (default: 2025_2026*.xlsx in accounts/data/results)",
        )
        parser.add_argument(
            "--dir",
            type=str,
            default=str(DEFAULT_RESULTS_DIR),
            help="Directory used when no files are given",
        )
        parser.add_argument(
            "--from-session",
            type=str,
            default="2025/2026",
            help="Session encoded in the sheet filenames (default: 2025/2026)",
        )
        parser.add_argument(
            "--to-session",
            type=str,
            default="2026/2027",
            help="Session to activate after promotion (default: 2026/2027)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to the database",
        )
        parser.add_argument(
            "--no-activate",
            action="store_true",
            help="Do not create or activate the destination session",
        )

    def handle(self, *args, **options):
        paths = [Path(item) for item in options["files"]]
        if not paths:
            results_dir = Path(options["dir"])
            if not results_dir.exists():
                raise CommandError(f"Results directory not found: {results_dir}")
            prefix = options["from_session"].replace("/", "_")
            paths = sorted(results_dir.glob(f"{prefix}_*__*_TERM.xlsx"))
        missing = [str(path) for path in paths if not path.exists()]
        if missing:
            raise CommandError("File not found:\n  " + "\n  ".join(missing))
        if not paths:
            raise CommandError("No result sheets found to promote from.")

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

        by_id = {sid: entries[-1] for sid, entries in listed.items()}
        class_arms = {
            (arm.class_level.name, arm.name): arm
            for arm in ClassArm.objects.select_related("class_level")
        }
        students = {
            s.student_id.upper(): s
            for s in StudentProfile.objects.select_related(
                "user", "class_arm", "class_arm__class_level"
            )
        }

        promoted = defaultdict(int)
        graduated = 0
        unchanged = 0
        missing_ids: list[tuple[str, str, str]] = []
        skipped_no_arm = 0

        with transaction.atomic():
            for student_id, row in sorted(
                by_id.items(), key=lambda item: item[1]["class_label"]
            ):
                destination = PROMOTION_MAP.get(row["level_name"], "__unknown__")
                if destination == "__unknown__":
                    raise CommandError(
                        f"No promotion mapping for class {row['level_name']} "
                        f"({row['source']})"
                    )

                student = students.get(student_id)
                if student is None:
                    missing_ids.append(
                        (student_id, row["full_name"], row["class_label"])
                    )
                    continue

                if destination is None:
                    changed = self._graduate(
                        student, full_name=row["full_name"], dry_run=options["dry_run"]
                    )
                    if changed:
                        graduated += 1
                    else:
                        unchanged += 1
                    continue

                arm = class_arms.get((destination, row["arm_name"]))
                if arm is None:
                    # Fall back to first arm of the destination level.
                    arm = next(
                        (
                            candidate
                            for (level, _name), candidate in class_arms.items()
                            if level == destination
                        ),
                        None,
                    )
                if arm is None:
                    skipped_no_arm += 1
                    raise CommandError(
                        f"Missing class arm {destination} {row['arm_name']} "
                        "- seed class levels first."
                    )

                changed = self._place_promoted(
                    student,
                    full_name=row["full_name"],
                    class_arm=arm,
                    dry_run=options["dry_run"],
                )
                if changed:
                    promoted[arm.label] += 1
                else:
                    unchanged += 1

            if not options["no_activate"]:
                self._activate_session(
                    options["to_session"], dry_run=options["dry_run"]
                )

            if options["dry_run"]:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(f"Files: {len(paths)}"))
        self.stdout.write(f"Listed students (unique PCS ids): {len(by_id)}")
        if options["dry_run"]:
            self.stdout.write("Dry run - no database changes.")
        self.stdout.write(f"Promoted: {sum(promoted.values())}")
        self.stdout.write(f"Graduated (Ex-Students): {graduated}")
        self.stdout.write(f"Unchanged: {unchanged}")
        if missing_ids:
            self.stdout.write(
                f"Not in database (left unchanged): {len(missing_ids)}"
            )
            for sid, name, klass in missing_ids[:40]:
                self.stdout.write(f"  {sid}  {name}  ({klass})")
            if len(missing_ids) > 40:
                self.stdout.write(f"  … {len(missing_ids) - 40} more")
        if promoted:
            self.stdout.write("Promoted into:")
            for label in sorted(promoted):
                self.stdout.write(f"  {label}: {promoted[label]}")
        if not options["no_activate"]:
            self.stdout.write(f"Active session: {options['to_session']}")

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
            destination = PROMOTION_MAP.get(level_name)
            dest_label = "Ex-Students" if destination is None else destination
            self.stdout.write(
                f"{path.name}: {count} students  {class_label} -> {dest_label}"
            )
            if skipped:
                self.stdout.write(f"  skipped rows without PCS id: {skipped}")
        return listed

    def _place_promoted(
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
        if student.promotion_status != PromotionStatus.PROMOTED:
            student.promotion_status = PromotionStatus.PROMOTED
            fields.append("promotion_status")
        if not fields:
            return False
        if not dry_run:
            student.save(update_fields=[*fields, "updated_at"])
        return True

    def _graduate(
        self, student: StudentProfile, *, full_name: str, dry_run: bool
    ) -> bool:
        fields = []
        if full_name and student.full_name != full_name:
            student.full_name = full_name
            fields.append("full_name")
        if student.is_active:
            student.is_active = False
            fields.append("is_active")
        if student.class_arm_id is not None:
            student.class_arm = None
            fields.append("class_arm")
        if student.promotion_status != PromotionStatus.GRADUATED:
            student.promotion_status = PromotionStatus.GRADUATED
            fields.append("promotion_status")
        if not fields:
            return False
        if not dry_run:
            student.save(update_fields=[*fields, "updated_at"])
        return True

    def _activate_session(self, session_name: str, *, dry_run: bool) -> None:
        start_year = int(session_name.split("/")[0])
        if dry_run:
            exists = AcademicSession.objects.filter(name=session_name).exists()
            self.stdout.write(
                f"Would {'use existing' if exists else 'create'} and activate "
                f"session {session_name}"
            )
            return
        session, created = AcademicSession.objects.get_or_create(
            name=session_name,
            defaults={
                "start_year": start_year,
                "is_active": True,
                "students_promoted_for_session": True,
            },
        )
        ensure_session_terms(session)
        updates = []
        if session.start_year != start_year:
            session.start_year = start_year
            updates.append("start_year")
        if not session.students_promoted_for_session:
            session.students_promoted_for_session = True
            updates.append("students_promoted_for_session")
        if not session.is_active:
            session.is_active = True
            updates.append("is_active")
        if created:
            return
        if updates:
            session.save(update_fields=updates)
        elif not session.is_active:
            session.is_active = True
            session.save()
