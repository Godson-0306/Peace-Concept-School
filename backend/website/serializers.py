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
    enrolled_student_code = serializers.CharField(
        source="enrolled_student.student_id", read_only=True, default=""
    )

    class Meta:
        model = Application
        fields = [
            "id",
            "student_full_name",
            "email",
            "gender",
            "date_of_birth",
            "applying_for_class",
            "previous_school",
            "state_of_origin",
            "blood_group",
            "genotype",
            "disability",
            "passport_photo",
            "address",
            "city_of_residence",
            "lga",
            "phone",
            "whatsapp_phone",
            "guardian_name",
            "guardian_email",
            "guardian_phone",
            "father_name",
            "father_phone",
            "father_whatsapp",
            "mother_name",
            "mother_phone",
            "mother_whatsapp",
            "hometown",
            "next_of_kin_name",
            "next_of_kin_relationship",
            "next_of_kin_address",
            "next_of_kin_phone",
            "notes",
            "status",
            "enrolled_student",
            "enrolled_student_code",
            "created_at",
        ]
        read_only_fields = ["created_at", "enrolled_student_code"]
        extra_kwargs = {
            "status": {"required": False},
            "enrolled_student": {"required": False, "allow_null": True},
            "guardian_name": {"required": False, "allow_blank": True},
            "guardian_email": {"required": False, "allow_blank": True},
            "guardian_phone": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        if self.instance is None:
            guardian = (attrs.get("guardian_name") or "").strip()
            father = (attrs.get("father_name") or "").strip()
            mother = (attrs.get("mother_name") or "").strip()
            if not (guardian or father or mother):
                raise serializers.ValidationError(
                    {"guardian_name": "Provide a parent or guardian name."}
                )
            phone = (
                (attrs.get("guardian_phone") or "").strip()
                or (attrs.get("whatsapp_phone") or "").strip()
                or (attrs.get("phone") or "").strip()
                or (attrs.get("father_whatsapp") or "").strip()
                or (attrs.get("father_phone") or "").strip()
                or (attrs.get("mother_whatsapp") or "").strip()
                or (attrs.get("mother_phone") or "").strip()
            )
            if not phone:
                raise serializers.ValidationError(
                    {"guardian_phone": "Provide a parent/guardian phone or WhatsApp number."}
                )
        return attrs

    def create(self, validated_data):
        # Public create: force new status; staff cannot sneak accepted via create.
        validated_data["status"] = Application.Status.NEW
        validated_data.pop("enrolled_student", None)
        # Derive guardian contact from parent fields when omitted (legacy payloads).
        if not validated_data.get("guardian_name"):
            validated_data["guardian_name"] = (
                validated_data.get("father_name")
                or validated_data.get("mother_name")
                or ""
            )
        if not validated_data.get("guardian_phone"):
            validated_data["guardian_phone"] = (
                validated_data.get("whatsapp_phone")
                or validated_data.get("phone")
                or validated_data.get("father_whatsapp")
                or validated_data.get("father_phone")
                or validated_data.get("mother_whatsapp")
                or validated_data.get("mother_phone")
                or ""
            )
        if not validated_data.get("guardian_email"):
            validated_data["guardian_email"] = validated_data.get("email") or ""
        if not validated_data.get("email"):
            validated_data["email"] = validated_data.get("guardian_email") or ""
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_staff = bool(
            user
            and user.is_authenticated
            and getattr(user, "account_type", None) in ("admin", "principal")
        )
        if not is_staff:
            validated_data.pop("status", None)
            validated_data.pop("enrolled_student", None)
        return super().update(instance, validated_data)
