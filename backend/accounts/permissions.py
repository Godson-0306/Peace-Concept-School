from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import AccountType, PositionType


def get_staff_profile(user):
    return getattr(user, "staff_profile", None)


def user_positions(user):
    staff = get_staff_profile(user)
    if not staff:
        return []
    return list(staff.positions.filter(is_active=True))


def has_position(user, position: str) -> bool:
    return any(p.position == position for p in user_positions(user))


def is_vice_principal(user) -> bool:
    return has_position(user, PositionType.VICE_PRINCIPAL)


def is_hod(user) -> bool:
    return has_position(user, PositionType.HOD)


def is_form_teacher(user) -> bool:
    return has_position(user, PositionType.FORM_TEACHER)


def can_manage_accounts(user) -> bool:
    return user.is_authenticated and (
        user.is_superuser or user.account_type == AccountType.ADMIN
    )


def can_edit_all_results(user) -> bool:
    if not user.is_authenticated:
        return False
    if user.account_type in (AccountType.ADMIN, AccountType.PRINCIPAL):
        return True
    return False


def can_view_all_results(user) -> bool:
    if can_edit_all_results(user):
        return True
    return is_vice_principal(user)


def can_publish_results(user) -> bool:
    return user.is_authenticated and user.account_type in (
        AccountType.ADMIN,
        AccountType.PRINCIPAL,
    )


def can_manage_fees(user) -> bool:
    return user.is_authenticated and user.account_type in (
        AccountType.ADMIN,
        AccountType.ACCOUNTANT,
    )


def can_supervise_inventory(user) -> bool:
    return user.is_authenticated and user.account_type in (
        AccountType.ADMIN,
        AccountType.ACCOUNTANT,
    )


def form_teacher_class_arm_ids(user):
    return [
        p.class_arm_id
        for p in user_positions(user)
        if p.position == PositionType.FORM_TEACHER and p.class_arm_id
    ]


def hod_department_ids(user):
    return [
        p.department_id
        for p in user_positions(user)
        if p.position == PositionType.HOD and p.department_id
    ]


class IsAdminAccount(BasePermission):
    def has_permission(self, request, view):
        return can_manage_accounts(request.user)


class IsAdminOrPrincipal(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.account_type in (
            AccountType.ADMIN,
            AccountType.PRINCIPAL,
        )


class IsAccountantOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return can_manage_fees(request.user)


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
