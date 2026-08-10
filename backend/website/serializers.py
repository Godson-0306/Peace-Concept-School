from django.utils.text import slugify
from rest_framework import serializers

from .models import Application, Enquiry, GalleryImage, NewsPost


class NewsPostSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

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
        read_only_fields = ["published_at", "updated_at"]

    def _unique_slug(self, base: str, exclude_pk=None) -> str:
        slug = slugify(base)[:180] or "post"
        candidate = slug
        index = 2
        qs = NewsPost.objects.all()
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        while qs.filter(slug=candidate).exists():
            candidate = f"{slug}-{index}"
            index += 1
        return candidate

    def create(self, validated_data):
        slug = (validated_data.get("slug") or "").strip()
        if not slug:
            validated_data["slug"] = self._unique_slug(validated_data["title"])
        else:
            validated_data["slug"] = self._unique_slug(slug)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        slug = validated_data.get("slug")
        if slug is not None:
            slug = slug.strip()
            if not slug:
                validated_data["slug"] = self._unique_slug(
                    validated_data.get("title", instance.title),
                    exclude_pk=instance.pk,
                )
            elif slug != instance.slug:
                validated_data["slug"] = self._unique_slug(slug, exclude_pk=instance.pk)
        return super().update(instance, validated_data)


class GalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryImage
        fields = ["id", "title", "image", "caption", "is_published", "created_at"]
        read_only_fields = ["created_at"]


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
