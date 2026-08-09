from django.contrib import admin

from .models import Inventory, InventoryAssignment, Sale, StockItem, StockMovement

admin.site.register(Inventory)
admin.site.register(InventoryAssignment)
admin.site.register(StockItem)
admin.site.register(StockMovement)
admin.site.register(Sale)
