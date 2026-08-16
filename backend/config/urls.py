import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from django.db import connection

from accounts.views import (
    ParentViewSet,
    PositionAssignmentViewSet,
    StaffViewSet,
    StudentViewSet,
    change_password_view,
    csrf_view,
    login_view,
    logout_view,
    me_view,
)
from academics.views import (
    AcademicSessionViewSet,
    ClassArmViewSet,
    ClassLevelViewSet,
    DepartmentViewSet,
    SubjectViewSet,
    TeacherAssignmentViewSet,
    TermViewSet,
)
from assessments.views import (
    AssessmentScoreViewSet,
    AttendanceRecordViewSet,
    FormClassRecordViewSet,
    StudentFormRecordViewSet,
    dashboard_summary,
    my_results,
)
from fees.views import FeePaymentEntryViewSet, FeeRecordViewSet, FeeStructureViewSet
from identity.views import id_cards_batch, report_card_pdf, report_cards_batch, student_id_card
from inventory.views import (
    InventoryAssignmentViewSet,
    InventoryViewSet,
    SaleViewSet,
    StockItemViewSet,
    StockMovementViewSet,
)
from website.views import ApplicationViewSet, EnquiryViewSet, GalleryImageViewSet, NewsPostViewSet
from cbt.views import CbtPaperViewSet, cbt_options, jamb_progress

router = DefaultRouter()
router.register(r"staff", StaffViewSet, basename="staff")
router.register(r"students", StudentViewSet, basename="students")
router.register(r"parents", ParentViewSet, basename="parents")
router.register(r"positions", PositionAssignmentViewSet, basename="positions")
router.register(r"sessions", AcademicSessionViewSet, basename="sessions")
router.register(r"terms", TermViewSet, basename="terms")
router.register(r"class-levels", ClassLevelViewSet, basename="class-levels")
router.register(r"class-arms", ClassArmViewSet, basename="class-arms")
router.register(r"departments", DepartmentViewSet, basename="departments")
router.register(r"subjects", SubjectViewSet, basename="subjects")
router.register(r"teacher-assignments", TeacherAssignmentViewSet, basename="teacher-assignments")
router.register(r"scores", AssessmentScoreViewSet, basename="scores")
router.register(r"form-class", FormClassRecordViewSet, basename="form-class")
router.register(r"student-form", StudentFormRecordViewSet, basename="student-form")
router.register(r"attendance", AttendanceRecordViewSet, basename="attendance")
router.register(r"cbt/papers", CbtPaperViewSet, basename="cbt-papers")
router.register(r"fee-structures", FeeStructureViewSet, basename="fee-structures")
router.register(r"fee-records", FeeRecordViewSet, basename="fee-records")
router.register(r"fee-payments", FeePaymentEntryViewSet, basename="fee-payments")
router.register(r"inventories", InventoryViewSet, basename="inventories")
router.register(r"inventory-assignments", InventoryAssignmentViewSet, basename="inventory-assignments")
router.register(r"stock-items", StockItemViewSet, basename="stock-items")
router.register(r"stock-movements", StockMovementViewSet, basename="stock-movements")
router.register(r"sales", SaleViewSet, basename="sales")
router.register(r"website/news", NewsPostViewSet, basename="news")
router.register(r"website/gallery", GalleryImageViewSet, basename="gallery")
router.register(r"website/enquiries", EnquiryViewSet, basename="enquiries")
router.register(r"website/applications", ApplicationViewSet, basename="applications")


def health(_request):
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as exc:  # noqa: BLE001
        return JsonResponse(
            {"status": "error", "service": "peace-concept-school-api", "detail": str(exc)},
            status=503,
        )
    return JsonResponse({"status": "ok", "service": "peace-concept-school-api"})


_admin_enabled = settings.DEBUG or os.environ.get("DJANGO_ADMIN_ENABLED", "").lower() in (
    "1",
    "true",
    "yes",
)

urlpatterns = [
    *([path("admin/", admin.site.urls)] if _admin_enabled else []),
    path("api/health/", health),
    path("api/auth/login/", login_view),
    path("api/auth/logout/", logout_view),
    path("api/auth/me/", me_view),
    path("api/auth/change-password/", change_password_view),
    path("api/auth/csrf/", csrf_view),
    path("api/results/me/", my_results),
    path("api/dashboard/", dashboard_summary),
    path("api/cbt/jamb/progress/", jamb_progress),
    path("api/cbt/options/", cbt_options),
    path("api/identity/report-card/<int:student_id>/", report_card_pdf),
    path("api/identity/id-card/<int:student_id>/", student_id_card),
    path("api/identity/report-cards/batch/", report_cards_batch),
    path("api/identity/id-cards/batch/", id_cards_batch),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
