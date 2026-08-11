from __future__ import annotations

import re
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from academics.models import AcademicSession, ClassArm, ClassLevel, Subject, Term
from academics.services.terms import ensure_session_terms
from accounts.models import AccountType, StudentProfile, User
from assessments.models import AssessmentScore

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "openpyxl is required. Install it with: pip install openpyxl"
    ) from exc


DEFAULT_RESULTS_DIR = Path(__file__).resolve().parents[2] / "data" / "results"
DEFAULT_PASSWORD = "school"

SKIP_HEADERS = {"NAME", "TOTAL", "AVERAGE", "POSITION", "POS", "AVG"}

# Filename token → canonical class level name.
FILE_CLASS_MAP = {
    "NURSERYPRE": "Day Care",
    "DAYCARE": "Day Care",
    "NURSERY1": "Nursery 1",
    "NURSERY2": "Nursery 2",
    "NURSERY3": "Nursery 2",
    "PRIMARY1": "Basic 1",
    "PRIMARY2": "Basic 2",
    "PRIMARY3": "Basic 3",
    "PRIMARY4": "Basic 4",
    "PRIMARY5": "Basic 5",
    "BASIC1": "Basic 1",
    "BASIC2": "Basic 2",
    "BASIC3": "Basic 3",
    "BASIC4": "Basic 4",
    "BASIC5": "Basic 5",
    "JSS1": "JSS1",
    "JSS2": "JSS2",
    "JSS3": "JSS3",
    "SS1": "SS1",
    "SS2": "SS2",
    "SS3": "SS3",
    "SSS1": "SS1",
    "SSS2": "SS2",
    "SSS3": "SS3",
}

# Excel subject header (first line, upper) → canonical subject name.
HEADER_TO_SUBJECT = {
    "LETTER": "Letter",
    "NUMBER": "Number",
    "SCIENCE": "Science",
    "SOCIAL": "Social Studies",
    "DRAWING": "Drawing",
    "BIBLE": "Bible",
    "PRACTICAL": "Practical",
    "RHYME": "Rhyme",
    "HAND": "Handwriting",
    "HANDWRITING": "Handwriting",
    "QUANTITATIVE": "Quantitative",
    "VERBAL": "Verbal",
    "HEALTH": "Health Education",
    "LANGUAGE": "Language",
    "DICTION": "Diction",
    "DICTION/PHONICS": "Diction",
    "PHONICS": "Phonics",
    "ENGLISH": "English Language",
    "MATHEMATICS": "Mathematics",
    "MATHS": "Mathematics",
    "ELEMENTARY": "Elementary Science",
    "P.H.E": "Physical Health Education",
    "PHE": "Physical Health Education",
    "C.R.K": "Christian Religious Knowledge",
    "C.R.S": "Christian Religious Studies",
    "CRS": "Christian Religious Studies",
    "SPELLING": "Spelling",
    "HOME": "Home Economics",
    "CREATIVE": "Creative Arts",
    "FRENCH": "French",
    "CIVIC": "Civic Education",
    "AGRIC.": "Agricultural Science",
    "AGRIC": "Agricultural Science",
    "COMPUTER": "Computer Studies",
    "ICT": "ICT",
    "MUSIC": "Music",
    "BUSINESS": "Business Studies",
    "TECHNICAL": "Technical Drawing",
    "LIT.": "Literature In English",
    "LIT": "Literature In English",
    "LITERATURE": "Literature In English",
    "BASIC": "Basic Science",  # first occurrence; second remapped below
    "FURTHER": "Further Mathematics",
    "PHYSICS": "Physics",
    "CHEMISTRY": "Chemistry",
    "BIOLOGY": "Biology",
    "FINANCIAL": "Financial Accounting",
    "MARKETING": "Marketing",
    "GOVERNMENT": "Government",
    "DATA": "Data Processing",
    "COMMERCE": "Commerce",
    "GEOGRAPHY": "Geography",
    "ECONOMICS": "Economics",
    "FOOD": "Food and Nutrition",
    "YORUBA": "Yoruba",
    "CATERING": "Catering Craft",
}

