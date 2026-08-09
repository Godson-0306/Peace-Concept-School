from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import ParentProfile, PositionAssignment, StaffProfile, StudentProfile, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "account_type", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "phone")}),
        ("Role", {"fields": ("account_type", "must_change_password")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "account_type", "is_staff", "is_superuser"),
            },
        ),
    )


admin.site.register(StaffProfile)
admin.site.register(StudentProfile)
admin.site.register(ParentProfile)
admin.site.register(PositionAssignment)
