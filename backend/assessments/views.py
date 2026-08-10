from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccountType
from accounts.permissions import (
    can_edit_all_results,
    can_publish_results,
    can_view_all_results,
    form_teacher_class_arm_ids,
    hod_department_ids,
    is_vice_principal,
)
from fees.models import FeeRecord
from notifications.tasks import notify_guardians_results_published

from .models import AssessmentScore, AttendanceRecord, FormClassRecord, StudentFormRecord
from .serializers import (
    AssessmentScoreSerializer,
    AttendanceRecordSerializer,
    FormClassRecordSerializer,
    StudentFormRecordSerializer,
)
from .services import compute_student_result, rank_class_arm


def user_can_edit_score(user, score: AssessmentScore) -> bool:
    if can_edit_all_results(user):
        return True
    if is_vice_principal(user):
        return False
    if user.account_type != AccountType.TEACHER or not hasattr(user, "staff_profile"):
        return False
    staff = user.staff_profile
    # Direct teaching assignment
    if staff.assignments.filter(
        class_arm_id=score.class_arm_id,
        subject_id=score.subject_id,
        is_active=True,
    ).exists():
        return True
    # HOD scope
    dept_ids = hod_department_ids(user)
    if score.subject.department_id in dept_ids:
        return True
    return False


def results_visible_for_student(student, term) -> bool:
    record = FeeRecord.objects.filter(student=student, term=term).first()
    if record and record.results_unlocked:
        return True
    # Also allow if current term is paid
    if record and record.status == FeeRecord.Status.PAID:
        return True
    return False