# Prefer matching these existing names when looking up by alias set.
SUBJECT_ALIASES: dict[str, tuple[str, ...]] = {
    "Social Studies": ("Social", "Social Studies", "Social Science"),
    "Health Education": ("Health", "Health Education", "Health Science"),
    "English Language": ("English", "English Language"),
    "Physical Health Education": ("P.H.E", "PHE", "Physical Health Education", "Physical Education"),
    "Christian Religious Knowledge": ("C.R.K", "CRK", "Christian Religious Knowledge"),
    "Christian Religious Studies": ("C.R.S", "CRS", "Christian Religious Studies"),
    "Computer Studies": ("Computer", "Computer Studies", "Computer Practical"),
    "ICT": ("ICT", "Computer Practical", "Computer Studies"),
    "Agricultural Science": ("Agric", "Agric.", "Agricultural Science"),
    "Literature In English": ("Lit.", "Lit", "Literature", "Literature In English"),
    "Handwriting": ("Hand", "Handwriting"),
    "Diction": ("Diction", "Diction/Phonics", "Phonics"),
}

STUDENT_ID_RE = re.compile(r"\b(PCS0?\d{2}\d+)\b", re.I)
SCORE_RE = re.compile(
    r"(?P<total>\d+)\s+(?P<ca1>\d+)-\s*(?P<ca2>\d+)-\s*(?P<exam>\d+)-",
    re.S,
)
FILE_META_RE = re.compile(
    r"(?P<y1>\d{4})[_/](?P<y2>\d{4}).*?(?P<klass>[A-Z]+\d+[A-Z]?).*?(?P<term>FIRST|SECOND|THIRD)",
    re.I,
)


def neat_name(value: str) -> str:
    name = re.sub(r"\s+", " ", (value or "").strip())
    if not name:
        return ""
    letters = re.sub(r"[^A-Za-z]", "", name)
    if letters and (letters.isupper() or letters.islower()):
        return name.title()
    return name


def clamp(value: Decimal, maximum: Decimal) -> Decimal:
    if value < 0:
        return Decimal("0")
    if value > maximum:
        return maximum
    return value


def parse_header_label(raw) -> str | None:
    if raw is None:
        return None
    text = str(raw).replace("\r", "")
    first = text.split("\n", 1)[0]
    label = re.sub(r"\s+", " ", first).strip().upper()
    if not label or label in SKIP_HEADERS:
        return None
    return label


def resolve_subject_names(headers: list[str], *, class_level_name: str) -> list[str]:
    """
    Map Excel headers to canonical subject names for a class level.
    Handles duplicate BASIC → Basic Science / Basic Technology and other duplicates.
    Nursery/Day Care keep short Social / Health names.
    """
    nursery_band = class_level_name in {"Day Care", "Nursery 1", "Nursery 2"}
    names: list[str] = []
    basic_count = 0
    seen: dict[str, int] = {}

    for header in headers:
        if header == "BASIC":
            basic_count += 1
            name = "Basic Science" if basic_count == 1 else "Basic Technology"
        else:
            name = HEADER_TO_SUBJECT.get(header)
            if not name:
                # Fallback: title-case cleaned header.
                name = neat_name(header.replace(".", " ").replace("/", " "))
            if nursery_band:
                if name == "Social Studies":
                    name = "Social"
                elif name == "Health Education":
                    name = "Health"

        count = seen.get(name, 0) + 1
        seen[name] = count
        if count > 1:
            # Preserve a second column that shares a label (e.g. SS3 Economics).
            name = f"{name} {count}"
            seen[name] = 1
        names.append(name)
    return names


def parse_student_cell(raw) -> tuple[str, str]:
    if raw is None:
        return "", ""
    if hasattr(raw, "isoformat") and not isinstance(raw, str):
        return "", ""
    text = str(raw).replace("\r", "").strip()
    if not text:
        return "", ""
    match = STUDENT_ID_RE.search(text)
    student_id = match.group(1).upper() if match else ""
    # Normalize PCS025047 style (already matches).
    if student_id and not student_id.startswith("PCS0") and student_id.startswith("PCS"):
        # PCS25047 → keep as-is if already PCS0yy
        pass
    name_part = STUDENT_ID_RE.sub("", text)
    name_part = re.sub(r"[\n\r]+", " ", name_part)
    name = neat_name(name_part)
    return student_id, name


