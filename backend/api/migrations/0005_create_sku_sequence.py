from django.db import migrations, models, connection

def create_sku_sequence(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sku_sequence (
                next_sku INTEGER NOT NULL
            );
        ''')
        cursor.execute('SELECT COUNT(*) FROM sku_sequence;')
        if cursor.fetchone()[0] == 0:
            cursor.execute('INSERT INTO sku_sequence (next_sku) VALUES (140);')

def drop_sku_sequence(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute('DROP TABLE IF EXISTS sku_sequence;')

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0004_alter_activity_user'),
    ]
    operations = [
        migrations.RunPython(create_sku_sequence, reverse_code=drop_sku_sequence),
    ] 