from django.db import migrations, connection

def alter_sku_sequence(apps, schema_editor):
    with connection.cursor() as cursor:
        # Change next_sku to TEXT and add pattern column if not exists
        cursor.execute('''
            ALTER TABLE sku_sequence
            ALTER COLUMN next_sku TYPE TEXT;
        ''')
        # Add pattern column if it doesn't exist
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sku_sequence' AND column_name='pattern') THEN
                    ALTER TABLE sku_sequence ADD COLUMN pattern TEXT;
                END IF;
            END$$;
        """)

def revert_alter_sku_sequence(apps, schema_editor):
    with connection.cursor() as cursor:
        # Remove pattern column (if exists) and revert next_sku to INTEGER (if possible)
        cursor.execute('''
            ALTER TABLE sku_sequence DROP COLUMN IF EXISTS pattern;
        ''')
        cursor.execute('''
            ALTER TABLE sku_sequence ALTER COLUMN next_sku TYPE INTEGER USING next_sku::integer;
        ''')

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0005_create_sku_sequence'),
    ]
    operations = [
        migrations.RunPython(alter_sku_sequence, reverse_code=revert_alter_sku_sequence),
    ] 