from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminAccount, IsAdminOrPrincipal, can_manage_accounts
from academics.defaults import CLASS_LEVEL_FEE_SECTION, CLASS_LADDER

from .models import (
    AcademicSession,
    ClassArm,
    ClassLevel,
    Department,
    Subject,
    TeacherAssignment,
    Term,
)
from .serializers import (
    AcademicSessionSerializer,
    ClassArmSerializer,
    ClassLevelSerializer,
    DepartmentSerializer,
    SubjectSerializer,
    TeacherAssignmentSerializer,
    TermSerializer,
)
from .services.terms import (
    activate_session_and_term,
    ensure_all_session_terms,
    ensure_session_terms,
)


class AdminOrReadAuthenticated(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminAccount()]


class AcademicSessionViewSet(AdminOrReadAuthenticated):
    queryset = AcademicSession.objects.all()
    serializer_class = AcademicSessionSerializer

    def list(self, request, *args, **kwargs):
        ensure_all_session_terms()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        ensure_session_terms(instance)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="activate-with-term")
    def activate_with_term(self, request, pk=None):
        """Activate this session together with one of its three terms."""
        session = self.get_object()
        try:
            term_number = int(request.data.get("term_number") or 1)
        except (TypeError, ValueError):
            term_number = 1
        previous_active = (
            AcademicSession.objects.filter(is_active=True).exclude(pk=session.pk).first()
        )
        becoming = not session.is_active
        term = activate_session_and_term(session, term_number=term_number)
        session.refresh_from_db()
        summary = self.get_serializer(session)._maybe_promote(
            session,
            becoming,
            previous_active.id if previous_active else None,
        )
        session.promoted_count = summary["promoted_count"]
        session.graduated_count = summary["graduated_count"]
        session.skipped_count = summary["skipped_count"]
        session.promotion_ran = summary["promotion_ran"]
        data = AcademicSessionSerializer(session).data
        data["active_term"] = TermSerializer(term).data
        return Response(data)


class TermViewSet(viewsets.ModelViewSet):
    queryset = Term.objects.select_related("session").all()
    serializer_class = TermSerializer
    filterset_fields = ["session", "is_active", "number"]
    http_method_names = ["get", "head", "options", "put", "patch"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        if self.action in ("update", "partial_update"):
            return [IsAdminOrPrincipal()]
        return [IsAdminAccount()]

    def list(self, request, *args, **kwargs):
        session_id = request.query_params.get("session")
        if session_id:
            session = AcademicSession.objects.filter(id=session_id).first()
            if session:
                ensure_session_terms(session)
        else:
            ensure_all_session_terms()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Terms cannot be created manually. Each session always has "
                    "First, Second, and Third Term."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Terms cannot be deleted. Each session always has "
                    "First, Second, and Third Term."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

class ClassLevelViewSet(AdminOrReadAuthenticated):
    queryset = ClassLevel.objects.all()
    serializer_class = ClassLevelSerializer

    def _ensure_arms(self, level: ClassLevel):
        for arm_name in ("A", "B"):
            expected = f"{level.name}{arm_name}"
            arm, _created = ClassArm.objects.get_or_create(
                class_level=level,
                name=arm_name,
                defaults={"label": expected},
            )
            if arm.label != expected:
                arm.label = expected
                arm.save(update_fields=["label"])

    def perform_create(self, serializer):
        instance = serializer.save()
        if not instance.fee_section:
            instance.fee_section = CLASS_LEVEL_FEE_SECTION.get(instance.name, "")
            if instance.fee_section:
                instance.save(update_fields=["fee_section"])
        self._ensure_arms(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._ensure_arms(instance)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_class_levels(_request):
    """Public class ladder for enrol/admissions pages (name + order only)."""
    rows = ClassLevel.objects.order_by("order", "name").values("id", "name", "order")
    if rows.exists():
        return Response(list(rows))
    return Response(
        [{"id": index, "name": name, "order": index} for index, name in enumerate(CLASS_LADDER, start=1)]
    )


class ClassArmViewSet(AdminOrReadAuthenticated):
    queryset = ClassArm.objects.select_related("class_level").all()
    serializer_class = ClassArmSerializer
    filterset_fields = ["class_level"]


class DepartmentViewSet(AdminOrReadAuthenticated):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related("class_level", "department").all()
    serializer_class = SubjectSerializer
    filterset_fields = ["class_level", "department", "subject_type", "is_active"]
    search_fields = ["name", "code"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminOrPrincipal()]


class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.select_related(
        "staff", "class_arm", "subject", "session"
    ).all()
    serializer_class = TeacherAssignmentSerializer
    filterset_fields = ["staff", "class_arm", "subject", "session", "is_active"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminAccount()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if can_manage_accounts(user) or user.account_type in ("principal",):
            return qs
        if hasattr(user, "staff_profile"):
            return qs.filter(staff=user.staff_profile)
        return qs.none()
