from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts.permissions import IsAdminAccount, can_manage_accounts

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


class AdminOrReadAuthenticated(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminAccount()]


class AcademicSessionViewSet(AdminOrReadAuthenticated):
    queryset = AcademicSession.objects.all()
    serializer_class = AcademicSessionSerializer


class TermViewSet(AdminOrReadAuthenticated):
    queryset = Term.objects.select_related("session").all()
    serializer_class = TermSerializer
    filterset_fields = ["session", "is_active", "number"]


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


class SubjectViewSet(AdminOrReadAuthenticated):
    queryset = Subject.objects.select_related("class_level", "department").all()
    serializer_class = SubjectSerializer
    filterset_fields = ["class_level", "department", "subject_type", "is_active"]
    search_fields = ["name", "code"]


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
