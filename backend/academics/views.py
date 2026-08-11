from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminAccount, IsAdminOrPrincipal, can_manage_accounts

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
from .services.terms import ensure_all_session_terms, ensure_session_terms


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
