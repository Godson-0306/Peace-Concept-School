from django.db import transaction
from rest_framework import serializers

from academics.models import StudentIdSequence
from .models import (
    AccountType,
    ParentProfile,
    PositionAssignment,
    StaffProfile,
    StudentProfile,
    User,
)


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "account_type",
            "phone",
            "must_change_password",
            "is_active",
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        if hasattr(obj, "staff_profile") and obj.staff_profile:
            return obj.staff_profile.full_name
        if hasattr(obj, "student_profile") and obj.student_profile:
            return obj.student_profile.full_name
        if hasattr(obj, "parent_profile") and obj.parent_profile:
            return obj.parent_profile.full_name
        return obj.get_full_name() or obj.email


class LoginSerializer(serializers.Serializer):
    portal = serializers.ChoiceField(choices=["student", "staff"])
    identifier = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        portal = attrs["portal"]
        identifier = attrs["identifier"].strip()
        password = attrs["password"]

        if portal == "student":
            student = (
                StudentProfile.objects.select_related("user")
                .filter(student_id__iexact=identifier)
                .first()
            )
            if not student or not student.user:
                raise serializers.ValidationError(
                    "Invalid Student ID or password."
                )
            user = student.user
            if user.account_type != AccountType.STUDENT:
                raise serializers.ValidationError(
                    "Use the Staff tab with your username."
                )
            if not user.check_password(password):
                raise serializers.ValidationError(
                    "Invalid Student ID or password."
                )
        else:
            user = User.objects.filter(username__iexact=identifier).first()
            if not user:
                raise serializers.ValidationError("Invalid username or password.")
            if user.account_type == AccountType.STUDENT:
                raise serializers.ValidationError(
                    "Use the Student tab with your Student ID."
                )
            if not user.check_password(password):
                raise serializers.ValidationError("Invalid username or password.")


        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        attrs["user"] = user
        return attrs


class PositionAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PositionAssignment
        fields = ["id", "position", "department", "class_arm", "is_active"]


class StaffProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, max_length=150)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    account_type = serializers.ChoiceField(choices=AccountType.choices, write_only=True)
    positions = PositionAssignmentSerializer(many=True, required=False)
    user = UserSerializer(read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            "id",
            "user",
            "username",
            "email",
            "password",
            "account_type",
            "full_name",
            "gender",
            "date_of_birth",
            "state_of_origin",
            "phone_number",
            "address",
            "city_of_residence",
            "home_town",
            "lga_of_residence",
            "disability",
            "passport_photo",
            "signature",
            "positions",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("This username is already taken.")
        return username

    def validate_account_type(self, value):
        if value == AccountType.STUDENT:
            raise serializers.ValidationError(
                "Use student registration for student accounts."
            )
        if value == AccountType.PARENT:
            raise serializers.ValidationError(
                "Use parent registration for parent accounts."
            )
        return value

    @transaction.atomic
    def create(self, validated_data):
        positions = validated_data.pop("positions", [])
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password", None) or User.objects.make_random_password()
        account_type = validated_data.pop("account_type")
        name_parts = validated_data["full_name"].split(" ", 1)
        user = User.objects.create_user(
            email=email,
            password=password,
            username=username,
            account_type=account_type,
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else "",
            phone=validated_data.get("phone_number", ""),
        )
        staff = StaffProfile.objects.create(user=user, **validated_data)
        for pos in positions:
            PositionAssignment.objects.create(staff=staff, **pos)
        staff._temp_password = password
        return staff


DEFAULT_PORTAL_PASSWORD = "school"


class StudentProfileSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    create_portal_account = serializers.BooleanField(write_only=True, default=True)
    user = UserSerializer(read_only=True)
    class_arm_label = serializers.CharField(source="class_arm.label", read_only=True, default="")
    section = serializers.CharField(source="class_arm.name", read_only=True, default="")
    class_level = serializers.IntegerField(
        source="class_arm.class_level_id", read_only=True, allow_null=True
    )
    class_level_name = serializers.CharField(
        source="class_arm.class_level.name", read_only=True, default=""
    )
    session_attendance_days = serializers.SerializerMethodField()
    total_attendance_days = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            "id",
            "user",
            "student_id",
            "full_name",
            "email",
            "gender",
            "date_of_birth",
            "admission_year",
            "date_of_admission",
            "class_arm",
            "class_arm_label",
            "section",
            "class_level",
            "class_level_name",
            "state_of_origin",
            "blood_group",
            "genotype",
            "disability",
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
            "passport_photo",
            "is_active",
            "promotion_status",
            "session_attendance_days",
            "total_attendance_days",
            "password",
            "create_portal_account",
            "created_at",
        ]
        read_only_fields = ["student_id", "created_at", "session_attendance_days", "total_attendance_days"]

    def get_session_attendance_days(self, obj):
        value = getattr(obj, "annotated_session_attendance", None)
        return int(value or 0)

    def get_total_attendance_days(self, obj):
        value = getattr(obj, "annotated_total_attendance", None)
        return int(value or 0)

    @transaction.atomic
    def create(self, validated_data):
        create_portal = validated_data.pop("create_portal_account", True)
        # Profile email is stored on StudentProfile; also used for portal user.
        profile_email = (validated_data.get("email") or "").strip()
        password = (validated_data.pop("password", None) or "").strip() or DEFAULT_PORTAL_PASSWORD
        admission_year = validated_data["admission_year"]
        student_id = StudentIdSequence.next_student_id(admission_year)
        user = None
        if create_portal:
            email = profile_email or f"{student_id.lower()}@students.peaceconceptschool.ng"
            if not profile_email:
                validated_data["email"] = email
            name_parts = validated_data["full_name"].split(" ", 1)
            # Students authenticate with Student ID; username stays internal.
            user = User.objects.create_user(
                email=email,
                password=password,
                username=email,
                account_type=AccountType.STUDENT,
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else "",
                phone=validated_data.get("guardian_phone")
                or validated_data.get("whatsapp_phone")
                or validated_data.get("phone")
                or "",
            )
        student = StudentProfile.objects.create(
            user=user, student_id=student_id, **validated_data
        )
        student._temp_password = password if create_portal else None
        return student


class ParentProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, max_length=150)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    child_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    user = UserSerializer(read_only=True)
    children = StudentProfileSerializer(many=True, read_only=True)

    class Meta:
        model = ParentProfile
        fields = [
            "id",
            "user",
            "full_name",
            "phone_number",
            "address",
            "username",
            "email",
            "password",
            "child_ids",
            "children",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("This username is already taken.")
        return username

    @transaction.atomic
    def create(self, validated_data):
        child_ids = validated_data.pop("child_ids", [])
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password", None) or User.objects.make_random_password()
        name_parts = validated_data["full_name"].split(" ", 1)
        user = User.objects.create_user(
            email=email,
            password=password,
            username=username,
            account_type=AccountType.PARENT,
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else "",
            phone=validated_data.get("phone_number", ""),
        )
        parent = ParentProfile.objects.create(user=user, **validated_data)
        if child_ids:
            parent.children.set(StudentProfile.objects.filter(id__in=child_ids))
        parent._temp_password = password
        return parent
