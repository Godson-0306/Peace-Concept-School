from django.contrib import admin

from cbt.models import (
    CbtAnswer,
    CbtAttempt,
    CbtChoice,
    CbtPaper,
    CbtQuestion,
    JambAttempt,
)


class CbtChoiceInline(admin.TabularInline):
    model = CbtChoice
    extra = 4


class CbtQuestionInline(admin.TabularInline):
    model = CbtQuestion
    extra = 0
    show_change_link = True


@admin.register(CbtPaper)
class CbtPaperAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "score_component",
        "subject",
        "class_arm",
        "term",
        "status",
        "duration_minutes",
    )
    list_filter = ("status", "score_component", "term")
    search_fields = ("title",)
    inlines = [CbtQuestionInline]


@admin.register(CbtQuestion)
class CbtQuestionAdmin(admin.ModelAdmin):
    list_display = ("paper", "order", "marks", "prompt")
    inlines = [CbtChoiceInline]


admin.site.register(CbtAttempt)
admin.site.register(CbtAnswer)
admin.site.register(JambAttempt)
