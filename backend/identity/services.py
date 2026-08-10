import io

import barcode
from barcode.writer import ImageWriter
from django.core.files.base import ContentFile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from assessments.models import StudentFormRecord
from assessments.services import compute_student_result, rank_class_arm
from identity.models import StudentIdCard


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
    card.barcode_image.save(f"{value}.png", ContentFile(buffer.getvalue()), save=True)
    return card


def build_report_card_pdf(student, term) -> bytes:
    result = compute_student_result(student.id, term.id)
    rankings = rank_class_arm(student.class_arm_id, term.id, published_only=True)
    position = next((r["position"] for r in rankings if r["student_id"] == student.id), "—")
    form = StudentFormRecord.objects.filter(student=student, term=term).first()

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFillColor(colors.HexColor("#1450A3"))
    c.rect(0, height - 80, width, 80, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 35, "PEACE CONCEPT INT'L MISSION SCHOOLS")
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2, height - 55, "Term Report Card")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    y = height - 110
    lines = [
        f"Student: {student.full_name}",
        f"Student ID: {student.student_id}",
        f"Class: {student.class_arm}",
        f"Session/Term: {term}",
        f"Total: {result['total']}    Average: {result['average']:.2f}    Position: {position}",
    ]
    for line in lines:
        c.drawString(40, y, line)
        y -= 18

    y -= 10
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Subject")
    c.drawString(220, y, "CA1")
    c.drawString(270, y, "CA2")
    c.drawString(320, y, "Exam")
    c.drawString(380, y, "Total")
    y -= 14
    c.setFont("Helvetica", 10)
    for row in result["subjects"]:
        if y < 120:
            c.showPage()
            y = height - 60
        c.drawString(40, y, str(row["subject_name"])[:28])
        c.drawString(220, y, str(row["ca1"]))
        c.drawString(270, y, str(row["ca2"]))
        c.drawString(320, y, str(row["exam"]))
        c.drawString(380, y, str(row["total"]))
        y -= 14

    y -= 20
    if form:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "Form Teacher Remarks & Domains")
        y -= 16
        c.setFont("Helvetica", 10)
        c.drawString(40, y, f"Attendance: Present {form.days_present} / Absent {form.days_absent}")
        y -= 14
        c.drawString(
            40,
            y,
            f"Affective: Punctuality {form.punctuality or '-'}, Neatness {form.neatness or '-'}, "
            f"Politeness {form.politeness or '-'}",
        )
        y -= 14
        c.drawString(
            40,
            y,
            f"Psychomotor: Handwriting {form.handwriting or '-'}, Sports {form.sports or '-'}, "
            f"Tools {form.tool_handling or '-'}",
        )
        y -= 14
        c.drawString(40, y, f"Remark: {form.teacher_remark[:90]}")

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawCentredString(
        width / 2, 40, "Peace Concept International Mission Schools — Excellence with Character"
    )
    c.showPage()
    c.save()
    return buffer.getvalue()


def build_id_card_pdf(student) -> bytes:
    card = generate_barcode_for_student(student)
    buffer = io.BytesIO()
    # Card-ish landscape small page
    page = (85.6 * mm, 53.98 * mm)
    c = canvas.Canvas(buffer, pagesize=page)
    w, h = page
    c.setFillColor(colors.HexColor("#1450A3"))
    c.rect(0, h - 14 * mm, w, 14 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(w / 2, h - 8 * mm, "PEACE CONCEPT INT'L MISSION SCHOOLS")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(28 * mm, h - 22 * mm, student.full_name[:28])
    c.setFont("Helvetica", 8)
    c.drawString(28 * mm, h - 28 * mm, f"ID: {student.student_id}")
    c.drawString(28 * mm, h - 33 * mm, f"Gender: {student.gender or '—'}")
    c.drawString(28 * mm, h - 38 * mm, f"Class: {student.class_arm or '—'}")
    # Photo placeholder
    c.setStrokeColor(colors.HexColor("#E85A8C"))
    c.rect(4 * mm, h - 42 * mm, 20 * mm, 24 * mm)
    c.setFont("Helvetica", 6)
    c.drawCentredString(14 * mm, h - 30 * mm, "PHOTO")
    # Back page with barcode note
    c.showPage()
    c.setFillColor(colors.HexColor("#0B3575"))
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 7)
    c.drawCentredString(w / 2, h - 12 * mm, "Property of Peace Concept Int'l Mission Schools")
    c.drawCentredString(w / 2, h - 18 * mm, "If found, please return to the school office.")
    c.drawCentredString(w / 2, h - 28 * mm, f"Barcode: {card.barcode_value}")
    c.showPage()
    c.save()
    return buffer.getvalue()
