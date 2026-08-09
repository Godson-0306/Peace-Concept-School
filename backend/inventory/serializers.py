from django.db import transaction
from rest_framework import serializers

from .models import Inventory, InventoryAssignment, Sale, StockItem, StockMovement


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = "__all__"


class InventoryAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.full_name", read_only=True)
    inventory_name = serializers.CharField(source="inventory.name", read_only=True)

    class Meta:
        model = InventoryAssignment
        fields = "__all__"


class StockItemSerializer(serializers.ModelSerializer):
    inventory_name = serializers.CharField(source="inventory.name", read_only=True)

    class Meta:
        model = StockItem
        fields = "__all__"


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = ["recorded_by", "recorded_at"]


class SaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sale
        fields = "__all__"
        read_only_fields = ["total_amount", "recorded_by", "recorded_at"]

    @transaction.atomic
    def create(self, validated_data):
        item = validated_data["item"]
        qty = validated_data["quantity"]
        if item.quantity < qty:
            raise serializers.ValidationError({"quantity": "Insufficient stock."})
        sale = Sale.objects.create(**validated_data)
        item.quantity -= qty
        item.save(update_fields=["quantity"])
        StockMovement.objects.create(
            item=item,
            movement_type=StockMovement.MovementType.OUT,
            quantity=qty,
            note=f"Sale #{sale.id}",
            recorded_by=validated_data.get("recorded_by"),
        )
        return sale
