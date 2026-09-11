from django.db import migrations

LADDER = (
    "Creche",
    "Pre-Nursery",
    "Nursery 1",
    "Nursery 2",
    "Basic 1",
    "Basic 2",
    "Basic 3",
    "Basic 4",
    "Basic 5",
    "JSS1",
    "JSS2",
    "JSS3",
    "SS1",
    "SS2",
    "SS3",
)

EARLY_YEARS_SUBJECTS = (
    "Letter",
    "Number",
    "Science",
    "Social",
    "Drawing",
    "Bible",
    "Practical",
    "Rhyme",
    "Handwriting",
    "Quantitative",
    "Verbal",
    "Health",
    "Language",
    "Diction",
)


def _ensure_arms(ClassArm, level):
    for arm_name in ("A", "B"):
        arm, created = ClassArm.objects.get_or_create(
            class_level=level,
            name=arm_name,
            defaults={"label": f"{level.name}{arm_name}"},
        )
        expected = f"{level.name}{arm_name}"
        if arm.label != expected:
            arm.label = expected
            arm.save(update_fields=["label"])


def _copy_early_years_subjects(Subject, source_level, target_level):
    source_subjects = list(
        Subject.objects.filter(class_level=source_level).order_by("order", "name")
    )
    if not source_subjects:
        for index, name in enumerate(EARLY_YEARS_SUBJECTS, start=1):
            Subject.objects.get_or_create(
                class_level=target_level,
                name=name,
                defaults={
                    "subject_type": "subject",
                    "is_active": True,
                    "order": index,
                    "code": "",
                },
            )
        return

    for subject in source_subjects:
        Subject.objects.get_or_create(
            class_level=target_level,
            name=subject.name,
            defaults={
                "subject_type": subject.subject_type,
                "is_active": subject.is_active,
                "order": subject.order,
                "code": subject.code or "",
                "department_id": subject.department_id,
            },
        )


def forwards(apps, schema_editor):
    ClassLevel = apps.get_model("academics", "ClassLevel")
    ClassArm = apps.get_model("academics", "ClassArm")
    Subject = apps.get_model("academics", "Subject")
    StudentProfile = apps.get_model("accounts", "StudentProfile")

    day_care = ClassLevel.objects.filter(name="Day Care").first()
    pre_nursery = ClassLevel.objects.filter(name="Pre-Nursery").first()

    if day_care and not pre_nursery:
        day_care.name = "Pre-Nursery"
        day_care.save(update_fields=["name"])
        pre_nursery = day_care
        _ensure_arms(ClassArm, pre_nursery)
    elif day_care and pre_nursery and day_care.id != pre_nursery.id:
        pre_has_students = StudentProfile.objects.filter(
            class_arm__class_level=pre_nursery
        ).exists()
        day_care_has_students = StudentProfile.objects.filter(
            class_arm__class_level=day_care
        ).exists()
        if not pre_has_students:
            pre_nursery.delete()
            day_care.name = "Pre-Nursery"
            day_care.save(update_fields=["name"])
            pre_nursery = day_care
            _ensure_arms(ClassArm, pre_nursery)
        elif not day_care_has_students:
            day_care.delete()
        else:
            # Both populated — keep Pre-Nursery; Day Care remains until renamed by hand.
            pass
    elif not pre_nursery:
        pre_nursery = ClassLevel.objects.create(name="Pre-Nursery", order=2)
        _ensure_arms(ClassArm, pre_nursery)

    creche, _ = ClassLevel.objects.get_or_create(name="Creche", defaults={"order": 1})
    _ensure_arms(ClassArm, creche)

    if pre_nursery:
        _ensure_arms(ClassArm, pre_nursery)
        _copy_early_years_subjects(Subject, pre_nursery, creche)

    for order, name in enumerate(LADDER, start=1):
        ClassLevel.objects.filter(name=name).update(order=order)


def backwards(apps, schema_editor):
    ClassLevel = apps.get_model("academics", "ClassLevel")
    ClassArm = apps.get_model("academics", "ClassArm")
    pre_nursery = ClassLevel.objects.filter(name="Pre-Nursery").first()
    if pre_nursery:
        pre_nursery.name = "Day Care"
        pre_nursery.save(update_fields=["name"])
        _ensure_arms(ClassArm, pre_nursery)


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0009_sync_nursery_daycare_subjects"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
