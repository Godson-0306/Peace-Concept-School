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
    ).annotate(_question_count=Count("questions"))

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
        if paper.status == CbtPaper.Status.PUBLISHED and request.data.get("questions"):
            # Allow metadata edits; full rewrite of questions only in draft.
            pass
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
def jamb_progress(request):
    """
    Progress-only JAMB attempts for the logged-in student (or admin filter).
    Empty until the external JAMB CBT module writes rows.
    """
    user = request.user
    qs = JambAttempt.objects.select_related("student").all()
    if user.account_type == AccountType.STUDENT and hasattr(user, "student_profile"):
        qs = qs.filter(student=user.student_profile)
    elif can_view_all_results(user) or user.account_type == AccountType.ADMIN:
        student_id = request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
    else:
        return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

    return Response(
        {
            "integration": "pending",
            "message": "JAMB CBT engine will be wired from the external repository.",
            "results": JambAttemptSerializer(qs[:50], many=True).data,
        }
    )
