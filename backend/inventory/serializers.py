from django.db import transaction
from rest_framework import serializers

from .models import Inventory, InventoryAssignment, Sale, StockItem, StockMovement


class InventorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Inventory
        fields = [
            "id",
            "name",
            "category",
            "description",
            "is_active",
            "created_at",
            "item_count",
        ]
        read_only_fields = ["created_at"]

    def get_item_count(self, obj) -> int:
        return obj.items.filter(is_active=True).count()


class InventoryAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source="staff.full_name", read_only=True)
    staff_username = serializers.CharField(source="staff.user.username", read_only=True)
    inventory_name = serializers.CharField(source="inventory.name", read_only=True)

    class Meta:
        model = InventoryAssignment
        fields = [
            "id",
            "inventory",
            "inventory_name",
            "staff",
            "staff_name",
            "staff_username",
            "is_active",
            "assigned_at",
        ]
        read_only_fields = ["assigned_at"]


class StockItemSerializer(serializers.ModelSerializer):
    inventory_name = serializers.CharField(source="inventory.name", read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id",
            "inventory",
            "inventory_name",
            "name",
            "sku",
            "quantity",
            "unit_price",
            "is_active",
        ]
        read_only_fields = ["quantity"]


class StockMovementSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    inventory = serializers.IntegerField(source="item.inventory_id", read_only=True)
    inventory_name = serializers.CharField(source="item.inventory.name", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "item",
            "item_name",
            "inventory",
            "inventory_name",
            "movement_type",
            "quantity",
            "note",
            "recorded_by",
            "recorded_by_name",
            "recorded_at",
            "remaining_quantity",
        ]
        read_only_fields = ["recorded_by", "recorded_at"]

    def get_recorded_by_name(self, obj) -> str:
        user = obj.recorded_by
        if not user:
            return ""
        name = user.get_full_name()
        return name or user.get_username()

    def get_remaining_quantity(self, obj) -> int:
        return obj.item.quantity

    def validate(self, attrs):
        item = attrs.get("item") or getattr(self.instance, "item", None)
        movement_type = attrs.get("movement_type") or getattr(
            self.instance, "movement_type", None
        )
        quantity = attrs.get("quantity")
        if quantity is None:
            quantity = getattr(self.instance, "quantity", None)
        if item is None or movement_type is None or quantity is None:
            return attrs

        qty = abs(int(quantity))
        if qty <= 0 and movement_type != StockMovement.MovementType.ADJUST:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than zero."})

        if movement_type == StockMovement.MovementType.OUT and item.quantity < qty:
            raise serializers.ValidationError(
                {"quantity": f"Insufficient stock. Available: {item.quantity}."}
            )
        if movement_type == StockMovement.MovementType.ADJUST:
            # Adjust quantity is a signed delta; reject if resulting stock would go negative.
            resulting = item.quantity + int(quantity)
            if resulting < 0:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            f"Adjustment would make stock negative "
                            f"(current {item.quantity})."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        movement = StockMovement.objects.create(**validated_data)
        item = movement.item
        if movement.movement_type == StockMovement.MovementType.IN:
            item.quantity += abs(movement.quantity)
        elif movement.movement_type == StockMovement.MovementType.OUT:
            item.quantity -= abs(movement.quantity)
        else:
            item.quantity = item.quantity + movement.quantity
        item.save(update_fields=["quantity"])
        return movement


class SaleSerializer(serializers.ModelSerializer):
    inventory_name = serializers.CharField(source="inventory.name", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "inventory",
            "inventory_name",
            "item",
            "item_name",
            "quantity",
            "unit_price",
            "total_amount",
            "buyer_name",
            "student",
            "student_name",
            "student_code",
            "recorded_by",
            "recorded_by_name",
            "recorded_at",
            "remaining_quantity",
        ]
        read_only_fields = ["total_amount", "recorded_by", "recorded_at"]

    def get_recorded_by_name(self, obj) -> str:
        user = obj.recorded_by
        if not user:
            return ""
        name = user.get_full_name()
        return name or user.get_username()

    def get_remaining_quantity(self, obj) -> int:
        return obj.item.quantity

    def validate(self, attrs):
        item = attrs.get("item") or getattr(self.instance, "item", None)
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        quantity = attrs.get("quantity") or getattr(self.instance, "quantity", None)
        if item and inventory and item.inventory_id != inventory.id:
            raise serializers.ValidationError(
                {"item": "Item does not belong to the selected inventory."}
            )
        if item and quantity is not None and item.quantity < quantity:
            raise serializers.ValidationError(
                {"quantity": f"Insufficient stock. Available: {item.quantity}."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        item = validated_data["item"]
        qty = validated_data["quantity"]
        # Re-check under lock of the row.
        item = StockItem.objects.select_for_update().get(pk=item.pk)
        if item.quantity < qty:
            raise serializers.ValidationError(
                {"quantity": f"Insufficient stock. Available: {item.quantity}."}
            )
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
        # Clear prefetch so remaining_quantity reflects the new qty.
        cache = getattr(sale, "_prefetched_objects_cache", None)
        if cache is not None:
            cache.pop("item", None)
        sale.item = item
        return sale
