from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from academics.models import Term
from accounts.models import AccountType, StudentProfile
from accounts.permissions import IsAccountantOrAdmin, can_manage_fees

from .models import FeePaymentEntry, FeeRecord, FeeStructure
from .sections import FEE_SECTIONS, section_for_class_level_name, student_fee_type
from .serializers import FeePaymentEntrySerializer, FeeRecordSerializer, FeeStructureSerializer


def ensure_session_fee_structures(session) -> list[FeeStructure]:
    """Create the 5×2 fee grid for a session if missing (amounts default to 0)."""
    created = []
    for section_key, _label in FEE_SECTIONS:
        for student_type, _ in FeeStructure.StudentType.choices:
            obj, was_created = FeeStructure.objects.get_or_create(
                session=session,
                section=section_key,
                student_type=student_type,
                defaults={"amount": Decimal("0"), "is_active": True},
            )
            if was_created:
                created.append(obj)
    return list(
        FeeStructure.objects.filter(session=session).order_by("section", "student_type")
    )


def ensure_bill_for_student(student, *, term=None, updated_by=None) -> FeeRecord | None:
    """Create a FeeRecord for the active (or given) term if a structure matches.

    Returns the record when created or already present; None when no term/structure.
    """
    if term is None:
        term = (
            Term.objects.filter(is_active=True)
            .select_related("session")
            .order_by("-id")
            .first()
        )
    if term is None:
        return None

    ensure_session_fee_structures(term.session)
    level_name = (
        student.class_arm.class_level.name
        if getattr(student, "class_arm_id", None)
        and student.class_arm
        and student.class_arm.class_level_id
        else None
    )
    section = section_for_class_level_name(level_name)
    if not section:
        return None
    stype = student_fee_type(
        admission_year=student.admission_year,
        session_start_year=term.session.start_year,
    )
    structure = FeeStructure.objects.filter(
        session=term.session,
        section=section,
        student_type=stype,
        is_active=True,
    ).first()
    if not structure:
        return None

    record, _created = FeeRecord.objects.get_or_create(
        student=student,
        term=term,
        defaults={
            "fee_structure": structure,
            "amount_due": structure.amount,
            "amount_paid": 0,
            "updated_by": updated_by,
        },
    )
    return record


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("session").all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAccountantOrAdmin]
    filterset_fields = ["session", "section", "student_type", "is_active"]

    @action(detail=False, methods=["post"], url_path="ensure")
    def ensure(self, request):
        """Ensure the full section × student-type grid exists for a session."""
        session_id = request.data.get("session")
        if not session_id:
            return Response({"detail": "session is required."}, status=status.HTTP_400_BAD_REQUEST)
        from academics.models import AcademicSession

        session = AcademicSession.objects.filter(id=session_id).first()
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        rows = ensure_session_fee_structures(session)
        return Response(FeeStructureSerializer(rows, many=True).data)

    @action(detail=False, methods=["post"], url_path="generate-bills")
    def generate_bills(self, request):
        """
        Generate FeeRecords for a term using the session's section fee grid.
        Optional: section filter (day_care|nursery|primary|jss|ss).
        """
        term_id = request.data.get("term")
        section_filter = request.data.get("section") or None
        if not term_id:
            return Response({"detail": "term is required."}, status=status.HTTP_400_BAD_REQUEST)
        term = Term.objects.select_related("session").filter(id=term_id).first()
        if not term:
            return Response({"detail": "Term not found."}, status=status.HTTP_404_NOT_FOUND)

        ensure_session_fee_structures(term.session)
        structures = {
            (s.section, s.student_type): s
            for s in FeeStructure.objects.filter(session=term.session, is_active=True)
        }

        students = StudentProfile.objects.filter(is_active=True).select_related(
            "class_arm", "class_arm__class_level"
        )
        if section_filter:
            students = [
                st
                for st in students
                if section_for_class_level_name(
                    st.class_arm.class_level.name if st.class_arm_id and st.class_arm.class_level_id else None
                )
                == section_filter
            ]
        else:
            students = list(students)

        created = 0
        updated = 0
        skipped = 0
        missing = 0

        with transaction.atomic():
            for student in students:
                level_name = (
                    student.class_arm.class_level.name
                    if student.class_arm_id and student.class_arm.class_level_id
                    else None
                )
                section = section_for_class_level_name(level_name)
                if not section:
                    missing += 1
                    continue
                stype = student_fee_type(
                    admission_year=student.admission_year,
                    session_start_year=term.session.start_year,
                )
                structure = structures.get((section, stype))
                if not structure:
                    missing += 1
                    continue

                record, was_created = FeeRecord.objects.get_or_create(
                    student=student,
                    term=term,
                    defaults={
                        "fee_structure": structure,
                        "amount_due": structure.amount,
                        "amount_paid": 0,
                        "updated_by": request.user,
                    },
                )
                if was_created:
                    created += 1
                    continue

                if (record.amount_paid or 0) == 0 and not (record.notes or "").strip():
                    changed = False
                    if record.amount_due != structure.amount:
                        record.amount_due = structure.amount
                        changed = True
                    if record.fee_structure_id != structure.id:
                        record.fee_structure = structure
                        changed = True
                    if changed:
                        record.updated_by = request.user
                        record.save()
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1

        return Response(
            {
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "missing_structure": missing,
                "total_students": len(students),
            }
        )


