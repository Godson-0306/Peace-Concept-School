from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccountType
from accounts.permissions import can_edit_all_results, can_view_all_results
from cbt.models import CbtAttempt, CbtPaper, CbtQuestion, JambAttempt
from cbt.serializers import (
    CbtAttemptSerializer,
    CbtAttemptTakeSerializer,
    CbtPaperListSerializer,
    CbtPaperSerializer,
    CbtQuestionSerializer,
    JambAttemptSerializer,
    JambAttemptWriteSerializer,
)
from cbt.services import is_attempt_expired, score_attempt, submit_attempt


def _teacher_assignment_q(user):
    if not hasattr(user, "staff_profile"):
        return Q(pk__in=[])
    staff = user.staff_profile
    pairs = list(
        staff.assignments.filter(is_active=True).values_list("class_arm_id", "subject_id")
    )
    if not pairs:
        return Q(pk__in=[])
    q = Q()
    for class_arm_id, subject_id in pairs:
        q |= Q(class_arm_id=class_arm_id, subject_id=subject_id)
    return q


def user_can_manage_paper(user, paper: CbtPaper | None = None) -> bool:
    if can_edit_all_results(user) or user.account_type == AccountType.ADMIN:
        return True
    if user.account_type != AccountType.TEACHER:
        return False
    if paper is None:
        return hasattr(user, "staff_profile")
    if not hasattr(user, "staff_profile"):
        return False
    return user.staff_profile.assignments.filter(
        is_active=True,
        class_arm_id=paper.class_arm_id,
        subject_id=paper.subject_id,
    ).exists()


class CbtPaperViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CbtPaper.objects.select_related(
        "subject", "class_arm", "term", "created_by"
    ).annotate(_question_count=Count("questions")).order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "list":
            return CbtPaperListSerializer
        return CbtPaperSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        paper_type = self.request.query_params.get("paper_type") or CbtPaper.PaperType.NORMAL
        qs = qs.filter(paper_type=paper_type)

        if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
            student = user.student_profile
            return qs.filter(
                status=CbtPaper.Status.PUBLISHED,
                class_arm_id=student.class_arm_id,
            )
        if can_view_all_results(user) or user.account_type == AccountType.ADMIN:
            return qs
        if user.account_type == AccountType.TEACHER:
            return qs.filter(_teacher_assignment_q(user) | Q(created_by=user))
        return qs.none()

    def perform_create(self, serializer):
        if not user_can_manage_paper(self.request.user):
            raise PermissionError("Not allowed to create CBT papers.")
        paper = serializer.save(
            created_by=self.request.user, paper_type=CbtPaper.PaperType.NORMAL
        )
        if not user_can_manage_paper(self.request.user, paper):
            paper.delete()
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You are not assigned to this subject/class.")

    def create(self, request, *args, **kwargs):
        if not user_can_manage_paper(request.user):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        try:
            return super().create(request, *args, **kwargs)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    def update(self, request, *args, **kwargs):
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        if paper.status == CbtPaper.Status.PUBLISHED and (
            "questions" in request.data
            and request.data.get("questions") is not None
        ):
            return Response(
                {
                    "detail": "Published papers cannot rewrite questions. "
                    "Revert to draft first, or edit metadata only."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        paper = self.get_object()
        # Students must not see correct answers via full serializer.
        if request.user.account_type == AccountType.STUDENT:
            data = CbtPaperListSerializer(paper).data
            return Response(data)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        if paper.questions.count() == 0:
            return Response(
                {"detail": "Add at least one question before publishing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for question in paper.questions.prefetch_related("choices"):
            correct = sum(1 for c in question.choices.all() if c.is_correct)
            if correct != 1:
                return Response(
                    {"detail": f"Question {question.order} needs exactly one correct option."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        paper.status = CbtPaper.Status.PUBLISHED
        paper.save(update_fields=["status", "updated_at"])
        return Response(CbtPaperSerializer(paper).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        paper.status = CbtPaper.Status.CLOSED
        paper.save(update_fields=["status", "updated_at"])
        return Response(CbtPaperSerializer(paper).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        paper = self.get_object()
        user = request.user
        if user.account_type != AccountType.STUDENT or not hasattr(user, "student_profile"):
            return Response({"detail": "Students only."}, status=status.HTTP_403_FORBIDDEN)
        student = user.student_profile
        if paper.status != CbtPaper.Status.PUBLISHED:
            return Response({"detail": "This paper is not open."}, status=status.HTTP_400_BAD_REQUEST)
        if student.class_arm_id != paper.class_arm_id:
            return Response({"detail": "Not assigned to this class."}, status=status.HTTP_403_FORBIDDEN)
        now = timezone.now()
        if paper.opens_at and now < paper.opens_at:
            return Response({"detail": "Paper is not open yet."}, status=status.HTTP_400_BAD_REQUEST)
        if paper.closes_at and now > paper.closes_at:
            return Response({"detail": "Paper has closed."}, status=status.HTTP_400_BAD_REQUEST)

        attempt, created = CbtAttempt.objects.get_or_create(
            paper=paper, student=student
        )
        if attempt.status == CbtAttempt.Status.SUBMITTED:
            return Response(
                CbtAttemptTakeSerializer(attempt).data,
                status=status.HTTP_200_OK,
            )
        if is_attempt_expired(attempt):
            score_attempt(attempt)
            attempt.refresh_from_db()
            return Response(CbtAttemptTakeSerializer(attempt).data)

        return Response(
            CbtAttemptTakeSerializer(attempt).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        paper = self.get_object()
        user = request.user
        if user.account_type != AccountType.STUDENT or not hasattr(user, "student_profile"):
            return Response({"detail": "Students only."}, status=status.HTTP_403_FORBIDDEN)
        attempt = CbtAttempt.objects.filter(
            paper=paper, student=user.student_profile
        ).first()
        if not attempt:
            return Response(
                {"detail": "Start the test before submitting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        answers = request.data.get("answers") or []
        try:
            attempt = submit_attempt(attempt, answers)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CbtAttemptTakeSerializer(attempt).data)

    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        attempts = (
            CbtAttempt.objects.filter(paper=paper)
            .select_related("student")
            .order_by("student__full_name")
        )
        return Response(CbtAttemptSerializer(attempts, many=True).data)

    @action(detail=True, methods=["post"], url_path="replace_questions")
    def replace_questions(self, request, pk=None):
        """Replace all questions for a draft (or unpublished) paper."""
        paper = self.get_object()
        if not user_can_manage_paper(request.user, paper):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        if paper.status == CbtPaper.Status.CLOSED:
            return Response(
                {"detail": "Closed papers cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CbtPaperSerializer(
            paper, data={"questions": request.data.get("questions", [])}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        # Use internal helper via update
        paper.questions.all().delete()
        CbtPaperSerializer()._upsert_questions(paper, serializer.validated_data.get("questions", []) or request.data.get("questions", []))
        paper.refresh_from_db()
        return Response(CbtPaperSerializer(paper).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cbt_options(request):
    """
    Catalog for Normal CBT create forms: class levels, arms, subjects,
    sessions, and terms — scoped to the current user's permissions.
    """
    from academics.models import AcademicSession, ClassArm, ClassLevel, Subject, Term
    from academics.services.terms import ensure_all_session_terms

    ensure_all_session_terms()
    user = request.user

    levels = list(ClassLevel.objects.order_by("order", "name").values("id", "name", "order"))
    arms_qs = ClassArm.objects.select_related("class_level").order_by(
        "class_level__order", "name"
    )
    subjects_qs = Subject.objects.filter(
        is_active=True, subject_type=Subject.SubjectType.SUBJECT
    ).select_related("class_level").order_by("class_level__order", "order", "name")

    assignments = []
    if user.account_type == AccountType.TEACHER and hasattr(user, "staff_profile"):
        assignments = list(
            user.staff_profile.assignments.filter(is_active=True).values(
                "id", "class_arm_id", "subject_id", "session_id"
            )
        )
        allowed_arm_ids = {a["class_arm_id"] for a in assignments}
        allowed_subject_ids = {a["subject_id"] for a in assignments}
        arms_qs = arms_qs.filter(id__in=allowed_arm_ids)
        subjects_qs = subjects_qs.filter(id__in=allowed_subject_ids)
        level_ids = set(arms_qs.values_list("class_level_id", flat=True))
        levels = [lv for lv in levels if lv["id"] in level_ids]
    elif not (
        can_edit_all_results(user)
        or user.account_type == AccountType.ADMIN
        or user.account_type == AccountType.PRINCIPAL
    ):
        return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

    sessions = list(
        AcademicSession.objects.order_by("-start_year").values(
            "id", "name", "is_active", "start_year"
        )
    )
    terms = list(
        Term.objects.select_related("session")
        .order_by("session__start_year", "number")
        .values("id", "name", "number", "session_id", "is_active", "results_entry_open")
    )
    # Normalize term session key for the frontend.
    terms_out = [
        {
            "id": t["id"],
            "name": t["name"],
            "number": t["number"],
            "session": t["session_id"],
            "is_active": t["is_active"],
            "results_entry_open": t["results_entry_open"],
        }
        for t in terms
    ]

    arms = [
        {
            "id": a.id,
            "name": a.name,
            "label": a.label or f"{a.class_level.name}{a.name}",
            "class_level": a.class_level_id,
            "class_level_name": a.class_level.name,
        }
        for a in arms_qs
    ]
    subjects = [
        {
            "id": s.id,
            "name": s.name,
            "class_level": s.class_level_id,
            "class_level_name": s.class_level.name,
            "order": s.order,
        }
        for s in subjects_qs
    ]

    active_session = next((s for s in sessions if s["is_active"]), sessions[0] if sessions else None)
    active_term = next(
        (
            t
            for t in terms_out
            if t["is_active"]
            and (not active_session or t["session"] == active_session["id"])
        ),
        next(
            (t for t in terms_out if active_session and t["session"] == active_session["id"]),
            terms_out[0] if terms_out else None,
        ),
    )

    return Response(
        {
            "levels": levels,
            "arms": arms,
            "subjects": subjects,
            "sessions": sessions,
            "terms": terms_out,
            "assignments": assignments,
            "defaults": {
                "session_id": active_session["id"] if active_session else None,
                "term_id": active_term["id"] if active_term else None,
                "level_id": levels[0]["id"] if levels else None,
            },
            "score_components": [
                {"value": "ca1", "label": "CA1", "max": 20},
                {"value": "ca2", "label": "CA2", "max": 20},
                {"value": "exam", "label": "Exam", "max": 60},
            ],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def jamb_progress(request):
    """
    JAMB practice progress for students (GET list / POST save).
    Scores never write into AssessmentScore.
    """
    user = request.user

    if request.method == "POST":
        if user.account_type != AccountType.STUDENT or not hasattr(user, "student_profile"):
            return Response(
                {"detail": "Only students can save JAMB practice attempts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        writer = JambAttemptWriteSerializer(data=request.data)
        writer.is_valid(raise_exception=True)
        data = writer.validated_data
        attempt = JambAttempt.objects.create(
            student=user.student_profile,
            title=(data.get("title") or "JAMB Practice").strip() or "JAMB Practice",
            score_percent=data["score_percent"],
            subjects_json=data.get("subjects_json") or [],
            source=(data.get("source") or "jamb-cbt-website").strip() or "jamb-cbt-website",
            meta=data.get("meta") or {},
        )
        return Response(
            JambAttemptSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )

    qs = JambAttempt.objects.select_related("student").all()
    if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
        qs = qs.filter(student=user.student_profile)
    elif user.account_type == AccountType.PARENT and hasattr(user, "parent_profile"):
        qs = qs.filter(student__in=user.parent_profile.children.all())
        student_id = request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
    elif can_view_all_results(user) or user.account_type in (
        AccountType.ADMIN,
        AccountType.PRINCIPAL,
        AccountType.TEACHER,
        AccountType.ACCOUNTANT,
    ):
        student_id = request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
    else:
        # Other authenticated roles can open the engine; history stays empty.
        qs = qs.none()

    return Response(
        {
            "integration": "ready",
            "engine": "/jamb-cbt/index.html",
            "message": "JAMB CBT practice engine is available in the portal.",
            "results": JambAttemptSerializer(qs[:50], many=True).data,
        }
    )
