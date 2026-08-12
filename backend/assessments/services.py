from collections import defaultdict
from decimal import Decimal

from academics.models import ClassArm, Subject
from accounts.models import StudentProfile
from assessments.models import AssessmentScore


def class_subjects_for_arm(class_arm: ClassArm):
    return list(
        Subject.objects.filter(
            class_level_id=class_arm.class_level_id,
            is_active=True,
            subject_type=Subject.SubjectType.SUBJECT,
        )
        .order_by("order", "name")
        .only("id", "name")
    )


def class_publish_blockers(term, class_arm: ClassArm) -> list[str]:
    """Requirements before a class can be published for a term."""
    blockers: list[str] = []

    if not term.next_term_resumption:
        blockers.append("Next term begins date has not been set for this term.")

    subjects = class_subjects_for_arm(class_arm)
    if not subjects:
        blockers.append(
            f"Number of subjects has not been set up for {class_arm.label or class_arm}."
        )

    students = list(
        StudentProfile.objects.filter(class_arm=class_arm, is_active=True).only("id", "full_name")
    )
    if not students:
        blockers.append(f"No active students in {class_arm.label or class_arm}.")

    if subjects and students:
        subject_ids = [s.id for s in subjects]
        existing = {
            (row["student_id"], row["subject_id"])
            for row in AssessmentScore.objects.filter(
                term=term,
                class_arm=class_arm,
                student_id__in=[s.id for s in students],
                subject_id__in=subject_ids,
            ).values("student_id", "subject_id")
        }
        expected = len(students) * len(subject_ids)
        have = len(existing)
        if have < expected:
            blockers.append(
                f"Not all results have been entered "
                f"({have}/{expected} student–subject scores)."
            )

    return blockers


def term_publish_blockers(term) -> list[str]:
    """Blockers for publishing every class arm with students in a term."""
    blockers: list[str] = []
    if not term.next_term_resumption:
        blockers.append("Next term begins date has not been set for this term.")

    arms = (
        ClassArm.objects.select_related("class_level")
        .filter(students__is_active=True)
        .distinct()
        .order_by("class_level__order", "name")
    )
    for arm in arms:
        class_blockers = class_publish_blockers(term, arm)
        # Avoid repeating the shared next-term message for every class.
        class_blockers = [
            b for b in class_blockers if "Next term begins" not in b
        ]
        for b in class_blockers:
            blockers.append(f"{arm.label or arm}: {b}")
    return blockers


def score_total(score: AssessmentScore) -> Decimal:
    return (score.ca1 or Decimal("0")) + (score.ca2 or Decimal("0")) + (score.exam or Decimal("0"))


def grade_for_score(score) -> tuple[str, str]:
    """Return (letter, word) using PCIMS key to gradings."""
    try:
        value = float(score)
    except (TypeError, ValueError):
        return ("—", "—")
    if value >= 70:
        return ("A", "EXCELLENT")
    if value >= 60:
        return ("B", "VERY GOOD")
    if value >= 50:
        return ("C", "GOOD")
    if value >= 45:
        return ("D", "FAIR")
    if value >= 40:
        return ("E", "PASS")
    if value > 0:
        return ("F", "FAIL")
    return ("—", "—")


def ordinal(n: int) -> str:
    if n <= 0:
        return "—"
    if 10 <= (n % 100) <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def report_band_title(class_level_name: str) -> str:
    name = (class_level_name or "").strip().lower()
    if "day care" in name or "nursery" in name:
        return "Pupil's Progressive Report (Nursery)"
    if name.startswith("basic") or "primary" in name:
        return "Pupil's Progressive Report (Primary)"
    if name.startswith("jss") or name.startswith("ss"):
        return "Student's Progressive Report (Secondary)"
    return "Progressive Report Card"


def auto_remark_for_average(average) -> tuple[str, str]:
    """Teacher / principal style remarks from average."""
    letter, word = grade_for_score(average)
    if letter == "A":
        return ("An excellent result — keep it up.", "Excellent result, keep it up.")
    if letter == "B":
        return ("A very good result — keep working hard.", "Very good performance. Keep it up.")
    if letter == "C":
        return ("A good result — you can still do better.", "Good effort. Aim higher next term.")
    if letter == "D":
        return ("A fair result — more effort is needed.", "Fair performance. Improve next term.")
    if letter in ("E", "F"):
        return ("Needs serious improvement next term.", "Weak result. Extra support recommended.")
    return ("", "")


