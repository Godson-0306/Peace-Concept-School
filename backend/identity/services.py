import io
import zipfile
from pathlib import Path

import barcode
import qrcode
from barcode.writer import ImageWriter
from django.conf import settings
from django.core.files.base import ContentFile
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from assessments.models import StudentFormRecord
from assessments.services import (
    auto_remark_for_average,
    compute_progressive_report,
)
from identity.models import StudentIdCard

BRAND_BLUE = colors.HexColor("#1450A3")
BRAND_BLUE_DEEP = colors.HexColor("#0B3575")
BRAND_PINK = colors.HexColor("#E85A8C")
BRAND_PINK_SOFT = colors.HexColor("#FCE8F0")
BRAND_BLUE_SOFT = colors.HexColor("#E8F0FB")
INK = colors.HexColor("#1A2332")
MUTED = colors.HexColor("#5B6573")
LINE = colors.HexColor("#C9D2DE")
ROW_ALT = colors.HexColor("#F7F9FC")

SCHOOL_NAME = "Peace Concept International Mission Schools"
SCHOOL_ADDRESS = "No. 3 John Chukwu Crescent, Iboloji Layout, Rumuigbo, Port Harcourt"
SCHOOL_MOTTO = "Obey & Be Wise"


def _logo_path() -> Path | None:
    base = Path(settings.BASE_DIR).resolve().parent
    candidates = [
        base / "frontend" / "public" / "pcims-logo.jpeg",
        base / "pcims logo.jpeg",
        Path(settings.BASE_DIR) / "pcims-logo.jpeg",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def _fmt_score(value) -> str:
    if value is None:
        return ""
    try:
        num = float(value)
    except (TypeError, ValueError):
        return str(value)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}".rstrip("0").rstrip(".")


def _promotion_label(student) -> str:
    status = (getattr(student, "promotion_status", None) or "").lower()
    mapping = {
        "promoted": "Promoted",
        "retained": "Retained",
        "graduated": "Graduated",
        "pending": "—",
    }
    return mapping.get(status, "—")


