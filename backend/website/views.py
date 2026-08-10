from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminAccount, IsAdminOrPrincipal

from .models import Application, Enquiry, GalleryImage, NewsPost
from .serializers import (
    ApplicationSerializer,
    EnquirySerializer,
    GalleryImageSerializer,
    NewsPostSerializer,
)


class NewsPostViewSet(viewsets.ModelViewSet):
    queryset = NewsPost.objects.all()
    serializer_class = NewsPostSerializer
    lookup_field = "slug"
    search_fields = ["title", "summary", "body"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminAccount()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and getattr(
            self.request.user, "account_type", None
        ) == "admin":
            return qs
        return qs.filter(is_published=True)


class GalleryImageViewSet(viewsets.ModelViewSet):
    queryset = GalleryImage.objects.all()
    serializer_class = GalleryImageSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminAccount()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and getattr(
            self.request.user, "account_type", None
        ) == "admin":
            return qs
        return qs.filter(is_published=True)


class EnquiryViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Enquiry.objects.all()
    serializer_class = EnquirySerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsAdminAccount()]


class ApplicationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Application.objects.select_related("enrolled_student").all()
    serializer_class = ApplicationSerializer
    filterset_fields = ["status", "applying_for_class"]
    search_fields = [
        "student_full_name",
        "guardian_name",
        "guardian_email",
        "guardian_phone",
        "father_name",
        "mother_name",
    ]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        if self.action in ("list", "retrieve", "update", "partial_update", "reject", "review"):
            return [IsAdminOrPrincipal()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        application = self.get_object()
        if application.status == Application.Status.ACCEPTED and application.enrolled_student_id:
            return Response(
                {"detail": "This application is already enrolled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        application.status = Application.Status.REJECTED
        application.save(update_fields=["status"])
        return Response(ApplicationSerializer(application, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        application = self.get_object()
        if application.status == Application.Status.ACCEPTED:
            return Response(
                {"detail": "This application is already accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        application.status = Application.Status.REVIEWING
        application.save(update_fields=["status"])
        return Response(ApplicationSerializer(application, context={"request": request}).data)
