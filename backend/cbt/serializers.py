from rest_framework import serializers

from cbt.models import CbtAnswer, CbtAttempt, CbtChoice, CbtPaper, CbtQuestion, JambAttempt


class CbtChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CbtChoice
        fields = ["id", "label", "text", "is_correct"]


class CbtChoiceStudentSerializer(serializers.ModelSerializer):
    """Hide is_correct from students during an attempt."""

    class Meta:
        model = CbtChoice
        fields = ["id", "label", "text"]


class CbtQuestionSerializer(serializers.ModelSerializer):
    choices = CbtChoiceSerializer(many=True, required=False)

    class Meta:
        model = CbtQuestion
        fields = ["id", "prompt", "order", "marks", "choices"]


class CbtQuestionStudentSerializer(serializers.ModelSerializer):
    choices = CbtChoiceStudentSerializer(many=True, read_only=True)

    class Meta:
        model = CbtQuestion
        fields = ["id", "prompt", "order", "marks", "choices"]


class CbtPaperSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_arm_label = serializers.CharField(source="class_arm.label", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    question_count = serializers.SerializerMethodField()
    component_max = serializers.IntegerField(read_only=True)
    questions = CbtQuestionSerializer(many=True, required=False)

    class Meta:
        model = CbtPaper
        fields = [
            "id",
            "title",
            "paper_type",
            "score_component",
            "component_max",
            "subject",
            "subject_name",
            "class_arm",
            "class_arm_label",
            "term",
            "term_name",
            "duration_minutes",
            "status",
            "opens_at",
            "closes_at",
            "created_by",
            "created_at",
            "updated_at",
            "question_count",
            "questions",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at", "paper_type"]

    def get_question_count(self, obj):
        return obj.questions.count()

    def validate(self, attrs):
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)
        class_arm = attrs.get("class_arm") or getattr(self.instance, "class_arm", None)
        if subject and class_arm and subject.class_level_id != class_arm.class_level_id:
            raise serializers.ValidationError(
                {
                    "subject": (
                        f"Subject '{subject.name}' belongs to {subject.class_level.name}, "
                        f"but the selected arm is {class_arm.label}."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        paper = CbtPaper.objects.create(**validated_data)
        self._upsert_questions(paper, questions_data)
        return paper

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if questions_data is not None:
            instance.questions.all().delete()
            self._upsert_questions(instance, questions_data)
        return instance

    def _upsert_questions(self, paper, questions_data):
        for index, qdata in enumerate(questions_data, start=1):
            choices = qdata.pop("choices", [])
            question = CbtQuestion.objects.create(
                paper=paper,
                prompt=qdata.get("prompt", ""),
                order=qdata.get("order") or index,
                marks=qdata.get("marks") or 1,
            )
            correct_count = 0
            for choice in choices:
                is_correct = bool(choice.get("is_correct"))
                if is_correct:
                    correct_count += 1
                CbtChoice.objects.create(
                    question=question,
                    label=choice.get("label", "A"),
                    text=choice.get("text", ""),
                    is_correct=is_correct,
                )
            if choices and correct_count != 1:
                raise serializers.ValidationError(
                    {"questions": f"Question {question.order} must have exactly one correct option."}
                )


class CbtPaperListSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_arm_label = serializers.CharField(source="class_arm.label", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    question_count = serializers.SerializerMethodField()
    component_max = serializers.IntegerField(read_only=True)

    class Meta:
        model = CbtPaper
        fields = [
            "id",
            "title",
            "score_component",
            "component_max",
            "subject",
            "subject_name",
            "class_arm",
            "class_arm_label",
            "term",
            "term_name",
            "duration_minutes",
            "status",
            "question_count",
            "created_at",
        ]

    def get_question_count(self, obj):
        return getattr(obj, "_question_count", None) or obj.questions.count()


class CbtAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)
    paper_title = serializers.CharField(source="paper.title", read_only=True)

    class Meta:
        model = CbtAttempt
        fields = [
            "id",
            "paper",
            "paper_title",
            "student",
            "student_name",
            "student_code",
            "started_at",
            "submitted_at",
            "earned_marks",
            "paper_total",
            "scaled_score",
            "status",
            "written_to_results",
        ]
        read_only_fields = fields


class CbtAttemptTakeSerializer(serializers.ModelSerializer):
    paper_title = serializers.CharField(source="paper.title", read_only=True)
    duration_minutes = serializers.IntegerField(
        source="paper.duration_minutes", read_only=True
    )
    score_component = serializers.CharField(
        source="paper.score_component", read_only=True
    )
    component_max = serializers.IntegerField(
        source="paper.component_max", read_only=True
    )
    questions = serializers.SerializerMethodField()
    deadline = serializers.SerializerMethodField()

    class Meta:
        model = CbtAttempt
        fields = [
            "id",
            "paper",
            "paper_title",
            "status",
            "started_at",
            "deadline",
            "duration_minutes",
            "score_component",
            "component_max",
            "questions",
            "scaled_score",
            "earned_marks",
            "paper_total",
            "written_to_results",
        ]

    def get_deadline(self, obj):
        from cbt.services import attempt_deadline

        return attempt_deadline(obj).isoformat()

    def get_questions(self, obj):
        qs = obj.paper.questions.prefetch_related("choices")
        return CbtQuestionStudentSerializer(qs, many=True).data


class JambAttemptSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_code = serializers.CharField(source="student.student_id", read_only=True)

    class Meta:
        model = JambAttempt
        fields = [
            "id",
            "student",
            "student_name",
            "student_code",
            "title",
            "score_percent",
            "subjects_json",
            "taken_at",
            "source",
            "meta",
        ]
        read_only_fields = fields