def merge_pdfs(pdf_bytes_list: list[bytes]) -> bytes:
    """Combine multiple PDF byte streams into one multi-page PDF."""
    writer = PdfWriter()
    for pdf_bytes in pdf_bytes_list:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def zip_pdfs(entries: list[tuple[str, bytes]]) -> bytes:
    """Build a ZIP archive from (filename, pdf_bytes) pairs."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for filename, pdf_bytes in entries:
            zf.writestr(filename, pdf_bytes)
    return buffer.getvalue()


def generate_barcode_for_student(student) -> StudentIdCard:
    value = student.student_id
    code128 = barcode.get_barcode_class("code128")
    buffer = io.BytesIO()
    code128(value, writer=ImageWriter()).write(buffer)
    card, _ = StudentIdCard.objects.get_or_create(
        student=student,
        defaults={"barcode_value": value},
    )
    card.barcode_value = value
    card.barcode_image.save(f"{value}.png", ContentFile(buffer.getvalue()), save=False)

    qr_buffer = io.BytesIO()
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(value)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_img.save(qr_buffer, format="PNG")
    card.qr_image.save(f"{value}-qr.png", ContentFile(qr_buffer.getvalue()), save=False)
    card.save()
    return card


def build_report_card_pdf(student, term) -> bytes:
    """Branded progressive report card (PCIMS layout, polished)."""
    report = compute_progressive_report(student, term, published_only=False)
    form = (
        StudentFormRecord.objects.filter(student=student, term=term)
        .select_related("class_arm")
        .first()
    )

    session_name = getattr(getattr(term, "session", None), "name", "") or str(term)
    term_name = (term.name or f"Term {term.number}").upper()
    class_label = ""
    if student.class_arm:
        class_label = student.class_arm.label or str(student.class_arm)
    next_term = ""
    if term.next_term_resumption:
        next_term = term.next_term_resumption.isoformat()

    attendance = "—"
    if form:
        opened = form.days_present + form.days_absent
        attendance = f"{form.days_present} of {opened}" if opened else f"{form.days_present}"

    teacher_auto, principal_auto = auto_remark_for_average(report["average"])
    teacher_comment = (
        form.teacher_remark.strip() if form and form.teacher_remark else ""
    ) or teacher_auto
    principal_comment = principal_auto

    styles = {
        "school": ParagraphStyle(
            "school",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=BRAND_BLUE_DEEP,
            alignment=TA_CENTER,
        ),
        "address": ParagraphStyle(
            "address",
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "title": ParagraphStyle(
            "title",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=BRAND_PINK,
            alignment=TA_CENTER,
            spaceBefore=2,
            spaceAfter=2,
        ),
        "meta_label": ParagraphStyle(
            "meta_label",
            fontName="Helvetica",
            fontSize=6.5,
            leading=8,
            textColor=MUTED,
        ),
        "meta_value": ParagraphStyle(
            "meta_value",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=INK,
        ),
        "th": ParagraphStyle(
            "th",
            fontName="Helvetica-Bold",
            fontSize=5.5,
            leading=6.5,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "td": ParagraphStyle(
            "td",
            fontName="Helvetica",
            fontSize=7,
            leading=8.5,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "td_left": ParagraphStyle(
            "td_left",
            fontName="Helvetica",
            fontSize=7,
            leading=8.5,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "section": ParagraphStyle(
            "section",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=BRAND_BLUE_DEEP,
        ),
        "small": ParagraphStyle(
            "small",
            fontName="Helvetica",
            fontSize=6.5,
            leading=8,
            textColor=INK,
        ),
        "comment": ParagraphStyle(
            "comment",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=INK,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName="Helvetica",
            fontSize=6.5,
            leading=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )
    story = []
    page_width = A4[0] - 20 * mm

    # --- Header: logo | identity | photo ---
    logo_flow = Spacer(18 * mm, 18 * mm)
    logo_file = _logo_path()
    if logo_file:
        try:
            logo_flow = RLImage(
                str(logo_file), width=18 * mm, height=18 * mm, kind="proportional"
            )
        except Exception:
            pass

    identity = Table(
        [
            [Paragraph(SCHOOL_NAME.upper(), styles["school"])],
            [Paragraph(SCHOOL_ADDRESS, styles["address"])],
            [Paragraph(f"Motto: {SCHOOL_MOTTO}", styles["address"])],
            [Paragraph(report["band_title"], styles["title"])],
        ],
        colWidths=[page_width - 44 * mm],
    )
    identity.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    photo_cell = [
        Paragraph(
            "PASSPORT",
            ParagraphStyle(
                "ph",
                fontName="Helvetica",
                fontSize=6,
                textColor=MUTED,
                alignment=TA_CENTER,
            ),
        ),
        Paragraph(
            "PHOTO",
            ParagraphStyle(
                "ph2",
                fontName="Helvetica",
                fontSize=6,
                textColor=MUTED,
                alignment=TA_CENTER,
            ),
        ),
    ]
    photo_inner = Table([[x] for x in photo_cell], colWidths=[20 * mm])
    photo_inner.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    if getattr(student, "passport_photo", None):
        try:
            with student.passport_photo.open("rb") as fh:
                photo_bytes = fh.read()
            photo_inner = RLImage(
                io.BytesIO(photo_bytes),
                width=20 * mm,
                height=24 * mm,
                kind="proportional",
            )
        except Exception:
            pass

    photo_box = Table([[photo_inner]], colWidths=[22 * mm], rowHeights=[26 * mm])
    photo_box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1, BRAND_PINK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ]
        )
    )

    header = Table(
        [[logo_flow, identity, photo_box]],
        colWidths=[20 * mm, page_width - 44 * mm, 24 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 2.5 * mm))

    # Two-tone accent
    accent = Table(
        [["", ""]],
        colWidths=[page_width * 0.72, page_width * 0.28],
        rowHeights=[2.2 * mm],
    )
    accent.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), BRAND_BLUE),
                ("BACKGROUND", (1, 0), (1, 0), BRAND_PINK),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(accent)
    story.append(Spacer(1, 3 * mm))

    def meta_cell(label: str, value: str):
        return [
            Paragraph(label.upper(), styles["meta_label"]),
            Paragraph(value or "—", styles["meta_value"]),
        ]

    meta_rows = [
        [
            meta_cell("Name", (student.full_name or "").upper()),
            meta_cell("Session", session_name),
            meta_cell("Class", class_label.upper()),
            meta_cell("Term", term_name),
            meta_cell("Sex", (student.gender or "—").title()),
        ],
        [
            meta_cell("Total score", _fmt_score(report["total"])),
            meta_cell("Average", f"{float(report['average']):.2f}"),
            meta_cell("Class position", report["class_position"]),
            meta_cell("Next term begins", next_term or "—"),
            meta_cell("Admission no.", student.student_id),
        ],
        [
            meta_cell("Promoted", _promotion_label(student)),
            meta_cell("Attendance", attendance),
            meta_cell("Subjects", str(report["subject_count"])),
            meta_cell("CA1 max", "20"),
            meta_cell("Exam max", "60"),
        ],
    ]

    def pack(cell):
        t = Table([[cell[0]], [cell[1]]], colWidths=[page_width / 5 - 2])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE_SOFT),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return t

    meta_table_data = [[pack(c) for c in row] for row in meta_rows]
    meta = Table(meta_table_data, colWidths=[page_width / 5] * 5)
    meta.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 1),
                ("RIGHTPADDING", (0, 0), (-1, -1), 1),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )
    story.append(meta)
    story.append(Spacer(1, 3.5 * mm))

    # --- Academic table ---
    include_prior = bool(report.get("include_prior_terms"))
    term_n = term.number
    term_tag = {1: "1st", 2: "2nd", 3: "3rd"}.get(term_n, f"{term_n}th")

    if include_prior:
        headers = [
            Paragraph("SUBJECTS", styles["th"]),
            Paragraph("1st Term", styles["th"]),
            Paragraph("2nd Term", styles["th"]),
            Paragraph(f"{term_tag} CA1<br/>(20)", styles["th"]),
            Paragraph(f"{term_tag} CA2<br/>(20)", styles["th"]),
            Paragraph(f"{term_tag} Exam<br/>(60)", styles["th"]),
            Paragraph(f"{term_tag} Total<br/>(100)", styles["th"]),
            Paragraph("Session<br/>Total", styles["th"]),
            Paragraph("Average", styles["th"]),
            Paragraph("Grade", styles["th"]),
            Paragraph("Remark", styles["th"]),
            Paragraph("Pos.", styles["th"]),
        ]
        col_w = [
            page_width * 0.22,
            page_width * 0.065,
            page_width * 0.065,
            page_width * 0.065,
            page_width * 0.065,
            page_width * 0.065,
            page_width * 0.075,
            page_width * 0.075,
            page_width * 0.065,
            page_width * 0.10,
            page_width * 0.06,
            page_width * 0.06,
        ]
        total_col = 6
        grade_cols = (9, 10)
        empty_pad = 11
    else:
        headers = [
            Paragraph("SUBJECTS", styles["th"]),
            Paragraph("CA1<br/>(20)", styles["th"]),
            Paragraph("CA2<br/>(20)", styles["th"]),
            Paragraph("Exam<br/>(60)", styles["th"]),
            Paragraph("Total<br/>(100)", styles["th"]),
            Paragraph("Grade", styles["th"]),
            Paragraph("Remark", styles["th"]),
            Paragraph("Pos.", styles["th"]),
        ]
        col_w = [
            page_width * 0.28,
            page_width * 0.10,
            page_width * 0.10,
            page_width * 0.10,
            page_width * 0.12,
            page_width * 0.14,
            page_width * 0.08,
            page_width * 0.08,
        ]
        total_col = 4
        grade_cols = (5, 6)
        empty_pad = 7

    data = [headers]
    for row in report["subjects"]:
        grade_word = row["grade_word"] if row["grade_word"] != "—" else ""
        grade_letter = row["grade_letter"] if row["grade_letter"] != "—" else ""
        if include_prior:
            avg_txt = (
                f"{float(row['average_total']):.1f}"
                if row["average_total"] is not None
                else ""
            )
            data.append(
                [
                    Paragraph(str(row["subject_name"])[:34], styles["td_left"]),
                    Paragraph(_fmt_score(row["term1_total"]), styles["td"]),
                    Paragraph(_fmt_score(row["term2_total"]), styles["td"]),
                    Paragraph(_fmt_score(row["ca1"]), styles["td"]),
                    Paragraph(_fmt_score(row["ca2"]), styles["td"]),
                    Paragraph(_fmt_score(row["exam"]), styles["td"]),
                    Paragraph(_fmt_score(row["term_total"]), styles["td"]),
                    Paragraph(_fmt_score(row["cumulative"]), styles["td"]),
                    Paragraph(avg_txt, styles["td"]),
                    Paragraph(grade_word, styles["td"]),
                    Paragraph(grade_letter, styles["td"]),
                    Paragraph(row["position"], styles["td"]),
                ]
            )
        else:
            data.append(
                [
                    Paragraph(str(row["subject_name"])[:40], styles["td_left"]),
                    Paragraph(_fmt_score(row["ca1"]), styles["td"]),
                    Paragraph(_fmt_score(row["ca2"]), styles["td"]),
                    Paragraph(_fmt_score(row["exam"]), styles["td"]),
                    Paragraph(_fmt_score(row["term_total"]), styles["td"]),
                    Paragraph(grade_word, styles["td"]),
                    Paragraph(grade_letter, styles["td"]),
                    Paragraph(row["position"], styles["td"]),
                ]
            )

    if len(data) == 1:
        data.append(
            [Paragraph("No subject scores recorded for this term yet.", styles["td_left"])]
            + [Paragraph("", styles["td"])] * empty_pad
        )

    scores_table = Table(data, colWidths=col_w, repeatRows=1)
    score_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE_DEEP),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 1, BRAND_BLUE),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("BACKGROUND", (total_col, 1), (total_col, -1), BRAND_PINK_SOFT),
        ("BACKGROUND", (grade_cols[0], 1), (grade_cols[1], -1), BRAND_BLUE_SOFT),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            if include_prior:
                score_style_cmds.append(("BACKGROUND", (0, i), (5, i), ROW_ALT))
                score_style_cmds.append(("BACKGROUND", (7, i), (8, i), ROW_ALT))
                score_style_cmds.append(("BACKGROUND", (11, i), (11, i), ROW_ALT))
            else:
                score_style_cmds.append(("BACKGROUND", (0, i), (3, i), ROW_ALT))
                score_style_cmds.append(("BACKGROUND", (7, i), (7, i), ROW_ALT))
    scores_table.setStyle(TableStyle(score_style_cmds))
    story.append(scores_table)
    story.append(Spacer(1, 3.5 * mm))

    # --- Traits + keys ---
    trait_fields = [
        ("Reading", "reading"),
        ("Verbal fluency", "verbal_fluency"),
        ("Games", "games"),
        ("Handling tools", "tool_handling"),
        ("Handwriting", "handwriting"),
        ("Leadership", "leadership"),
        ("Punctuality", "punctuality"),
        ("Self control", "self_control"),
        ("Politeness", "politeness"),
        ("Neatness", "neatness"),
        ("Obedience", "obedience"),
        ("Honesty", "honesty"),
        ("Creativity", "creativity"),
        ("Attentiveness", "attentiveness"),
    ]
    mid = (len(trait_fields) + 1) // 2
    left_traits = trait_fields[:mid]
    right_traits = trait_fields[mid:]

    def traits_table(pairs):
        rows = [
            [
                Paragraph("<b>TRAIT</b>", styles["small"]),
                Paragraph("<b>1–5</b>", styles["small"]),
            ]
        ]
        for label, attr in pairs:
            value = ""
            if form:
                raw = getattr(form, attr, None)
                value = "" if raw is None else str(raw)
            rows.append(
                [
                    Paragraph(label, styles["small"]),
                    Paragraph(value, styles["small"]),
                ]
            )
        t = Table(rows, colWidths=[page_width * 0.22, page_width * 0.06])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                    ("BOX", (0, 0), (-1, -1), 0.8, BRAND_BLUE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ]
            )
        )
        return t

    rating_key = Table(
        [
            [Paragraph("<b>KEYS TO RATING</b>", styles["section"])],
            [
                Paragraph(
                    "5 — Maintains an excellent degree of observable traits",
                    styles["small"],
                )
            ],
            [
                Paragraph(
                    "4 — Maintains a high level of observable traits",
                    styles["small"],
                )
            ],
            [Paragraph("3 — Acceptable level of observable traits", styles["small"])],
            [
                Paragraph(
                    "2 — Shows minimal regard for observable traits",
                    styles["small"],
                )
            ],
            [
                Paragraph(
                    "1 — Has no regard for the observable traits",
                    styles["small"],
                )
            ],
            [Spacer(1, 2 * mm)],
            [Paragraph("<b>KEY TO GRADINGS</b>", styles["section"])],
            [
                Paragraph(
                    "70–100 = A &nbsp;&nbsp; 60–69 = B &nbsp;&nbsp; 50–59 = C",
                    styles["small"],
                )
            ],
            [
                Paragraph(
                    "45–49 = D &nbsp;&nbsp; 40–44 = E &nbsp;&nbsp; 1–39 = F",
                    styles["small"],
                )
            ],
        ],
        colWidths=[page_width * 0.38],
    )
    rating_key.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, BRAND_PINK),
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_PINK_SOFT),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    traits_row = Table(
        [[traits_table(left_traits), traits_table(right_traits), rating_key]],
        colWidths=[page_width * 0.30, page_width * 0.30, page_width * 0.40],
    )
    traits_row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(Paragraph("AFFECTIVE &amp; PSYCHOMOTOR TRAITS", styles["section"]))
    story.append(Spacer(1, 1.5 * mm))
    story.append(traits_row)
    story.append(Spacer(1, 3.5 * mm))

    # --- Comments ---
    comments = Table(
        [
            [
                Paragraph("<b>CLASS TEACHER'S COMMENT</b>", styles["meta_label"]),
                Paragraph("<b>PRINCIPAL'S COMMENT</b>", styles["meta_label"]),
            ],
            [
                Paragraph(teacher_comment or "—", styles["comment"]),
                Paragraph(principal_comment or "—", styles["comment"]),
            ],
        ],
        colWidths=[page_width / 2, page_width / 2],
        rowHeights=[8, 28],
    )
    comments.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE_SOFT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(comments)
    story.append(Spacer(1, 4 * mm))

    # --- Signature / stamp ---
    sig = Table(
        [
            [
                Paragraph("______________________________", styles["small"]),
                Paragraph("______________________________", styles["small"]),
            ],
            [
                Paragraph("HEAD TEACHER'S SIGNATURE", styles["meta_label"]),
                Paragraph("SCHOOL STAMP", styles["meta_label"]),
            ],
        ],
        colWidths=[page_width / 2, page_width / 2],
    )
    sig.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(sig)
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            f"{SCHOOL_NAME} — Excellence with Character",
            styles["footer"],
        )
    )

    def _page_chrome(canv: canvas.Canvas, _doc):
        canv.saveState()
        canv.setStrokeColor(BRAND_BLUE)
        canv.setLineWidth(0.6)
        canv.rect(6 * mm, 6 * mm, A4[0] - 12 * mm, A4[1] - 12 * mm)
        canv.setStrokeColor(BRAND_PINK)
        canv.setLineWidth(1.2)
        canv.line(6 * mm, A4[1] - 6 * mm, A4[0] - 6 * mm, A4[1] - 6 * mm)
        canv.restoreState()

    doc.build(story, onFirstPage=_page_chrome, onLaterPages=_page_chrome)
    return buffer.getvalue()


def _draw_image_safe(c, source, x, y, width, height):
    """Draw an image from path, bytes, or file-like; return True on success."""
    try:
        if isinstance(source, (bytes, bytearray)):
            reader = ImageReader(io.BytesIO(source))
        elif hasattr(source, "read"):
            reader = ImageReader(source)
        else:
            reader = ImageReader(str(source))
        c.drawImage(
            reader,
            x,
            y,
            width=width,
            height=height,
            preserveAspectRatio=True,
            mask="auto",
            anchor="c",
        )
        return True
    except Exception:
        return False


def _draw_circular_photo(c, source, cx, cy, radius, ring_color, ring_width=2):
    """Draw a circular clipped photo (or placeholder) with a ring."""
    c.saveState()
    path = c.beginPath()
    path.circle(cx, cy, radius)
    c.clipPath(path, stroke=0)
    c.setFillColor(BRAND_BLUE_SOFT)
    c.circle(cx, cy, radius, fill=1, stroke=0)
    drawn = False
    if source is not None:
        size = radius * 2
        drawn = _draw_image_safe(c, source, cx - radius, cy - radius, size, size)
    if not drawn:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString(cx, cy - 2, "PHOTO")
    c.restoreState()
    c.setStrokeColor(ring_color)
    c.setLineWidth(ring_width)
    c.setFillColor(colors.Color(0, 0, 0, alpha=0))
    c.circle(cx, cy, radius, fill=0, stroke=1)
    # Outer thin white ring
    c.setStrokeColor(colors.white)
    c.setLineWidth(1)
    c.circle(cx, cy, radius + 1.2, fill=0, stroke=1)


def build_id_card_pdf(student) -> bytes:
    """Landscape CR80 ID card — modern blue & pink diagonal layout."""
    card = generate_barcode_for_student(student)
    buffer = io.BytesIO()
    page = (85.6 * mm, 53.98 * mm)
    c = canvas.Canvas(buffer, pagesize=page)
    w, h = page

    # Brand palette — mostly blue with pink accents
    BLUE = BRAND_BLUE
    BLUE_DEEP = BRAND_BLUE_DEEP
    BLUE_MID = colors.HexColor("#1A63C4")
    BLUE_MIST = colors.HexColor("#F3F7FC")
    PINK = BRAND_PINK
    PINK_DEEP = colors.HexColor("#D4477A")
    PINK_SOFT = BRAND_PINK_SOFT
    PINK_MIST = colors.HexColor("#FFF5F9")

    class_label = ""
    if student.class_arm:
        class_label = student.class_arm.label or str(student.class_arm)
    gender = (student.gender or "—").title()
    name = (student.full_name or "").strip() or "—"
    student_code = student.student_id or card.barcode_value
    display_name = name if len(name) <= 26 else name[:25] + "…"

    photo_bytes = None
    if getattr(student, "passport_photo", None):
        try:
            with student.passport_photo.open("rb") as fh:
                photo_bytes = fh.read()
        except Exception:
            photo_bytes = None

    # ---------- FRONT ----------
    c.setFillColor(BLUE_MIST)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Soft pink wash on the right panel
    c.setFillColor(PINK_MIST)
    wash = c.beginPath()
    wash.moveTo(w * 0.40, 0)
    wash.lineTo(w, 0)
    wash.lineTo(w, h)
    wash.lineTo(w * 0.54, h)
    wash.close()
    c.drawPath(wash, fill=1, stroke=0)

    # Deep blue left panel with elegant diagonal cut
    c.setFillColor(BLUE_DEEP)
    path = c.beginPath()
    path.moveTo(0, 0)
    path.lineTo(0, h)
    path.lineTo(w * 0.40, h)
    path.lineTo(w * 0.26, 0)
    path.close()
    c.drawPath(path, fill=1, stroke=0)

    # Mid-blue inner diagonal for depth
    c.setFillColor(BLUE_MID)
    inner = c.beginPath()
    inner.moveTo(w * 0.18, 0)
    inner.lineTo(w * 0.32, h)
    inner.lineTo(w * 0.40, h)
    inner.lineTo(w * 0.26, 0)
    inner.close()
    c.drawPath(inner, fill=1, stroke=0)

    # Soft pink accent band along the diagonal
    c.setFillColor(PINK)
    band = c.beginPath()
    band.moveTo(w * 0.26, 0)
    band.lineTo(w * 0.40, h)
    band.lineTo(w * 0.455, h)
    band.lineTo(w * 0.315, 0)
    band.close()
    c.drawPath(band, fill=1, stroke=0)

    # Fine white highlight along the pink edge
    c.setStrokeColor(colors.white)
    c.setLineWidth(0.9)
    c.line(w * 0.26, 0, w * 0.40, h)

    # Logo + school name in blue zone
    logo = _logo_path()
    if logo:
        _draw_image_safe(c, logo, 3 * mm, h - 14 * mm, 10 * mm, 10 * mm)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 6.2)
    c.drawString(14.5 * mm, h - 7.5 * mm, "PEACE CONCEPT")
    c.drawString(14.5 * mm, h - 10.5 * mm, "INT'L MISSION SCHOOLS")
    c.setFillColor(PINK_SOFT)
    c.setFont("Helvetica", 5)
    c.drawString(14.5 * mm, h - 13.5 * mm, "Student Identity Card")

    # Circular photo on the diagonal seam
    photo_cx, photo_cy, photo_r = 29.5 * mm, h * 0.46, 11.8 * mm
    _draw_circular_photo(c, photo_bytes, photo_cx, photo_cy, photo_r, PINK, ring_width=2.4)
    # Soft outer blue halo
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.8)
    c.circle(photo_cx, photo_cy, photo_r + 2.4, fill=0, stroke=1)

    # Details on the light panel
    text_x = 46 * mm
    c.setFillColor(BLUE_DEEP)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(text_x, h - 15 * mm, display_name)
    # Pink accent underline under name
    c.setStrokeColor(PINK)
    c.setLineWidth(1.3)
    name_w = c.stringWidth(display_name, "Helvetica-Bold", 11)
    c.line(text_x, h - 16.2 * mm, text_x + min(name_w, 28 * mm), h - 16.2 * mm)

    def _field(label_y, value_y, label, value, value_color=INK):
        c.setFillColor(PINK_DEEP)
        c.setFont("Helvetica", 5.5)
        c.drawString(text_x, label_y, label)
        c.setFillColor(value_color)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(text_x, value_y, value)

    _field(h - 21.5 * mm, h - 25.5 * mm, "STUDENT ID", student_code, BLUE_DEEP)
    _field(h - 30.5 * mm, h - 34.5 * mm, "CLASS", (class_label or "—")[:20], INK)
    _field(h - 39.5 * mm, h - 43.5 * mm, "GENDER", gender, INK)

    # Front QR — soft pink frame
    qr_size = 14 * mm
    qr_x = w - qr_size - 3 * mm
    qr_y = 4.5 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(PINK)
    c.setLineWidth(1.0)
    c.roundRect(
        qr_x - 1.2 * mm,
        qr_y - 0.5 * mm,
        qr_size + 2.4 * mm,
        qr_size + 4.2 * mm,
        1.4 * mm,
        fill=1,
        stroke=1,
    )
    if card.qr_image:
        try:
            with card.qr_image.open("rb") as fh:
                qr_bytes = fh.read()
            _draw_image_safe(c, qr_bytes, qr_x, qr_y + 2 * mm, qr_size, qr_size)
        except Exception:
            pass
    c.setFillColor(PINK_DEEP)
    c.setFont("Helvetica-Bold", 4.5)
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 0.1 * mm, "GATE SCAN")

    # Motto in blue zone
    c.setFillColor(PINK_SOFT)
    c.setFont("Helvetica-Oblique", 5)
    c.drawString(3 * mm, 3 * mm, f"“{SCHOOL_MOTTO}”")

    c.showPage()

    # ---------- BACK ----------
    c.setFillColor(BLUE_DEEP)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Soft blue mid wash for depth
    c.setFillColor(BLUE)
    mid_wash = c.beginPath()
    mid_wash.moveTo(w * 0.35, 0)
    mid_wash.lineTo(w, 0)
    mid_wash.lineTo(w, h * 0.55)
    mid_wash.close()
    c.drawPath(mid_wash, fill=1, stroke=0)

    # Soft pink / white diagonal corner
    c.setFillColor(PINK_MIST)
    corner = c.beginPath()
    corner.moveTo(0, h)
    corner.lineTo(w * 0.38, h)
    corner.lineTo(0, h * 0.34)
    corner.close()
    c.drawPath(corner, fill=1, stroke=0)

    c.setFillColor(PINK)
    stripe = c.beginPath()
    stripe.moveTo(0, h * 0.34)
    stripe.lineTo(w * 0.38, h)
    stripe.lineTo(w * 0.46, h)
    stripe.lineTo(0, h * 0.21)
    stripe.close()
    c.drawPath(stripe, fill=1, stroke=0)

    c.setStrokeColor(colors.white)
    c.setLineWidth(1.0)
    c.line(0, h * 0.34, w * 0.38, h)

    # Small logo on soft corner
    if logo:
        _draw_image_safe(c, logo, 2.5 * mm, h - 12 * mm, 8.5 * mm, 8.5 * mm)
    c.setFillColor(BLUE_DEEP)
    c.setFont("Helvetica-Bold", 5)
    c.drawString(12 * mm, h - 6.5 * mm, "PEACE CONCEPT")
    c.setFont("Helvetica", 4.5)
    c.drawString(12 * mm, h - 9.2 * mm, "SCHOOLS")

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(40 * mm, h - 8 * mm, "Scan at the gate")
    c.setFillColor(PINK_SOFT)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(40 * mm, h - 12 * mm, student_code)

    back_qr = 18.5 * mm
    back_x = (w - back_qr) / 2 + 4 * mm
    back_y = 18.5 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(PINK)
    c.setLineWidth(1.1)
    c.roundRect(
        back_x - 2 * mm,
        back_y - 2 * mm,
        back_qr + 4 * mm,
        back_qr + 4 * mm,
        2 * mm,
        fill=1,
        stroke=1,
    )
    if card.qr_image:
        try:
            with card.qr_image.open("rb") as fh:
                qr_bytes = fh.read()
            _draw_image_safe(c, qr_bytes, back_x, back_y, back_qr, back_qr)
        except Exception:
            pass

    if card.barcode_image:
        try:
            with card.barcode_image.open("rb") as fh:
                bar_bytes = fh.read()
            bar_w, bar_h = 40 * mm, 5 * mm
            bar_y = 8.6 * mm
            c.setFillColor(colors.white)
            c.roundRect(
                (w - bar_w) / 2 + 2 * mm - 1 * mm,
                bar_y - 0.6 * mm,
                bar_w + 2 * mm,
                bar_h + 1.4 * mm,
                1 * mm,
                fill=1,
                stroke=0,
            )
            _draw_image_safe(
                c,
                bar_bytes,
                (w - bar_w) / 2 + 2 * mm,
                bar_y,
                bar_w,
                bar_h,
            )
        except Exception:
            pass

    c.setFillColor(colors.white)
    c.setFont("Helvetica", 5)
    c.drawCentredString(w / 2, 5.8 * mm, "If found, please return to the school office.")
    c.setFont("Helvetica", 4.6)
    c.drawCentredString(w / 2, 3.4 * mm, SCHOOL_ADDRESS[:72])
    c.setFillColor(PINK_SOFT)
    c.setFont("Helvetica-Oblique", 4.6)
    c.drawCentredString(w / 2, 1.2 * mm, f"Property of {SCHOOL_NAME}")

    c.showPage()
    c.save()
    return buffer.getvalue()
