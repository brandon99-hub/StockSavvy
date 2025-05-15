from django.db import migrations, connection

def create_product_forecasts(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS product_forecasts (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                forecast_date DATE NOT NULL,
                forecast_quantity INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                model_info TEXT,
                CONSTRAINT fk_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
            );
        ''')

def drop_product_forecasts(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute('DROP TABLE IF EXISTS product_forecasts;')

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0006_alter_sku_sequence_add_pattern'),
    ]
    operations = [
        migrations.RunPython(create_product_forecasts, reverse_code=drop_product_forecasts),
    ] 