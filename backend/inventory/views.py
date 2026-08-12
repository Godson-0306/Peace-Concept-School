from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets

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


def user_can_access_inventory(user, inventory_id: int) -> bool:
    if can_supervise_inventory(user):
        return True
    return inventory_id in assigned_inventory_ids(user)


def require_inventory_access(user, inventory_id: int):
    if not user_can_access_inventory(user, inventory_id):
        raise PermissionDenied("Not assigned to this inventory.")


class InventoryViewSet(viewsets.ModelViewSet):
    queryset = Inventory.objects.prefetch_related("items").all()
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
        return qs.filter(id__in=assigned_inventory_ids(user))


class InventoryAssignmentViewSet(viewsets.ModelViewSet):
    queryset = InventoryAssignment.objects.select_related(
        "inventory", "staff", "staff__user"
    ).all()
    serializer_class = InventoryAssignmentSerializer
    permission_classes = [IsAdminAccount]
    filterset_fields = ["inventory", "staff", "is_active"]


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.select_related("inventory").all()
    serializer_class = StockItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inventory", "is_active"]
    search_fields = ["name", "sku"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        return qs.filter(inventory_id__in=assigned_inventory_ids(user))

    def perform_create(self, serializer):
        if not can_supervise_inventory(self.request.user):
            raise PermissionDenied("Only admin or accountant can edit the catalog.")
        inventory = serializer.validated_data["inventory"]
        require_inventory_access(self.request.user, inventory.id)
        serializer.save()

    def perform_update(self, serializer):
        if not can_supervise_inventory(self.request.user):
            raise PermissionDenied("Only admin or accountant can edit the catalog.")
        require_inventory_access(self.request.user, serializer.instance.inventory_id)
        serializer.save()

    def perform_destroy(self, instance):
        if not can_supervise_inventory(self.request.user):
            raise PermissionDenied("Only admin or accountant can edit the catalog.")
        require_inventory_access(self.request.user, instance.inventory_id)
        instance.delete()


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related(
        "item", "item__inventory", "recorded_by"
    ).all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["item", "movement_type"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        inventory = self.request.query_params.get("inventory")
        if inventory:
            qs = qs.filter(item__inventory_id=inventory)
        if can_supervise_inventory(user):
            return qs
        return qs.filter(item__inventory_id__in=assigned_inventory_ids(user))

    def perform_create(self, serializer):
        item = serializer.validated_data["item"]
        require_inventory_access(self.request.user, item.inventory_id)
        serializer.save(recorded_by=self.request.user)


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related(
        "inventory", "item", "student", "recorded_by"
    ).all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["inventory", "item", "student"]
    search_fields = [
        "buyer_name",
        "student__full_name",
        "student__student_id",
        "item__name",
    ]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_supervise_inventory(user):
            return qs
        return qs.filter(inventory_id__in=assigned_inventory_ids(user))

    def perform_create(self, serializer):
        inventory = serializer.validated_data["inventory"]
        require_inventory_access(self.request.user, inventory.id)
        serializer.save(recorded_by=self.request.user)
