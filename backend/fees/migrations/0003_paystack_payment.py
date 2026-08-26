from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fees", "0002_section_fee_structures"),
    ]

    operations = [
        migrations.AlterField(
            model_name="feepaymententry",
            name="method",
            field=models.CharField(
                choices=[
                    ("cash", "Cash"),
                    ("transfer", "Bank Transfer"),
                    ("pos", "POS"),
                    ("paystack", "Paystack"),
                    ("other", "Other"),
                ],
                default="cash",
                max_length=16,
            ),
        ),
        migrations.AddConstraint(
            model_name="feepaymententry",
            constraint=models.UniqueConstraint(
                condition=~models.Q(reference=""),
                fields=("reference",),
                name="uniq_fee_payment_reference",
            ),
        ),
    ]
