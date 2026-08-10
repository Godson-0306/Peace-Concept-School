from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class AccountType(models.TextChoices):
    ADMIN = "admin", "Admin"
    PRINCIPAL = "principal", "Principal"
    ACCOUNTANT = "accountant", "Accountant"
    STORE_STAFF = "store_staff", "Store/Inventory/Sales Person"
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"
    PARENT = "parent", "Parent"


class PositionType(models.TextChoices):
    HOD = "hod", "HOD"
    VICE_PRINCIPAL = "vice_principal", "Vice Principal"
    FORM_TEACHER = "form_teacher", "Form Teacher"
    TEACHER = "teacher", "Teacher"


class PromotionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROMOTED = "promoted", "Promoted"
    RETAINED = "retained", "Retained"
    GRADUATED = "graduated", "Graduated"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        username = extra_fields.pop("username", None) or email
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("account_type", AccountType.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    account_type = models.CharField(
        max_length=32,
        choices=AccountType.choices,
        default=AccountType.TEACHER,
    )
    phone = models.CharField(max_length=32, blank=True)
    must_change_password = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.account_type})"


class StaffProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    full_name = models.CharField(max_length=255)
    gender = models.CharField(max_length=16, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    state_of_origin = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    city_of_residence = models.CharField(max_length=100, blank=True)
    home_town = models.CharField(max_length=100, blank=True)
    lga_of_residence = models.CharField(max_length=100, blank=True)
    disability = models.CharField(max_length=255, blank=True)
    passport_photo = models.ImageField(upload_to="staff/photos/", blank=True, null=True)
    signature = models.ImageField(upload_to="staff/signatures/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name


class StudentProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="student_profile", null=True, blank=True
    )
    student_id = models.CharField(max_length=16, unique=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    gender = models.CharField(max_length=16, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    admission_year = models.PositiveIntegerField()
    date_of_admission = models.DateField(null=True, blank=True)
    class_arm = models.ForeignKey(
        "academics.ClassArm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    state_of_origin = models.CharField(max_length=100, blank=True)
    blood_group = models.CharField(max_length=16, blank=True)
    genotype = models.CharField(max_length=16, blank=True)
    disability = models.CharField(max_length=255, blank=True)
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
    passport_photo = models.ImageField(upload_to="students/photos/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    promotion_status = models.CharField(
        max_length=16,
        choices=PromotionStatus.choices,
        default=PromotionStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student_id"]

    def __str__(self):
        return f"{self.student_id} — {self.full_name}"


class ParentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="parent_profile")
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    children = models.ManyToManyField(StudentProfile, related_name="parents", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class PositionAssignment(models.Model):
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="positions")
    position = models.CharField(max_length=32, choices=PositionType.choices)
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hods",
    )
    class_arm = models.ForeignKey(
        "academics.ClassArm",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="form_teachers",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["staff", "position", "department", "class_arm"],
                name="unique_position_assignment",
            )
        ]

    def __str__(self):
        return f"{self.staff.full_name} — {self.position}"
