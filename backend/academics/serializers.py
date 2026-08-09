from rest_framework import serializers

from .models import (
    AcademicSession,
    ClassArm,
    ClassLevel,
    Department,
    Subject,
    TeacherAssignment,
    Term,
)


class AcademicSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ["id", "name", "start_year", "is_active", "created_at"]


class TermSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source="session.name", read_only=True)

    class Meta:
        model = Term
        fields = [
            "id",
            "session",
            "session_name",
            "number",
            "name",
            "is_active",
            "start_date",
            "end_date",
            "next_term_resumption",
        ]


class ClassLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassLevel
        fields = ["id", "name", "order"]


class ClassArmSerializer(serializers.ModelSerializer):
    class_level_name = serializers.CharField(source="class_level.name", read_only=True)

    class Meta:
        model = ClassArm
        fields = ["id", "class_level", "class_level_name", "name", "label"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "description"]


class SubjectSerializer(serializers.ModelSerializer):
    class_level_name = serializers.CharField(source="class_level.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")

    class Meta:
        model = Subject
        fields = [
            "id",
            "name",
            "code",
            "class_level",
            "class_level_name",
            "department",
            "department_name",
            "subject_type",
            "is_active",
        ]


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.full_name", read_only=True)
    class_arm_label = serializers.CharField(source="class_arm.label", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    session_name = serializers.CharField(source="session.name", read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = [
            "id",
            "staff",
            "staff_name",
            "class_arm",
            "class_arm_label",
            "subject",
            "subject_name",
            "session",
            "session_name",
            "is_active",
        ]
