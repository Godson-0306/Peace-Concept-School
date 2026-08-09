from django.contrib import admin

from .models import AssessmentScore, AttendanceRecord, FormClassRecord, StudentFormRecord

admin.site.register(AssessmentScore)
admin.site.register(FormClassRecord)
admin.site.register(StudentFormRecord)
admin.site.register(AttendanceRecord)
