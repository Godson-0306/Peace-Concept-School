from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccountType, StudentProfile
from accounts.permissions import IsAccountantOrAdmin, can_manage_fees

from .models import FeePaymentEntry, FeeRecord, FeeStructure
from .serializers import FeePaymentEntrySerializer, FeeRecordSerializer, FeeStructureSerializer


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("session", "term", "class_level").all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAccountantOrAdmin]
    filterset_fields = ["session", "term", "class_level", "is_active"]

    @action(detail=True, methods=["post"], url_path="generate-bills")
    def generate_bills(self, request, pk=None):
        structure = self.get_object()
        students = StudentProfile.objects.filter(
            is_active=True,
            class_arm__class_level_id=structure.class_level_id,
        ).select_related("class_arm")

        created = 0
        updated = 0
        skipped = 0

        with transaction.atomic():
            for student in students:
                record, was_created = FeeRecord.objects.get_or_create(
                    student=student,
                    term=structure.term,
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

                # Refresh dues only for untouched unpaid bills (no payments, no notes).
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
                "total_students": students.count(),
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
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAccountantOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_manage_fees(user) or user.account_type == AccountType.PRINCIPAL:
            return qs
        if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
            return qs.filter(student=user.student_profile)
        if user.account_type == AccountType.PARENT and hasattr(user, "parent_profile"):
            return qs.filter(student__in=user.parent_profile.children.all())
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="unlock-results")
    def unlock_results(self, request, pk=None):
        record = self.get_object()
        if record.results_unlocked:
            return Response(FeeRecordSerializer(record, context={"request": request}).data)
        record.results_unlocked = True
        record.updated_by = request.user
        # refresh_status never clears results_unlocked once set (sticky unlock).
        record.save()
        return Response(FeeRecordSerializer(record, context={"request": request}).data)


class FeePaymentEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FeePaymentEntry.objects.select_related("fee_record", "recorded_by").all()
    serializer_class = FeePaymentEntrySerializer
    permission_classes = [IsAccountantOrAdmin]
