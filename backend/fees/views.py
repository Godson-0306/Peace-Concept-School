from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.models import AccountType
from accounts.permissions import IsAccountantOrAdmin, can_manage_fees

from .models import FeePaymentEntry, FeeRecord, FeeStructure
from .serializers import FeePaymentEntrySerializer, FeeRecordSerializer, FeeStructureSerializer


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("session", "term", "class_level").all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAccountantOrAdmin]
    filterset_fields = ["session", "term", "class_level", "is_active"]


class FeeRecordViewSet(viewsets.ModelViewSet):
    queryset = FeeRecord.objects.select_related("student", "term").prefetch_related("payments").all()
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


class FeePaymentEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FeePaymentEntry.objects.select_related("fee_record", "recorded_by").all()
    serializer_class = FeePaymentEntrySerializer
    permission_classes = [IsAccountantOrAdmin]