class AssessmentScoreViewSet(viewsets.ModelViewSet):
    queryset = AssessmentScore.objects.select_related(
        "student", "subject", "term", "class_arm"
    ).all()
    serializer_class = AssessmentScoreSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "subject", "term", "class_arm", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if can_view_all_results(user) or user.account_type == AccountType.ADMIN:
            return qs
        if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
            return qs.filter(student=user.student_profile, status=AssessmentScore.Status.PUBLISHED)
        if user.account_type == AccountType.PARENT and hasattr(user, "parent_profile"):
            return qs.filter(
                student__in=user.parent_profile.children.all(),
                status=AssessmentScore.Status.PUBLISHED,
            )
        if hasattr(user, "staff_profile"):
            staff = user.staff_profile
            assigned = staff.assignments.filter(is_active=True)
            from django.db.models import Q

            q = Q()
            for a in assigned:
                q |= Q(class_arm_id=a.class_arm_id, subject_id=a.subject_id)
            dept_ids = hod_department_ids(user)
            if dept_ids:
                q |= Q(subject__department_id__in=dept_ids)
            arms = form_teacher_class_arm_ids(user)
            if arms:
                q |= Q(class_arm_id__in=arms)
            if q:
                return qs.filter(q).distinct()
        return qs.none()

    def _ensure_results_entry_open(self, user, term):
        if can_edit_all_results(user):
            return
        if not getattr(term, "results_entry_open", False):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Result entry is closed for this term.")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self._ensure_results_entry_open(request.user, data["term"])
        score, _created = AssessmentScore.objects.update_or_create(
            student=data["student"],
            subject=data["subject"],
            term=data["term"],
            defaults={
                "class_arm": data["class_arm"],
                "ca1": data.get("ca1", 0),
                "ca2": data.get("ca2", 0),
                "exam": data.get("exam", 0),
                "entered_by": request.user,
                "status": AssessmentScore.Status.DRAFT,
            },
        )
        if not user_can_edit_score(request.user, score):
            if _created:
                score.delete()
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot enter scores for this subject/class.")
        out = self.get_serializer(score)
        return Response(out.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        instance = self.get_object()
        if is_vice_principal(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Vice Principal has view-only access.")
        if not user_can_edit_score(self.request.user, instance):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot edit this score.")
        self._ensure_results_entry_open(self.request.user, instance.term)
        # Teachers cannot change published status via normal update
        serializer.save(entered_by=self.request.user)

    @action(detail=False, methods=["post"])
    def publish(self, request):
        if not can_publish_results(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        term_id = request.data.get("term")
        class_arm_id = request.data.get("class_arm")
        if not term_id or not class_arm_id:
            return Response(
                {"detail": "term and class_arm are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = AssessmentScore.objects.filter(
            term_id=term_id, class_arm_id=class_arm_id, status=AssessmentScore.Status.DRAFT
        )
        updated = qs.update(
            status=AssessmentScore.Status.PUBLISHED, published_at=timezone.now()
        )
        notify_guardians_results_published.delay(term_id=term_id, class_arm_id=class_arm_id)
        return Response({"published_count": updated})

    @action(detail=False, methods=["post"])
    def publish_term(self, request):
        if not can_publish_results(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        term_id = request.data.get("term")
        if not term_id:
            return Response(
                {"detail": "term is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        class_arm_ids = list(
            AssessmentScore.objects.filter(
                term_id=term_id, status=AssessmentScore.Status.DRAFT
            )
            .values_list("class_arm_id", flat=True)
            .distinct()
        )
        updated = AssessmentScore.objects.filter(
            term_id=term_id, status=AssessmentScore.Status.DRAFT
        ).update(status=AssessmentScore.Status.PUBLISHED, published_at=timezone.now())
        for class_arm_id in class_arm_ids:
            notify_guardians_results_published.delay(
                term_id=term_id, class_arm_id=class_arm_id
            )
        return Response(
            {
                "published_count": updated,
                "class_arms_notified": len(class_arm_ids),
            }
        )

    @action(detail=False, methods=["get"])
    def class_results(self, request):
        term_id = request.query_params.get("term")
        class_arm_id = request.query_params.get("class_arm")
        if not term_id or not class_arm_id:
            return Response(
                {"detail": "term and class_arm are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        published_only = not can_view_all_results(request.user)
        if request.user.account_type == AccountType.ADMIN:
            published_only = False
        data = rank_class_arm(int(class_arm_id), int(term_id), published_only=published_only)
        return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_results(request):
    """Student/parent fee-gated results for a term."""
    term_id = request.query_params.get("term")
    student_id = request.query_params.get("student")
    user = request.user

    if user.account_type == AccountType.STUDENT:
        student = user.student_profile
    elif user.account_type == AccountType.PARENT:
        if not student_id:
            return Response({"detail": "student is required."}, status=400)
        student = user.parent_profile.children.filter(id=student_id).first()
        if not student:
            return Response({"detail": "Child not found."}, status=404)
    elif can_view_all_results(user) or user.account_type == AccountType.ADMIN:
        from accounts.models import StudentProfile

        student = StudentProfile.objects.filter(id=student_id).first()
        if not student:
            return Response({"detail": "Student not found."}, status=404)
    else:
        return Response({"detail": "Not allowed."}, status=403)

    from academics.models import Term

    term = Term.objects.filter(id=term_id).first() if term_id else Term.objects.filter(is_active=True).first()
    if not term:
        return Response({"detail": "Term not found."}, status=404)

    unlocked = results_visible_for_student(student, term)
    if not unlocked and user.account_type in (AccountType.STUDENT, AccountType.PARENT):
        return Response(
            {
                "locked": True,
                "detail": "Results for this term are locked until fees are marked Paid.",
                "student_code": student.student_id,
                "term": term.id,
            }
        )

    result = compute_student_result(student.id, term.id)
    rankings = rank_class_arm(student.class_arm_id, term.id, published_only=True)
    position = next((r["position"] for r in rankings if r["student_id"] == student.id), None)
    result["position"] = position
    result["locked"] = False
    result["student_name"] = student.full_name
    result["student_code"] = student.student_id
    return Response(result)


class FormClassRecordViewSet(viewsets.ModelViewSet):
    queryset = FormClassRecord.objects.all()
    serializer_class = FormClassRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["class_arm", "term"]

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_update(self, serializer):
        if is_vice_principal(self.request.user) and not can_edit_all_results(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("View only.")
        serializer.save(updated_by=self.request.user)


class StudentFormRecordViewSet(viewsets.ModelViewSet):
    queryset = StudentFormRecord.objects.select_related("student").all()
    serializer_class = StudentFormRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "term", "class_arm"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        record, _ = StudentFormRecord.objects.update_or_create(
            student=data["student"],
            term=data["term"],
            defaults={k: v for k, v in data.items() if k not in ("student", "term")},
        )
        return Response(self.get_serializer(record).data, status=status.HTTP_201_CREATED)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related("student").all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["student", "class_arm", "term", "date", "status"]

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)


def _resolve_next_term_begins(term):
    if term.next_term_resumption:
        return term.next_term_resumption.isoformat()
    nxt = (
        type(term)
        .objects.filter(session=term.session, number__gt=term.number)
        .order_by("number")
        .first()
    )
    if nxt and nxt.start_date:
        return nxt.start_date.isoformat()
    if nxt and nxt.next_term_resumption:
        return nxt.next_term_resumption.isoformat()
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    from academics.models import ClassArm, Subject, Term
    from django.db.models import Count, Q

    term_id = request.query_params.get("term")
    term = None
    if term_id:
        term = Term.objects.filter(id=term_id).select_related("session").first()
    if not term:
        term = Term.objects.filter(is_active=True).select_related("session").first()
    if not term:
        term = Term.objects.select_related("session").order_by("-session__start_year", "-number").first()

    if not term:
        return Response(
            {
                "active_term": None,
                "next_term_begins": None,
                "classes_missing_results": [],
            }
        )

    next_term_begins = _resolve_next_term_begins(term)
    user = request.user

    if user.account_type == AccountType.STUDENT:
        return Response(
            {
                "active_term": {
                    "id": term.id,
                    "name": term.name,
                    "session_name": term.session.name,
                    "is_active": term.is_active,
                },
                "next_term_begins": next_term_begins,
                "classes_missing_results": [],
            }
        )

    arms = ClassArm.objects.select_related("class_level").annotate(
        student_count=Count("students", filter=Q(students__is_active=True))
    ).filter(student_count__gt=0)

    if user.account_type == AccountType.TEACHER and hasattr(user, "staff_profile"):
        assigned_ids = (
            user.staff_profile.assignments.filter(is_active=True)
            .values_list("class_arm_id", flat=True)
            .distinct()
        )
        arms = arms.filter(id__in=assigned_ids)

    subject_counts = {
        row["class_level_id"]: row["count"]
        for row in Subject.objects.filter(
            is_active=True, subject_type=Subject.SubjectType.SUBJECT
        )
        .values("class_level_id")
        .annotate(count=Count("id"))
    }

    scored = {
        (row["class_arm_id"], row["subject_id"])
        for row in AssessmentScore.objects.filter(term=term).values("class_arm_id", "subject_id")
    }
    subjects_by_level = {}
    for subject in Subject.objects.filter(
        is_active=True, subject_type=Subject.SubjectType.SUBJECT
    ).only("id", "class_level_id"):
        subjects_by_level.setdefault(subject.class_level_id, []).append(subject.id)

    missing = []
    for arm in arms.order_by("class_level__order", "name"):
        subject_ids = subjects_by_level.get(arm.class_level_id, [])
        subject_count = subject_counts.get(arm.class_level_id, 0)
        subjects_with_scores = sum(
            1 for sid in subject_ids if (arm.id, sid) in scored
        )
        if subjects_with_scores < subject_count:
            missing.append(
                {
                    "class_arm_id": arm.id,
                    "label": arm.label or str(arm),
                    "subject_count": subject_count,
                    "subjects_with_scores": subjects_with_scores,
                    "student_count": arm.student_count,
                    "next_term_begins": next_term_begins,
                }
            )

    return Response(
        {
            "active_term": {
                "id": term.id,
                "name": term.name,
                "session_name": term.session.name,
                "is_active": term.is_active,
            },
            "next_term_begins": next_term_begins,
            "classes_missing_results": missing,
        }
    )
