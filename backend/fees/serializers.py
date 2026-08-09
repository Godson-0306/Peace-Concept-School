from django.db import transaction
from rest_framework import serializers

from .models import FeePaymentEntry, FeeRecord, FeeStructure


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = "__all__"


class FeePaymentEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeePaymentEntry
        fields = "__all__"
        read_only_fields = ["recorded_by", "recorded_at"]


class FeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
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
            "fee_structure",
            "amount_due",
            "amount_paid",
            "status",
            "results_unlocked",
            "notes",
            "updated_by",
            "updated_at",
            "created_at",
            "payments",
            "payment",
        ]
        read_only_fields = ["status", "results_unlocked", "updated_by", "updated_at", "created_at"]

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
