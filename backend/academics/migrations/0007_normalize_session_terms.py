from django.db import migrations


def normalize_session_terms(apps, schema_editor):
    AcademicSession = apps.get_model("academics", "AcademicSession")
    Term = apps.get_model("academics", "Term")
    labels = {1: "First Term", 2: "Second Term", 3: "Third Term"}
    for session in AcademicSession.objects.all():
        for number, label in labels.items():
            term, created = Term.objects.get_or_create(
                session=session,
                number=number,
                defaults={"name": label},
            )
            if not created and term.name != label:
                term.name = label
                term.save(update_fields=["name"])
        # Remove any non-standard term numbers if they somehow exist.
        Term.objects.filter(session=session).exclude(number__in=[1, 2, 3]).delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0006_term_first_second_third_only"),
    ]

    operations = [
        migrations.RunPython(normalize_session_terms, noop_reverse),
    ]
