from rest_framework import serializers

from .models import Application, Enquiry, GalleryImage, NewsPost


class NewsPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsPost
        fields = [
            "id",
            "title",
            "slug",
            "summary",
            "body",
            "cover_image",
            "is_published",
            "published_at",
            "updated_at",
        ]


class GalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryImage
        fields = ["id", "title", "image", "caption", "is_published", "created_at"]


class EnquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Enquiry
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "subject",
            "message",
            "status",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            "id",
            "student_full_name",
            "gender",
            "date_of_birth",
            "applying_for_class",
            "previous_school",
            "guardian_name",
            "guardian_email",
            "guardian_phone",
            "address",
            "notes",
            "status",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]
