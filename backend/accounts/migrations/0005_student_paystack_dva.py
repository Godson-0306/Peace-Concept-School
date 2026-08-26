from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_admission_enroll_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentprofile",
            name="paystack_customer_code",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="paystack_account_number",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="paystack_account_bank",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="paystack_account_name",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