class FeeRecordViewSet(viewsets.ModelViewSet):
    queryset = (
        FeeRecord.objects.select_related(
            "student",
            "student__class_arm",
            "student__class_arm__class_level",
            "term",
            "fee_structure",
        )
        .prefetch_related("payments")
        .all()
    )
    serializer_class = FeeRecordSerializer
    filterset_fields = ["student", "term", "status", "results_unlocked"]
    search_fields = ["student__full_name", "student__student_id"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "pay", "verify_paystack", "virtual_account"):
            return [IsAuthenticated()]
        return [IsAccountantOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_manage_fees(user) or user.account_type == AccountType.PRINCIPAL:
            pass
        elif user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
            qs = qs.filter(student=user.student_profile)
        elif user.account_type == AccountType.PARENT and hasattr(user, "parent_profile"):
            qs = qs.filter(student__in=user.parent_profile.children.all())
        else:
            return qs.none()

        # Nested class filters (not expressible as simple filterset_fields).
        class_level = self.request.query_params.get("class_level")
        if class_level:
            qs = qs.filter(student__class_arm__class_level_id=class_level)
        class_arm = self.request.query_params.get("class_arm")
        if class_arm:
            qs = qs.filter(student__class_arm_id=class_arm)
        return qs

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="unlock-results")
    def unlock_results(self, request, pk=None):
        record = self.get_object()
        if record.results_unlocked:
            return Response(FeeRecordSerializer(record, context={"request": request}).data)
        record.results_unlocked = True
        record.updated_by = request.user
        record.save()
        return Response(FeeRecordSerializer(record, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        from accounts.models import AccountType

        from .paystack import (
            PaystackError,
            checkout_email,
            initialize_transaction,
            naira_to_kobo,
            new_reference,
            paystack_configured,
            paystack_public_key,
        )

        record = self.get_object()
        due = record.amount_due or Decimal("0")
        paid = record.amount_paid or Decimal("0")
        balance = due - paid
        if balance <= 0:
            return Response({"detail": "This bill is already paid."}, status=status.HTTP_400_BAD_REQUEST)
        if not paystack_configured():
            return Response(
                {"detail": "Online payments are not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        frontend = (getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000").rstrip("/")
        if request.user.account_type == AccountType.PARENT:
            callback = f"{frontend}/app/parent"
        elif request.user.account_type == AccountType.STUDENT:
            callback = f"{frontend}/app/student"
        else:
            callback = f"{frontend}/app/accounts"

        student = record.student
        reference = new_reference(record.id)
        try:
            data = initialize_transaction(
                email=checkout_email(request.user, student),
                amount_kobo=naira_to_kobo(balance),
                reference=reference,
                callback_url=callback,
                metadata={
                    "fee_record_id": record.id,
                    "student_id": student.student_id,
                    "term_id": record.term_id,
                    "custom_fields": [
                        {
                            "display_name": "Student ID",
                            "variable_name": "student_id",
                            "value": student.student_id,
                        }
                    ],
                },
            )
        except PaystackError as exc:
            return Response({"detail": str(exc)}, status=exc.status)

        authorization_url = data.get("authorization_url") or ""
        access_code = data.get("access_code") or ""
        if not authorization_url and not access_code:
            return Response(
                {"detail": "Paystack did not return a checkout URL."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                "authorization_url": authorization_url,
                "access_code": access_code,
                "reference": data.get("reference") or reference,
                "public_key": paystack_public_key(),
                "email": checkout_email(request.user, student),
                "amount": str(balance),
            }
        )

    @action(detail=False, methods=["post"], url_path="verify-paystack")
    def verify_paystack(self, request):
        from .paystack import PaystackError, apply_successful_charge, verify_transaction

        reference = (request.data.get("reference") or "").strip()
        if not reference:
            return Response({"detail": "reference is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = verify_transaction(reference)
        except PaystackError as exc:
            return Response({"detail": str(exc)}, status=exc.status)
        record, _created = apply_successful_charge({"data": data})
        if record is None:
            return Response(
                {"detail": "Payment could not be matched to a fee bill."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not self.get_queryset().filter(pk=record.pk).exists():
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        record = (
            self.get_queryset()
            .prefetch_related("payments")
            .select_related("student", "term", "fee_structure")
            .get(pk=record.pk)
        )
        return Response(FeeRecordSerializer(record, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="virtual-account")
    def virtual_account(self, request, pk=None):
        from .paystack import PaystackError, ensure_dedicated_account, paystack_configured

        record = self.get_object()
        if not paystack_configured():
            return Response(
                {"detail": "Online payments are not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            ensure_dedicated_account(record.student)
        except PaystackError as exc:
            return Response({"detail": str(exc)}, status=exc.status)
        record.student.refresh_from_db()
        return Response(FeeRecordSerializer(record, context={"request": request}).data)


class FeePaymentEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FeePaymentEntry.objects.select_related("fee_record", "recorded_by").all()
    serializer_class = FeePaymentEntrySerializer
    permission_classes = [IsAccountantOrAdmin]