def subject_positions_for_arm(class_arm_id: int, term_id: int, published_only: bool = True) -> dict[int, dict[int, int]]:
    """Map subject_id -> {student_id: position} for the class arm/term."""
    qs = AssessmentScore.objects.filter(class_arm_id=class_arm_id, term_id=term_id)
    if published_only:
        qs = qs.filter(status=AssessmentScore.Status.PUBLISHED)
    by_subject: dict[int, list[tuple[int, Decimal]]] = defaultdict(list)
    for row in qs.only("student_id", "subject_id", "ca1", "ca2", "exam"):
        by_subject[row.subject_id].append((row.student_id, score_total(row)))

    result: dict[int, dict[int, int]] = {}
    for subject_id, rows in by_subject.items():
        rows.sort(key=lambda item: item[1], reverse=True)
        positions: dict[int, int] = {}
        position = 0
        last_total = None
        for index, (student_id, total) in enumerate(rows, start=1):
            if last_total is None or total != last_total:
                position = index
                last_total = total
            positions[student_id] = position
        result[subject_id] = positions
    return result


def compute_progressive_report(student, term, published_only: bool = False):
    """
    Rich progressive report payload used by the branded report-card PDF.
    Includes prior-term totals in the same session, subject positions, and grades.
    """
    from academics.models import Term

    session_terms = list(
        Term.objects.filter(session_id=term.session_id).order_by("number")
    )
    term_by_number = {t.number: t for t in session_terms}

    score_qs = AssessmentScore.objects.filter(
        student_id=student.id,
        term__session_id=term.session_id,
    ).select_related("subject", "term")
    if published_only:
        score_qs = score_qs.filter(status=AssessmentScore.Status.PUBLISHED)

    # subject_id -> term_number -> score components
    by_subject: dict[int, dict] = {}
    for score in score_qs:
        entry = by_subject.setdefault(
            score.subject_id,
            {
                "subject_id": score.subject_id,
                "subject_name": score.subject.name,
                "subject_type": score.subject.subject_type,
                "order": score.subject.order,
                "terms": {},
            },
        )
        entry["terms"][score.term.number] = {
            "ca1": score.ca1,
            "ca2": score.ca2,
            "exam": score.exam,
            "total": score_total(score),
            "status": score.status,
        }

    # Prefer class subject order; fall back to scored subjects.
    class_subjects = []
    if student.class_arm_id:
        class_subjects = class_subjects_for_arm(student.class_arm)
    if class_subjects:
        ordered_ids = [s.id for s in class_subjects]
        for subject in class_subjects:
            by_subject.setdefault(
                subject.id,
                {
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                    "subject_type": subject.subject_type,
                    "order": subject.order,
                    "terms": {},
                },
            )
        subject_rows_raw = [by_subject[sid] for sid in ordered_ids if sid in by_subject]
    else:
        subject_rows_raw = sorted(
            by_subject.values(),
            key=lambda r: (r.get("order") or 0, r["subject_name"]),
        )

    positions = {}
    if student.class_arm_id:
        positions = subject_positions_for_arm(
            student.class_arm_id,
            term.id,
            published_only=published_only,
        )

    current_n = term.number
    rows = []
    current_total = Decimal("0")
    scored_count = 0
    for entry in subject_rows_raw:
        terms = entry["terms"]
        t1 = terms.get(1, {}).get("total")
        t2 = terms.get(2, {}).get("total")
        current = terms.get(current_n, {})
        ca1 = current.get("ca1")
        ca2 = current.get("ca2")
        exam = current.get("exam")
        t_cur = current.get("total")

        prior_vals = [v for v in (t1, t2) if v is not None]
        # Cumulative across terms that have scores (plus current if present)
        cum_parts = []
        for n in (1, 2, 3):
            if n in terms:
                cum_parts.append(terms[n]["total"])
        cumulative = sum(cum_parts, Decimal("0")) if cum_parts else None
        terms_with_scores = len(cum_parts)
        average_total = (
            (cumulative / terms_with_scores) if terms_with_scores else None
        )

        # Grade/remark from current term total (fallback to session average)
        grade_source = t_cur if t_cur is not None else average_total
        letter, word = grade_for_score(grade_source if grade_source is not None else 0)

        if t_cur is not None and entry.get("subject_type") == Subject.SubjectType.SUBJECT:
            current_total += t_cur
            scored_count += 1

        pos = positions.get(entry["subject_id"], {}).get(student.id)
        rows.append(
            {
                "subject_id": entry["subject_id"],
                "subject_name": entry["subject_name"],
                "term1_total": t1,
                "term2_total": t2,
                "ca1": ca1,
                "ca2": ca2,
                "exam": exam,
                "term_total": t_cur,
                "cumulative": cumulative,
                "average_total": average_total,
                "grade_word": word,
                "grade_letter": letter,
                "position": ordinal(pos) if pos else "—",
            }
        )

    average = (current_total / scored_count) if scored_count else Decimal("0")
    class_rankings = (
        rank_class_arm(student.class_arm_id, term.id, published_only=True)
        if student.class_arm_id
        else []
    )
    position = next(
        (r["position"] for r in class_rankings if r["student_id"] == student.id),
        None,
    )

    return {
        "student_id": student.id,
        "term_id": term.id,
        "session_terms": session_terms,
        "term_by_number": term_by_number,
        "total": current_total,
        "average": average,
        "subject_count": scored_count,
        "class_position": ordinal(position) if position else "—",
        "subjects": rows,
        "band_title": report_band_title(
            getattr(getattr(student.class_arm, "class_level", None), "name", "") or ""
        ),
    }


