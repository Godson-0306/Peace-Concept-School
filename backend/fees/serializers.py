from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import FeePaymentEntry, FeeRecord, FeeStructure
from .sections import FEE_SECTION_LABELS


class FeeStructureSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source="session.name", read_only=True)
    section_label = serializers.SerializerMethodField()
    student_type_label = serializers.CharField(
        source="get_student_type_display", read_only=True
    )

    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "session",
            "session_name",
            "section",
            "section_label",
            "student_type",
            "student_type_label",
            "amount",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_section_label(self, obj) -> str:
        return FEE_SECTION_LABELS.get(obj.section, obj.section)


class FeePaymentEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeePaymentEntry
        fields = "__all__"
        read_only_fields = ["recorded_by", "recorded_at"]


class FeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    class_level_name = serializers.SerializerMethodField()
    class_arm_name = serializers.SerializerMethodField()
    fee_section = serializers.SerializerMethodField()
    fee_student_type = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    payments = FeePaymentEntrySerializer(many=True, read_only=True)
    payment = FeePaymentEntrySerializer(write_only=True, required=False)

    class Meta:
        model = FeeRecord
        fields = [
            "id",
            "student",
            "student_name",
            "student_code",
            "term",
            "term_name",
            "class_level_name",
            "class_arm_name",
            "fee_structure",
            "fee_section",
            "fee_student_type",
            "amount_due",
            "amount_paid",
            "balance",
            "status",
            "results_unlocked",
            "notes",
            "updated_by",
            "updated_at",
            "created_at",
            "payments",
            "payment",
        ]
        read_only_fields = [
            "status",
            "results_unlocked",
            "updated_by",
            "updated_at",
            "created_at",
        ]

    def get_balance(self, obj) -> str:
        due = obj.amount_due or Decimal("0")
        paid = obj.amount_paid or Decimal("0")
        return str(due - paid)

    def get_class_level_name(self, obj) -> str:
        arm = getattr(obj.student, "class_arm", None)
        if arm and arm.class_level_id:
            return arm.class_level.name
        return ""

    def get_class_arm_name(self, obj) -> str:
        arm = getattr(obj.student, "class_arm", None)
        return arm.name if arm else ""

    def get_fee_section(self, obj) -> str:
        if obj.fee_structure_id:
            return obj.fee_structure.get_section_display()
        return ""

    def get_fee_student_type(self, obj) -> str:
        if obj.fee_structure_id:
            return obj.fee_structure.get_student_type_display()
        return ""

    @transaction.atomic
    def update(self, instance, validated_data):
        payment_data = validated_data.pop("payment", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if payment_data:
            entry = FeePaymentEntry.objects.create(
                fee_record=instance,
                recorded_by=self.context["request"].user,
                **payment_data,
            )
            instance.amount_paid = (instance.amount_paid or 0) + entry.amount
        instance.updated_by = self.context["request"].user
        instance.save()
        # Drop stale prefetch so nested payments include the new entry.
        cache = getattr(instance, "_prefetched_objects_cache", None)
        if cache is not None:
            cache.pop("payments", None)
        return instance
