from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts.permissions import IsAdminAccount

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
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsAdminAccount()]
