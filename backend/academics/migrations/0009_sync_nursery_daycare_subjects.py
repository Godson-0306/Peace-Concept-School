from django.db import migrations


def sync_nursery_subjects(apps, schema_editor):
    ClassLevel = apps.get_model("academics", "ClassLevel")
    Subject = apps.get_model("academics", "Subject")
    levels = ("Day Care", "Nursery 1", "Nursery 2")
    subjects = (
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
    wanted = set(subjects)
    for level in ClassLevel.objects.filter(name__in=levels):
        keep_ids = []
        for index, name in enumerate(subjects, start=1):
            subject, _ = Subject.objects.get_or_create(
                class_level=level,
                name=name,
                defaults={
                    "subject_type": "subject",
                    "is_active": True,
                    "order": index,
                    "code": "",
                },
            )
            updates = []
            if subject.order != index:
                subject.order = index
                updates.append("order")
            if not subject.is_active:
                subject.is_active = True
                updates.append("is_active")
            if subject.subject_type != "subject":
                subject.subject_type = "subject"
                updates.append("subject_type")
            if updates:
                subject.save(update_fields=updates)
            keep_ids.append(subject.id)
        Subject.objects.filter(class_level=level).exclude(id__in=keep_ids).exclude(
            name__in=wanted
        ).delete()

    Subject.objects.filter(name__istartswith="MaxSub").delete()
    Subject.objects.filter(name__istartswith="Band Sync").delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0008_subject_order_and_nursery_defaults"),
    ]

    operations = [
        migrations.RunPython(sync_nursery_subjects, noop_reverse),
    ]
