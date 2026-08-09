from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.models import AccountType
from accounts.permissions import IsAdminAccount, can_supervise_inventory

from .models import Inventory, InventoryAssignment, Sale, StockItem, StockMovement
from .serializers import (
    InventoryAssignmentSerializer,
    InventorySerializer,
    SaleSerializer,
    StockItemSerializer,
    StockMovementSerializer,
)


def assigned_inventory_ids(user):
    if not hasattr(user, "staff_profile"):
        return []
    return list(
        user.staff_profile.inventory_assignments.filter(is_active=True).values_list(
            "inventory_id", flat=True
        )
    )


class InventoryViewSet(viewsets.ModelViewSet):
    queryset = Inventory.objects.all()
    serializer_class = InventorySerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminAccount()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        ids = assigned_inventory_ids(user)
        return qs.filter(id__in=ids)


class InventoryAssignmentViewSet(viewsets.ModelViewSet):
    queryset = InventoryAssignment.objects.select_related("inventory", "staff").all()
    serializer_class = InventoryAssignmentSerializer
    permission_classes = [IsAdminAccount]


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.select_related("inventory").all()
    serializer_class = StockItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inventory", "is_active"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        return qs.filter(inventory_id__in=assigned_inventory_ids(user))


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("item").all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        return qs.filter(item__inventory_id__in=assigned_inventory_ids(user))

    def perform_create(self, serializer):
        movement = serializer.save(recorded_by=self.request.user)
        item = movement.item
        if movement.movement_type == StockMovement.MovementType.IN:
            item.quantity += abs(movement.quantity)
        elif movement.movement_type == StockMovement.MovementType.OUT:
            item.quantity = max(0, item.quantity - abs(movement.quantity))
        else:
            item.quantity = max(0, item.quantity + movement.quantity)
        item.save(update_fields=["quantity"])


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related("inventory", "item", "student").all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inventory", "item", "student"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        return qs.filter(inventory_id__in=assigned_inventory_ids(user))

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)
