from django.db import migrations, models


NEW_SECTIONS = [
    ("creche", "Creche"),
    ("pre_nursery", "Pre-Nursery"),
    ("nursery", "Nursery"),
    ("primary", "Primary"),
    ("jss", "JSS"),
    ("ss", "SS"),
]


def forwards(apps, schema_editor):
    FeeStructure = apps.get_model("fees", "FeeStructure")
    for row in list(FeeStructure.objects.filter(section="day_care")):
        for section in ("pre_nursery", "creche"):
            FeeStructure.objects.update_or_create(
                session_id=row.session_id,
                section=section,
                student_type=row.student_type,
                defaults={
                    "amount": row.amount,
                    "description": row.description,
                    "is_active": row.is_active,
                },
            )
        row.delete()


def backwards(apps, schema_editor):
    FeeStructure = apps.get_model("fees", "FeeStructure")
    for row in list(FeeStructure.objects.filter(section="pre_nursery")):
        FeeStructure.objects.update_or_create(
            session_id=row.session_id,
            section="day_care",
            student_type=row.student_type,
            defaults={
                "amount": row.amount,
                "description": row.description,
                "is_active": row.is_active,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("fees", "0003_paystack_payment"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="feestructure",
            name="section",
            field=models.CharField(choices=NEW_SECTIONS, max_length=16),
        ),
    ]