def compute_student_result(student_id: int, term_id: int, scores=None):
    if scores is None:
        scores = list(
            AssessmentScore.objects.filter(student_id=student_id, term_id=term_id).select_related(
                "subject"
            )
        )
    total = Decimal("0")
    subject_count = 0
    subject_rows = []
    for s in scores:
        t = score_total(s)
        total += t
        if s.subject.subject_type == Subject.SubjectType.SUBJECT:
            subject_count += 1
        subject_rows.append(
            {
                "subject_id": s.subject_id,
                "subject_name": s.subject.name,
                "subject_type": s.subject.subject_type,
                "ca1": s.ca1,
                "ca2": s.ca2,
                "exam": s.exam,
                "total": t,
                "status": s.status,
            }
        )
    average = (total / subject_count) if subject_count else Decimal("0")
    return {
        "student_id": student_id,
        "term_id": term_id,
        "total": total,
        "average": average,
        "subject_count": subject_count,
        "subjects": subject_rows,
    }


def rank_class_arm(class_arm_id: int, term_id: int, published_only: bool = True):
    qs = AssessmentScore.objects.filter(class_arm_id=class_arm_id, term_id=term_id).select_related(
        "student", "subject"
    )
    if published_only:
        qs = qs.filter(status=AssessmentScore.Status.PUBLISHED)

    by_student = defaultdict(list)
    for score in qs:
        by_student[score.student_id].append(score)

    results = []
    for student_id, scores in by_student.items():
        computed = compute_student_result(student_id, term_id, scores)
        student = scores[0].student
        computed["student_name"] = student.full_name
        computed["student_code"] = student.student_id
        results.append(computed)

    results.sort(key=lambda r: r["total"], reverse=True)

    # Shared rank, next skipped (1, 2, 2, 4)
    position = 0
    last_total = None
    for index, row in enumerate(results, start=1):
        if last_total is None or row["total"] != last_total:
            position = index
            last_total = row["total"]
        row["position"] = position
    return results


def build_general_report(class_arm_id: int, term_id: int, published_only: bool = True):
    """Matrix report for General Report Sheet: all students × class subjects."""
    from academics.models import ClassArm, Term

    class_arm = (
        ClassArm.objects.select_related("class_level").filter(id=class_arm_id).first()
    )
    term = Term.objects.select_related("session").filter(id=term_id).first()
    if not class_arm or not term:
        return None

    subjects = class_subjects_for_arm(class_arm)
    students = list(
        StudentProfile.objects.filter(class_arm_id=class_arm_id, is_active=True)
        .order_by("full_name")
        .only("id", "full_name", "student_id")
    )

    qs = AssessmentScore.objects.filter(
        class_arm_id=class_arm_id, term_id=term_id
    ).select_related("subject")
    if published_only:
        qs = qs.filter(status=AssessmentScore.Status.PUBLISHED)

    scores_by_student: dict[int, dict[int, dict]] = defaultdict(dict)
    for score in qs:
        scores_by_student[score.student_id][score.subject_id] = {
            "ca1": float(score.ca1 or 0),
            "ca2": float(score.ca2 or 0),
            "exam": float(score.exam or 0),
            "total": float(score_total(score)),
            "status": score.status,
        }

    subject_count = len(subjects)
    rows = []
    for student in students:
        by_subject = scores_by_student.get(student.id, {})
        total = Decimal("0")
        cells: dict[str, dict] = {}
        for subject in subjects:
            cell = by_subject.get(subject.id)
            if cell:
                total += Decimal(str(cell["total"]))
                cells[str(subject.id)] = cell
            else:
                cells[str(subject.id)] = {
                    "ca1": 0,
                    "ca2": 0,
                    "exam": 0,
                    "total": 0,
                    "status": None,
                }
        average = (total / subject_count) if subject_count else Decimal("0")
        rows.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "student_code": student.student_id,
                "total": float(total),
                "average": float(round(average, 2)),
                "by_subject": cells,
            }
        )

    rows.sort(key=lambda r: (-r["total"], r["student_name"]))
    position = 0
    last_total = None
    for index, row in enumerate(rows, start=1):
        if last_total is None or row["total"] != last_total:
            position = index
            last_total = row["total"]
        row["position"] = position

    return {
        "session": {"id": term.session_id, "name": term.session.name},
        "term": {"id": term.id, "name": term.name, "number": term.number},
        "class_level": {
            "id": class_arm.class_level_id,
            "name": class_arm.class_level.name,
        },
        "class_arm": {
            "id": class_arm.id,
            "name": class_arm.name,
            "label": class_arm.label or str(class_arm),
        },
        "subjects": [{"id": s.id, "name": s.name} for s in subjects],
        "rows": rows,
    }
