from django.db import migrations, models

from academics.defaults import CLASS_LADDER, CLASS_LEVEL_FEE_SECTION


def _ensure_arms(ClassArm, level):
    for arm_name in ("A", "B"):
        expected = f"{level.name}{arm_name}"
        arm, _created = ClassArm.objects.get_or_create(
            class_level=level,
            name=arm_name,
            defaults={"label": expected},
        )
        if arm.label != expected:
            arm.label = expected
            arm.save(update_fields=["label"])


def forwards(apps, schema_editor):
    ClassLevel = apps.get_model("academics", "ClassLevel")
    ClassArm = apps.get_model("academics", "ClassArm")
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

    creche, _ = ClassLevel.objects.get_or_create(name="Creche", defaults={"order": 1})
    _ensure_arms(ClassArm, creche)
    if pre_nursery:
        _ensure_arms(ClassArm, pre_nursery)

    for order, name in enumerate(CLASS_LADDER, start=1):
        ClassLevel.objects.filter(name=name).update(order=order)

    for level in ClassLevel.objects.all():
        section = CLASS_LEVEL_FEE_SECTION.get(level.name, "")
        if section and level.fee_section != section:
            level.fee_section = section
            level.save(update_fields=["fee_section"])
        _ensure_arms(ClassArm, level)


def backwards(apps, schema_editor):
    ClassLevel = apps.get_model("academics", "ClassLevel")
    ClassLevel.objects.all().update(fee_section="")


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0010_creche_and_pre_nursery"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="classlevel",
            name="fee_section",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Bursary band: creche, pre_nursery, nursery, primary, jss, ss.",
                max_length=16,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
