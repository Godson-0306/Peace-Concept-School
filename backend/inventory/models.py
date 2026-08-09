from django.conf import settings
from django.db import models


class Inventory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Inventories"

    def __str__(self):
        return self.name


class InventoryAssignment(models.Model):
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="assignments")
    staff = models.ForeignKey(
        "accounts.StaffProfile", on_delete=models.CASCADE, related_name="inventory_assignments"
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("inventory", "staff")


class StockItem(models.Model):
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=120)
    sku = models.CharField(max_length=64, blank=True)
    quantity = models.PositiveIntegerField(default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("inventory", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.inventory.name})"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        IN = "in", "Stock In"
        OUT = "out", "Stock Out"
        ADJUST = "adjust", "Adjustment"

    item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=16, choices=MovementType.choices)
    quantity = models.IntegerField()
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    recorded_at = models.DateTimeField(auto_now_add=True)


class Sale(models.Model):
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="sales")
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name="sales")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    buyer_name = models.CharField(max_length=255, blank=True)
    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchases",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.total_amount = self.quantity * self.unit_price
        super().save(*args, **kwargs)
