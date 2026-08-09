from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    ParentViewSet,
    PositionAssignmentViewSet,
    StaffViewSet,
    StudentViewSet,
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
    my_results,
)
from fees.views import FeePaymentEntryViewSet, FeeRecordViewSet, FeeStructureViewSet
from identity.views import report_card_pdf, student_id_card
from inventory.views import (
    InventoryAssignmentViewSet,
    InventoryViewSet,
    SaleViewSet,
    StockItemViewSet,
    StockMovementViewSet,
)
from website.views import ApplicationViewSet, EnquiryViewSet, GalleryImageViewSet, NewsPostViewSet

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
    return JsonResponse({"status": "ok", "service": "peace-concept-school-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/login/", login_view),
    path("api/auth/logout/", logout_view),
    path("api/auth/me/", me_view),
    path("api/auth/csrf/", csrf_view),
    path("api/results/me/", my_results),
    path("api/identity/report-card/<int:student_id>/", report_card_pdf),
    path("api/identity/id-card/<int:student_id>/", student_id_card),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
