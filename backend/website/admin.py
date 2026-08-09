from django.contrib import admin

from .models import Application, Enquiry, GalleryImage, NewsPost

admin.site.register(NewsPost)
admin.site.register(GalleryImage)
admin.site.register(Enquiry)
admin.site.register(Application)
