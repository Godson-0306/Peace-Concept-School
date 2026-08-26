from django.contrib import admin

from .models import NotificationLog


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("channel", "recipient", "status", "related_student_id", "term", "created_at")
    list_filter = ("channel", "status")
    search_fields = ("recipient", "related_student_id", "subject")
    readonly_fields = ("created_at", "sent_at")
