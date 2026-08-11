from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccountType, StudentProfile
from accounts.permissions import can_manage_accounts, can_view_all_results
from identity.services import build_id_card_pdf, build_report_card_pdf, generate_barcode_for_student


def _get_student_for_user(request, student_id):
    user = request.user
    student = StudentProfile.objects.filter(id=student_id).first()
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_card_pdf(request, student_id):
    from academics.models import Term

    student, err = _get_student_for_user(request, student_id)
    if err:
        return err
    term_id = request.query_params.get("term")
    term = Term.objects.filter(id=term_id).first() if term_id else Term.objects.filter(is_active=True).first()
    if not term:
        return Response({"detail": "Term required."}, status=400)
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
    if request.query_params.get("format") == "pdf" or request.method == "POST":
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