def parse_score_cell(raw) -> tuple[Decimal, Decimal, Decimal] | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float, Decimal)):
        # Rare: numeric-only cell — treat as exam-less empty.
        return None
    text = str(raw)
    match = SCORE_RE.search(text)
    if not match:
        return None
    ca1 = clamp(Decimal(match.group("ca1")), Decimal("20"))
    ca2 = clamp(Decimal(match.group("ca2")), Decimal("20"))
    exam = clamp(Decimal(match.group("exam")), Decimal("60"))
    return ca1, ca2, exam


def admission_year_from_regno(regno: str) -> int:
    match = re.match(r"^PCS0?(\d{2})", regno.upper())
    if match:
        return 2000 + int(match.group(1))
    return 2025


def parse_file_meta(path: Path) -> tuple[str, str, str, int, int]:
    """
    Returns (session_name, class_level_name, arm_name, term_number, start_year).
    """
    stem = path.stem
    # Prefer explicit tokens from known naming: 2025_2026_NURSERY1A__FIRST_TERM...
    session_match = re.search(r"(20\d{2})[_/](20\d{2})", stem)
    if not session_match:
        raise CommandError(f"Cannot parse session from filename: {path.name}")
    session_name = f"{session_match.group(1)}/{session_match.group(2)}"
    start_year = int(session_match.group(1))

    class_match = re.search(
        r"(NURSERYPRE|DAYCARE|NURSERY\d+|PRIMARY\d+|BASIC\d+|JSS\d+|SSS?\d+)([A-Z])?",
        stem.upper(),
    )
    if not class_match:
        raise CommandError(f"Cannot parse class from filename: {path.name}")
    level_key = class_match.group(1)
    arm = (class_match.group(2) or "A").upper()
    level_name = FILE_CLASS_MAP.get(level_key)
    if not level_name:
        raise CommandError(f"Unknown class token {level_key} in {path.name}")

    term_match = re.search(r"(FIRST|SECOND|THIRD)\s*_?TERM", stem.upper())
    if not term_match:
        raise CommandError(f"Cannot parse term from filename: {path.name}")
    term_number = {"FIRST": 1, "SECOND": 2, "THIRD": 3}[term_match.group(1)]
    return session_name, level_name, arm, term_number, start_year


