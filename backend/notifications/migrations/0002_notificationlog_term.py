from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0009_sync_nursery_daycare_subjects"),
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificationlog",
            name="term",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="notification_logs",
                to="academics.term",
            ),
        ),
        migrations.AddIndex(
            model_name="notificationlog",
            index=models.Index(
                fields=["related_student_id", "term", "channel", "status"],
                name="notificatio_related_idx",
            ),
        ),
    ]
