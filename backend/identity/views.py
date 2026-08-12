from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccountType, StudentProfile
from accounts.permissions import IsAdminOrPrincipal, can_manage_accounts, can_view_all_results
from identity.services import (
    build_id_card_pdf,
    build_report_card_pdf,
    generate_barcode_for_student,
    merge_pdfs,
    zip_pdfs,
)


def _get_student_for_user(request, student_id):
    user = request.user
    student = (
        StudentProfile.objects.select_related("class_arm", "class_arm__class_level")
        .filter(id=student_id)
        .first()
    )
    if not student:
        return None, Response({"detail": "Not found."}, status=404)
    if can_manage_accounts(user) or can_view_all_results(user):
        return student, None
    if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
        if user.student_profile.id != student.id:
            return None, Response({"detail": "Not allowed."}, status=403)
        return student, None
    if user.account_type == AccountType.PARENT and hasattr(user, "parent_profile"):
        if not user.parent_profile.children.filter(id=student.id).exists():
            return None, Response({"detail": "Not allowed."}, status=403)
        return student, None
    return None, Response({"detail": "Not allowed."}, status=403)


def _batch_pack(request):
    # Use `pack` (not `format`) — DRF reserves `format` for content negotiation
    # and returns 404 when it cannot find a matching renderer (e.g. format=pdf).
    pack = (request.query_params.get("pack") or "pdf").lower().strip()
    if pack not in ("pdf", "zip"):
        return None, Response(
            {"detail": "pack must be pdf or zip."},
            status=400,
        )
    return pack, None


def _students_for_arm(class_arm_id):
    return (
        StudentProfile.objects.filter(class_arm_id=class_arm_id, is_active=True)
        .select_related("class_arm", "class_arm__class_level")
        .order_by("full_name", "student_id")
    )


def _file_response(payload: bytes, *, content_type: str, filename: str, inline: bool = False):
    disposition = "inline" if inline else "attachment"
    response = HttpResponse(payload, content_type=content_type)
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response


def _slug_label(value) -> str:
    text = str(value)
    for ch in ('/', '\\', '—', '–', ':', '"', "'"):
        text = text.replace(ch, "-")
    text = "-".join(text.split())
    while "--" in text:
        text = text.replace("--", "-")
    return text.strip("-") or "file"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_card_pdf(request, student_id):
    from assessments.services import resolve_term_for_report
    from assessments.views import results_visible_for_student

    student, err = _get_student_for_user(request, student_id)
    if err:
        return err
    term = resolve_term_for_report(
        student=student,
        term_id=request.query_params.get("term"),
    )
    if not term:
        return Response({"detail": "Term required."}, status=400)

    user = request.user
    # Students and parents must clear fees (Paid or manual unlock) before PDF access.
    if user.account_type in (AccountType.STUDENT, AccountType.PARENT):
        if not results_visible_for_student(student, term):
            return Response(
                {
                    "locked": True,
                    "detail": "Results for this term are locked until fees are marked Paid.",
                },
                status=403,
            )

    pdf = build_report_card_pdf(student, term)
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="report-{student.student_id}.pdf"'
    return response


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def student_id_card(request, student_id):
    student, err = _get_student_for_user(request, student_id)
    if err:
        return err
    if request.method == "POST" and not can_manage_accounts(request.user):
        return Response({"detail": "Admin only."}, status=403)
    card = generate_barcode_for_student(student)
    # Use `pack=pdf` — DRF reserves `format` for content negotiation and 404s.
    want_pdf = (
        request.method == "POST"
        or (request.query_params.get("pack") or "").lower() == "pdf"
    )
    if want_pdf:
        pdf = build_id_card_pdf(student)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="id-{student.student_id}.pdf"'
        return response
    return Response(
        {
            "student_id": student.student_id,
            "barcode_value": card.barcode_value,
            "barcode_image": card.barcode_image.url if card.barcode_image else None,
            "qr_image": card.qr_image.url if card.qr_image else None,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrPrincipal])
def report_cards_batch(request):
    from academics.models import ClassArm
    from assessments.services import resolve_term_for_report

    pack, err = _batch_pack(request)
    if err:
        return err

    class_arm_id = request.query_params.get("class_arm")
    if not class_arm_id:
        return Response({"detail": "class_arm is required."}, status=400)

    arm = ClassArm.objects.filter(id=class_arm_id).select_related("class_level").first()
    if not arm:
        return Response({"detail": "Class arm not found."}, status=404)

    term = resolve_term_for_report(
        term_id=request.query_params.get("term"),
        class_arm_id=arm.id,
    )
    if not term:
        return Response({"detail": "Term required."}, status=400)

    students = list(_students_for_arm(arm.id))
    if not students:
        return Response({"detail": "No active students in this class arm."}, status=400)

    entries: list[tuple[str, bytes]] = []
    for student in students:
        pdf = build_report_card_pdf(student, term)
        entries.append((f"report-{student.student_id}.pdf", pdf))

    arm_slug = _slug_label(arm)
    term_slug = _slug_label(term)
    if pack == "zip":
        payload = zip_pdfs(entries)
        return _file_response(
            payload,
            content_type="application/zip",
            filename=f"report-cards-{arm_slug}-{term_slug}.zip",
        )

    payload = merge_pdfs([pdf for _, pdf in entries])
    return _file_response(
        payload,
        content_type="application/pdf",
        filename=f"report-cards-{arm_slug}-{term_slug}.pdf",
        inline=True,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrPrincipal])
def id_cards_batch(request):
    from academics.models import ClassArm

    pack, err = _batch_pack(request)
    if err:
        return err

    class_arm_id = request.query_params.get("class_arm")
    if not class_arm_id:
        return Response({"detail": "class_arm is required."}, status=400)

    arm = ClassArm.objects.filter(id=class_arm_id).select_related("class_level").first()
    if not arm:
        return Response({"detail": "Class arm not found."}, status=404)

    students = list(_students_for_arm(arm.id))
    if not students:
        return Response({"detail": "No active students in this class arm."}, status=400)

    entries: list[tuple[str, bytes]] = []
    for student in students:
        pdf = build_id_card_pdf(student)
        entries.append((f"id-{student.student_id}.pdf", pdf))

    arm_slug = _slug_label(arm)
    if pack == "zip":
        payload = zip_pdfs(entries)
        return _file_response(
            payload,
            content_type="application/zip",
            filename=f"id-cards-{arm_slug}.zip",
        )

    payload = merge_pdfs([pdf for _, pdf in entries])
    return _file_response(
        payload,
        content_type="application/pdf",
        filename=f"id-cards-{arm_slug}.pdf",
        inline=True,
    )