class Command(BaseCommand):
    help = (
        "Import First/Second/Third Term score sheets from class Excel files, "
        "ensuring the session and term exist and are activated."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            type=str,
            default=str(DEFAULT_RESULTS_DIR),
            help="Directory containing 2025_2026_*_*_TERM*.xlsx files",
        )
        parser.add_argument(
            "--term",
            type=str,
            choices=["first", "second", "third", "1", "2", "3", "all"],
            default="all",
            help="Only import sheets for this term number (default: all files in dir)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing to the database",
        )
        parser.add_argument(
            "--session",
            type=str,
            default="",
            help="Override session name (default: parsed from filenames)",
        )
        parser.add_argument(
            "--activate",
            action="store_true",
            default=True,
            help="Activate the session and term after import (default: true)",
        )
        parser.add_argument(
            "--no-activate",
            action="store_false",
            dest="activate",
            help="Do not change which session/term is active",
        )
        parser.add_argument(
            "--publish",
            action="store_true",
            default=True,
            help="Mark imported scores as published (default: true)",
        )
        parser.add_argument(
            "--draft",
            action="store_false",
            dest="publish",
            help="Leave imported scores as draft",
        )

    def handle(self, *args, **options):
        results_dir = Path(options["dir"])
        if not results_dir.exists():
            raise CommandError(f"Results directory not found: {results_dir}")

        files = sorted(results_dir.glob("*.xlsx"))
        if not files:
            raise CommandError(f"No .xlsx files in {results_dir}")

        totals = {
            "files": 0,
            "students": 0,
            "students_created": 0,
            "scores_upserted": 0,
            "subjects_created": 0,
            "skipped_rows": 0,
            "empty_scores": 0,
        }

        # Group by session from filenames; typically one session.
        parsed_files: list[tuple[Path, tuple]] = []
        for path in files:
            meta = parse_file_meta(path)
            if options["session"]:
                # Keep class/term from file; override session name.
                session_name = options["session"]
                start_year = int(session_name.split("/")[0])
                meta = (session_name, meta[1], meta[2], meta[3], start_year)
            parsed_files.append((path, meta))

        with transaction.atomic():
            for path, meta in parsed_files:
                session_name, level_name, arm_name, term_number, start_year = meta
                session = self._ensure_session(session_name, start_year, activate=False)
                ensure_session_terms(session)
                term = Term.objects.get(session=session, number=term_number)
                class_arm = self._ensure_class_arm(level_name, arm_name)

                stats = self._import_file(
                    path,
                    session=session,
                    term=term,
                    class_arm=class_arm,
                    dry_run=options["dry_run"],
                    publish=options["publish"],
                )
                totals["files"] += 1
                for key in (
                    "students",
                    "students_created",
                    "scores_upserted",
                    "subjects_created",
                    "skipped_rows",
                    "empty_scores",
                ):
                    totals[key] += stats[key]
                self.stdout.write(
                    f"{path.name}: {class_arm.label} / {term.name} — "
                    f"{stats['students']} students, {stats['scores_upserted']} scores, "
                    f"{stats['subjects_created']} subjects created"
                )

            if options["dry_run"]:
                raise CommandError("Dry run complete — rolling back.")

            if options["activate"] and parsed_files:
                # Activate the session/term from the first file (all should match).
                session_name = parsed_files[0][1][0]
                term_number = parsed_files[0][1][3]
                start_year = parsed_files[0][1][4]
                session = self._ensure_session(session_name, start_year, activate=True)
                ensure_session_terms(session)
                Term.objects.filter(session=session).exclude(number=term_number).update(
                    is_active=False
                )
                term = Term.objects.get(session=session, number=term_number)
                term.is_active = True
                term.results_entry_open = True
                term.save()

        self.stdout.write(self.style.SUCCESS("Term results import finished."))
        self.stdout.write(
            f"Files {totals['files']}, students {totals['students']} "
            f"(created {totals['students_created']}), "
            f"scores upserted {totals['scores_upserted']}, "
            f"subjects created {totals['subjects_created']}, "
            f"empty score cells {totals['empty_scores']}, "
            f"skipped rows {totals['skipped_rows']}"
        )

    def _ensure_session(
        self, name: str, start_year: int, *, activate: bool
    ) -> AcademicSession:
        session, _ = AcademicSession.objects.get_or_create(
            name=name,
            defaults={"start_year": start_year, "is_active": activate},
        )
        fields = []
        if session.start_year != start_year:
            session.start_year = start_year
            fields.append("start_year")
        if activate and not session.is_active:
            session.is_active = True
            fields.append("is_active")
        if fields:
            session.save(update_fields=fields)
        elif activate:
            # Touch save so the model's exclusivity logic runs.
            session.is_active = True
            session.save()
        return session

    def _ensure_class_arm(self, level_name: str, arm_name: str) -> ClassArm:
        level = ClassLevel.objects.filter(name=level_name).first()
        if level is None:
            raise CommandError(f"Class level missing: {level_name}. Seed class levels first.")
        arm, _ = ClassArm.objects.get_or_create(
            class_level=level,
            name=arm_name,
            defaults={"label": f"{level_name}{arm_name}"},
        )
        return arm

    def _import_file(
        self,
        path: Path,
        *,
        session: AcademicSession,
        term: Term,
        class_arm: ClassArm,
        dry_run: bool,
        publish: bool,
    ) -> dict:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active

        header_labels: list[str] = []
        header_cols: list[int] = []
        for col in range(1, ws.max_column + 1):
            label = parse_header_label(ws.cell(1, col).value)
            if not label:
                continue
            header_labels.append(label)
            header_cols.append(col)

        subject_names = resolve_subject_names(
            header_labels, class_level_name=class_arm.class_level.name
        )
        subjects: list[Subject] = []
        subjects_created = 0
        for order, name in enumerate(subject_names, start=1):
            subject, created = self._ensure_subject(class_arm.class_level, name, order)
            subjects.append(subject)
            if created:
                subjects_created += 1

        if not dry_run:
            # Replace prior scores for this class arm + term so the sheet is authoritative.
            AssessmentScore.objects.filter(term=term, class_arm=class_arm).delete()

        stats = {
            "students": 0,
            "students_created": 0,
            "scores_upserted": 0,
            "subjects_created": subjects_created,
            "skipped_rows": 0,
            "empty_scores": 0,
        }
        status = (
            AssessmentScore.Status.PUBLISHED
            if publish
            else AssessmentScore.Status.DRAFT
        )
        published_at = timezone.now() if publish else None

        for row_idx in range(2, ws.max_row + 1):
            student_id, full_name = parse_student_cell(ws.cell(row_idx, 1).value)
            if not student_id:
                if full_name or any(
                    ws.cell(row_idx, col).value not in (None, "") for col in header_cols
                ):
                    stats["skipped_rows"] += 1
                continue

            student, created = self._ensure_student(
                student_id, full_name, class_arm=class_arm, dry_run=dry_run
            )
            stats["students"] += 1
            if created:
                stats["students_created"] += 1

            for subject, col in zip(subjects, header_cols):
                parsed = parse_score_cell(ws.cell(row_idx, col).value)
                if parsed is None:
                    stats["empty_scores"] += 1
                    continue
                ca1, ca2, exam = parsed
                if dry_run:
                    stats["scores_upserted"] += 1
                    continue
                AssessmentScore.objects.update_or_create(
                    student=student,
                    subject=subject,
                    term=term,
                    defaults={
                        "class_arm": class_arm,
                        "ca1": ca1,
                        "ca2": ca2,
                        "exam": exam,
                        "status": status,
                        "published_at": published_at,
                    },
                )
                stats["scores_upserted"] += 1

        return stats

    def _ensure_subject(
        self, class_level: ClassLevel, name: str, order: int
    ) -> tuple[Subject, bool]:
        # Try exact name, then aliases, then create.
        subject = Subject.objects.filter(class_level=class_level, name=name).first()
        if subject is None:
            aliases = SUBJECT_ALIASES.get(name, ())
            if aliases:
                subject = (
                    Subject.objects.filter(class_level=class_level, name__in=aliases)
                    .order_by("order", "name")
                    .first()
                )
                # Also try case-insensitive exact against aliases + name.
            if subject is None:
                for candidate in (name, *SUBJECT_ALIASES.get(name, ())):
                    subject = Subject.objects.filter(
                        class_level=class_level, name__iexact=candidate
                    ).first()
                    if subject:
                        break

        if subject is None:
            subject = Subject.objects.create(
                class_level=class_level,
                name=name,
                subject_type=Subject.SubjectType.SUBJECT,
                is_active=True,
                order=order,
            )
            return subject, True

        fields = []
        if subject.order != order:
            subject.order = order
            fields.append("order")
        if not subject.is_active:
            subject.is_active = True
            fields.append("is_active")
        if fields:
            subject.save(update_fields=fields)
        return subject, False

    def _ensure_student(
        self,
        student_id: str,
        full_name: str,
        *,
        class_arm: ClassArm,
        dry_run: bool,
    ) -> tuple[StudentProfile | None, bool]:
        student = (
            StudentProfile.objects.select_related("user")
            .filter(student_id__iexact=student_id)
            .first()
        )
        if student is not None:
            if dry_run:
                return student, False
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
            if fields:
                student.save(update_fields=fields)
            return student, False

        if dry_run:
            return None, True

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
        student = StudentProfile.objects.create(
            user=user,
            student_id=student_id.upper(),
            full_name=name,
            admission_year=admission_year_from_regno(student_id),
            class_arm=class_arm,
            email=email,
            is_active=True,
        )
        return student, True
