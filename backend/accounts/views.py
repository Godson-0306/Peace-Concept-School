from django.contrib.auth import login, logout
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.db.models import IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from .models import ParentProfile, PositionAssignment, StaffProfile, StudentProfile, User
from .permissions import IsAdminAccount, IsAdminOrPrincipal, can_manage_accounts, user_positions
from .serializers import (
    LoginSerializer,
    ParentProfileSerializer,
    PositionAssignmentSerializer,
    StaffProfileSerializer,
    StudentProfileSerializer,
    UserSerializer,
)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    login(request, user)
    return Response({"user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"detail": "Logged out."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    data = UserSerializer(user).data
    data["positions"] = PositionAssignmentSerializer(user_positions(user), many=True).data
    if hasattr(user, "staff_profile"):
        data["staff_profile_id"] = user.staff_profile.id
    if hasattr(user, "student_profile"):
        data["student_profile_id"] = user.student_profile.id
        data["student_code"] = user.student_profile.student_id
    if hasattr(user, "parent_profile"):
        data["parent_profile_id"] = user.parent_profile.id
        data["children"] = list(
            user.parent_profile.children.values("id", "student_id", "full_name")
        )
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_view(request):
    from django.middleware.csrf import get_token

    return Response({"csrfToken": get_token(request)})


class StaffViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.select_related("user").prefetch_related("positions").all()
    serializer_class = StaffProfileSerializer
    permission_classes = [IsAdminAccount]
    search_fields = ["full_name", "user__email", "phone_number"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = serializer.save()
        headers = self.get_success_headers(serializer.data)
        payload = serializer.data
        payload["username"] = staff.user.username
        payload["temporary_password"] = getattr(staff, "_temp_password", None)
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        staff = serializer.save()
        payload = serializer.data
        payload["username"] = staff.user.username
        if getattr(staff, "_temp_password", None):
            payload["temporary_password"] = staff._temp_password
        return Response(payload)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.select_related(
        "user", "class_arm", "class_arm__class_level"
    ).all()
    serializer_class = StudentProfileSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["full_name", "student_id", "guardian_name", "guardian_email"]
    filterset_fields = ["class_arm", "admission_year", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminOrPrincipal()]
        return [IsAuthenticated()]

    def get_queryset(self):
        from academics.models import Term
        from assessments.models import StudentFormRecord

        user = self.request.user
        qs = super().get_queryset()
        class_level = self.request.query_params.get("class_level")
        if class_level:
            qs = qs.filter(class_arm__class_level_id=class_level)

        active_term_id = (
            Term.objects.filter(is_active=True).order_by("-id").values("id")[:1]
        )
        session_subquery = StudentFormRecord.objects.filter(
            student_id=OuterRef("pk"),
            term_id=Subquery(active_term_id),
        ).values("days_present")[:1]
        qs = qs.annotate(
            annotated_total_attendance=Coalesce(
                Sum("form_records__days_present"),
                Value(0),
                output_field=IntegerField(),
            ),
            annotated_session_attendance=Coalesce(
                Subquery(session_subquery, output_field=IntegerField()),
                Value(0),
                output_field=IntegerField(),
            ),
        ).order_by(
            "class_arm__class_level__order",
            "class_arm__name",
            "full_name",
            "student_id",
        )

        if can_manage_accounts(user) or user.account_type in ("principal", "accountant"):
            return qs
        from accounts.permissions import can_view_all_results, form_teacher_class_arm_ids

        if can_view_all_results(user):
            return qs
        if user.account_type == "student" and hasattr(user, "student_profile"):
            return qs.filter(id=user.student_profile.id)
        if user.account_type == "parent" and hasattr(user, "parent_profile"):
            return qs.filter(parents=user.parent_profile)
        arms = form_teacher_class_arm_ids(user)
        if arms:
            return qs.filter(class_arm_id__in=arms)
        return qs.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = serializer.save()
        payload = serializer.data
        payload["temporary_password"] = getattr(student, "_temp_password", None)
        return Response(payload, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        student = serializer.save()
        payload = serializer.data
        if getattr(student, "_temp_password", None):
            payload["temporary_password"] = student._temp_password
        return Response(payload)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class ParentViewSet(viewsets.ModelViewSet):
    queryset = ParentProfile.objects.select_related("user").prefetch_related("children").all()
    serializer_class = ParentProfileSerializer
    permission_classes = [IsAdminAccount]
    search_fields = ["full_name", "user__email", "phone_number"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parent = serializer.save()
        payload = serializer.data
        payload["username"] = parent.user.username
        payload["temporary_password"] = getattr(parent, "_temp_password", None)
        return Response(payload, status=status.HTTP_201_CREATED)


class PositionAssignmentViewSet(viewsets.ModelViewSet):
    queryset = PositionAssignment.objects.select_related("staff", "department", "class_arm").all()
    serializer_class = PositionAssignmentSerializer
    permission_classes = [IsAdminAccount]
    filterset_fields = ["staff", "position", "is_active"]
