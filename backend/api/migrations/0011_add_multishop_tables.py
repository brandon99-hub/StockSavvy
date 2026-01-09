# Generated manually for multi-shop tables

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_backfill_initial_batches'),
    ]

    operations = [
        # Tables already created manually via SQL
        # This migration just tells Django they exist
        migrations.RunSQL(
            sql="SELECT 1;",  # No-op SQL
            reverse_sql="SELECT 1;"
        ),
    ]
