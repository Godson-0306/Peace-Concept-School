from django.contrib import admin

from .models import FeePaymentEntry, FeeRecord, FeeStructure

admin.site.register(FeeStructure)
admin.site.register(FeeRecord)
admin.site.register(FeePaymentEntry)
