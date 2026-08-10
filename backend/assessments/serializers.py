from rest_framework import serializers

from .models import AssessmentScore, AttendanceRecord, FormClassRecord, StudentFormRecord


class AssessmentScoreSerializer(serializers.ModelSerializer):
    total = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_type = serializers.CharField(source="subject.subject_type", read_only=True)

    class Meta:
        model = AssessmentScore
        fields = [
            "id",
            "student",
            "student_name",
            "student_code",
            "subject",
            "subject_name",
            "subject_type",
            "term",
            "class_arm",
            "ca1",
            "ca2",
            "exam",
            "total",
            "status",
            "entered_by",
            "updated_at",
            "published_at",
        ]
        read_only_fields = ["status", "entered_by", "published_at", "updated_at"]
        # POST /api/scores/ upserts by (student, subject, term); skip UniqueTogetherValidator.
        validators = []

    def get_total(self, obj):
        return obj.total

    def validate(self, attrs):
        for field, maximum in (("ca1", 20), ("ca2", 20), ("exam", 60)):
            value = attrs.get(field)
            if value is not None and (value < 0 or value > maximum):
                raise serializers.ValidationError({field: f"Must be between 0 and {maximum}."})
        return attrs


class FormClassRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormClassRecord
        fields = "__all__"
        read_only_fields = ["updated_by", "updated_at"]


class StudentFormRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = StudentFormRecord
        fields = "__all__"
        read_only_fields = ["updated_at"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = "__all__"
        read_only_fields = ["marked_by"]
