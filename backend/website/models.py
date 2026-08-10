from django.db import models


class NewsPost(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    summary = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    cover_image = models.ImageField(upload_to="news/", blank=True, null=True)
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title


class GalleryImage(models.Model):
    title = models.CharField(max_length=200, blank=True)
    image = models.ImageField(upload_to="gallery/")
    caption = models.CharField(max_length=255, blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Enquiry(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        CLOSED = "closed", "Closed"

    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=32)
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Enquiries"


class Application(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        REVIEWING = "reviewing", "Reviewing"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    student_full_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    gender = models.CharField(max_length=16, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    applying_for_class = models.CharField(max_length=64)
    previous_school = models.CharField(max_length=255, blank=True)
    state_of_origin = models.CharField(max_length=100, blank=True)
    blood_group = models.CharField(max_length=16, blank=True)
    genotype = models.CharField(max_length=16, blank=True)
    disability = models.CharField(max_length=255, blank=True)
    passport_photo = models.ImageField(
        upload_to="applications/photos/", blank=True, null=True
    )
    address = models.TextField(blank=True)
    city_of_residence = models.CharField(max_length=100, blank=True)
    lga = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    whatsapp_phone = models.CharField(max_length=32, blank=True)
    guardian_name = models.CharField(max_length=255, blank=True)
    guardian_email = models.EmailField(blank=True)
    guardian_phone = models.CharField(max_length=32, blank=True)
    father_name = models.CharField(max_length=255, blank=True)
    father_phone = models.CharField(max_length=32, blank=True)
    father_whatsapp = models.CharField(max_length=32, blank=True)
    mother_name = models.CharField(max_length=255, blank=True)
    mother_phone = models.CharField(max_length=32, blank=True)
    mother_whatsapp = models.CharField(max_length=32, blank=True)
    hometown = models.CharField(max_length=100, blank=True)
    next_of_kin_name = models.CharField(max_length=255, blank=True)
    next_of_kin_relationship = models.CharField(max_length=64, blank=True)
    next_of_kin_address = models.TextField(blank=True)
    next_of_kin_phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    enrolled_student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_applications",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student_full_name} ({self.applying_for_class})"
