import csv
from django.core.management.base import BaseCommand
from api.models import Product

class Command(BaseCommand):
    help = 'Export all products to products_export.csv'

    def handle(self, *args, **kwargs):
        with open('products_export.csv', 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['ID', 'Name', 'SKU', 'Category', 'Description', 'Quantity', 'Buying Price', 'Price', 'Created At'])
            for p in Product.objects.all():
                writer.writerow([
                    p.id, p.name, p.sku,
                    p.category.name if p.category else '',
                    p.description, getattr(p, 'quantity', ''), getattr(p, 'buy_price', ''), getattr(p, 'sell_price', ''), p.created_at
                ])
        self.stdout.write(self.style.SUCCESS('Exported products to products_export.csv')) 