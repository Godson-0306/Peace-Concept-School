from django.contrib import admin

from .models import (
    AcademicSession,
    ClassArm,
    ClassLevel,
    Department,
    StudentIdSequence,
    Subject,
    TeacherAssignment,
    Term,
)

admin.site.register(AcademicSession)
admin.site.register(Term)
admin.site.register(ClassLevel)
admin.site.register(ClassArm)
admin.site.register(Department)
admin.site.register(Subject)
admin.site.register(TeacherAssignment)
admin.site.register(StudentIdSequence)
