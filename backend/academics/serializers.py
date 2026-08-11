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
from .services.promotion import promote_students_for_new_session
from .services.terms import ensure_session_terms


class AcademicSessionSerializer(serializers.ModelSerializer):
    promoted_count = serializers.IntegerField(read_only=True, required=False)
    graduated_count = serializers.IntegerField(read_only=True, required=False)
    skipped_count = serializers.IntegerField(read_only=True, required=False)
    promotion_ran = serializers.BooleanField(read_only=True, required=False)

    class Meta:
        model = AcademicSession
        fields = [
            "id",
            "name",
            "start_year",
            "is_active",
            "students_promoted_for_session",
            "created_at",
            "promoted_count",
            "graduated_count",
            "skipped_count",
            "promotion_ran",
        ]
        read_only_fields = ["students_promoted_for_session", "created_at"]

    def _maybe_promote(self, session: AcademicSession, becoming_active: bool, previous_active_id):
        summary = {
            "promotion_ran": False,
            "promoted_count": 0,
            "graduated_count": 0,
            "skipped_count": 0,
        }
        if not becoming_active:
            return summary
        if session.students_promoted_for_session:
            return summary
        # Only promote when activating a different session than the previous active one.
        if previous_active_id is not None and previous_active_id == session.id:
            return summary
        result = promote_students_for_new_session()
        session.students_promoted_for_session = True
        session.save(update_fields=["students_promoted_for_session"])
        summary.update(result)
        summary["promotion_ran"] = True
        return summary

    def create(self, validated_data):
        previous_active = AcademicSession.objects.filter(is_active=True).first()
        previous_active_id = previous_active.id if previous_active else None
        becoming_active = bool(validated_data.get("is_active"))
        session = AcademicSession.objects.create(**validated_data)
        ensure_session_terms(session)
        summary = self._maybe_promote(session, becoming_active, previous_active_id)
        session.promoted_count = summary["promoted_count"]
        session.graduated_count = summary["graduated_count"]
        session.skipped_count = summary["skipped_count"]
        session.promotion_ran = summary["promotion_ran"]
        return session

    def update(self, instance, validated_data):
        previous_active = AcademicSession.objects.filter(is_active=True).exclude(pk=instance.pk).first()
        previous_active_id = previous_active.id if previous_active else (
            instance.id if instance.is_active else None
        )
        was_active = instance.is_active
        becoming_active = bool(validated_data.get("is_active", instance.is_active))
        # Promote only when switching onto this session as newly active.
        should_consider = becoming_active and not was_active
        session = super().update(instance, validated_data)
        ensure_session_terms(session)
        summary = self._maybe_promote(
            session,
            should_consider,
            previous_active_id if should_consider else session.id,
        )
        session.promoted_count = summary["promoted_count"]
        session.graduated_count = summary["graduated_count"]
        session.skipped_count = summary["skipped_count"]
        session.promotion_ran = summary["promotion_ran"]
        return session


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
            "results_entry_open",
            "start_date",
            "end_date",
            "next_term_resumption",
        ]
        read_only_fields = ["session", "number", "name"]

    def validate_number(self, value):
        if value not in Term.TermNumber.values:
            raise serializers.ValidationError(
                "Each session may only have First, Second, and Third Term."
            )
        return value

    def create(self, validated_data):
        raise serializers.ValidationError(
            "Terms are created automatically with each session "
            "(First, Second, and Third Term only)."
        )


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


MAX_TEACHER_SUBJECTS = 20


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

    def validate(self, attrs):
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)
        session = attrs.get("session") or getattr(self.instance, "session", None)
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)
        is_active = attrs.get("is_active")
        if is_active is None:
            is_active = True if self.instance is None else self.instance.is_active

        if staff and session and subject and is_active:
            qs = TeacherAssignment.objects.filter(
                staff=staff, session=session, is_active=True
            )
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            subject_ids = set(qs.values_list("subject_id", flat=True))
            subject_ids.add(subject.id if hasattr(subject, "id") else subject)
            if len(subject_ids) > MAX_TEACHER_SUBJECTS:
                raise serializers.ValidationError(
                    {
                        "subject": (
                            f"A teacher may take at most {MAX_TEACHER_SUBJECTS} "
                            "different subjects."
                        )
                    }
                )
        return attrs
