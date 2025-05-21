from django.core.management.base import BaseCommand
from django.db import connection
from django.db.models import Count
from api.models import Product, SaleItem

class Command(BaseCommand):
    help = 'Check and clean up orphaned sale items for products with no sales'

    def add_arguments(self, parser):
        parser.add_argument(
            '--cleanup',
            action='store_true',
            help='Actually delete the orphaned sale items',
        )
        parser.add_argument(
            '--product-id',
            type=int,
            help='Check/cleanup specific product ID',
        )

    def handle(self, *args, **options):
        cleanup = options['cleanup']
        product_id = options['product_id']

        # Build the base query
        with connection.cursor() as cursor:
            if product_id:
                # Check specific product
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        COUNT(si.id) as sale_items_count
                    FROM products p
                    LEFT JOIN sale_items si ON p.id = si.product_id
                    WHERE p.id = %s
                    GROUP BY p.id, p.name
                """, [product_id])
            else:
                # Check all products
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        COUNT(si.id) as sale_items_count
                    FROM products p
                    LEFT JOIN sale_items si ON p.id = si.product_id
                    GROUP BY p.id, p.name
                    HAVING COUNT(si.id) > 0
                """)

            results = cursor.fetchall()

            if not results:
                self.stdout.write(self.style.SUCCESS('No orphaned sale items found!'))
                return

            self.stdout.write(self.style.WARNING('\nFound products with sale items:'))
            for product_id, product_name, sale_items_count in results:
                self.stdout.write(f'Product ID: {product_id}, Name: {product_name}, Sale Items: {sale_items_count}')

            if cleanup:
                try:
                    with connection.cursor() as cursor:
                        if product_id:
                            # First delete batch_sale_items for this product's sale items
                            cursor.execute("""
                                DELETE FROM batch_sale_items 
                                WHERE sale_item_id IN (
                                    SELECT id FROM sale_items WHERE product_id = %s
                                )
                            """, [product_id])
                            
                            # Then delete sale_items
                            cursor.execute("DELETE FROM sale_items WHERE product_id = %s", [product_id])
                            self.stdout.write(self.style.SUCCESS(f'\nCleaned up sale items for product {product_id}'))
                        else:
                            # Delete all batch_sale_items first
                            cursor.execute("DELETE FROM batch_sale_items")
                            # Then delete all sale_items
                            cursor.execute("DELETE FROM sale_items")
                            self.stdout.write(self.style.SUCCESS('\nCleaned up all sale items'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'\nError during cleanup: {str(e)}'))
            else:
                self.stdout.write(self.style.WARNING('\nTo clean up these sale items, run the command with --cleanup flag')) 