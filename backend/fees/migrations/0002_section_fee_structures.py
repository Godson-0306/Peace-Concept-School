# Restructure FeeStructure to session + section + student_type (no term/class_level).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0001_initial"),
        ("fees", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="feerecord",
            name="fee_structure",
        ),
        migrations.DeleteModel(
            name="FeeStructure",
        ),
        migrations.CreateModel(
            name="FeeStructure",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "section",
                    models.CharField(
                        choices=[
                            ("day_care", "Day Care"),
                            ("nursery", "Nursery"),
                            ("primary", "Primary"),
                            ("jss", "JSS"),
                            ("ss", "SS"),
                        ],
                        max_length=16,
                    ),
                ),
                (
                    "student_type",
                    models.CharField(
                        choices=[("new", "New Students"), ("returning", "Returning Students")],
                        max_length=16,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fee_structures",
                        to="academics.academicsession",
                    ),
                ),
            ],
            options={
                "ordering": ["session", "section", "student_type"],
                "unique_together": {("session", "section", "student_type")},
            },
        ),
        migrations.AddField(
            model_name="feerecord",
            name="fee_structure",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="records",
                to="fees.feestructure",
            ),
        ),
    ]
