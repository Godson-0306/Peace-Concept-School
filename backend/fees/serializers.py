from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import FeePaymentEntry, FeeRecord, FeeStructure


class FeeStructureSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source="session.name", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    class_level_name = serializers.CharField(source="class_level.name", read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "name",
            "session",
            "session_name",
            "term",
            "term_name",
            "class_level",
            "class_level_name",
            "amount",
            "description",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]


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
        return instance
