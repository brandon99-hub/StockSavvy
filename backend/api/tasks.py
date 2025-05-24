from django_q.tasks import schedule, Schedule
from django_q.models import Schedule as ScheduleModel
from django.core.management import call_command
from django.utils import timezone
import logging
import os
from google.cloud import storage
from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)

def setup_scheduled_tasks():
    """Set up all scheduled tasks for the application"""
    try:
        # Clear existing schedules
        ScheduleModel.objects.all().delete()

        # Schedule forecast generation (daily at 1 AM)
        schedule(
            'api.tasks.generate_forecasts',
            schedule_type=Schedule.DAILY,
            next_run=timezone.now().replace(hour=1, minute=0, second=0, microsecond=0),
            name='Generate Forecasts'
        )

        # Schedule low stock check (every 6 hours)
        schedule(
            'api.tasks.check_low_stock',
            schedule_type=Schedule.HOURLY,
            repeats=4,  # Every 6 hours (24/6 = 4 times per day)
            name='Check Low Stock'
        )

        # Schedule data backup (daily at 2 AM)
        schedule(
            'api.tasks.backup_data',
            schedule_type=Schedule.DAILY,
            next_run=timezone.now().replace(hour=2, minute=0, second=0, microsecond=0),
            name='Backup Data'
        )

        logger.info("Successfully set up scheduled tasks")
    except Exception as e:
        logger.error(f"Error setting up scheduled tasks: {str(e)}")
        raise

def generate_forecasts():
    """Generate forecasts for all products"""
    try:
        call_command('generate_forecasts')
        logger.info("Successfully generated forecasts")
    except Exception as e:
        logger.error(f"Error generating forecasts: {str(e)}")
        raise

def check_low_stock():
    """Check for low stock items and send notifications"""
    from .models import Product, RestockRule
    from django.core.mail import send_mail
    from django.conf import settings

    try:
        # Get all products that are low on stock
        low_stock_products = Product.objects.filter(
            quantity__lte=models.F('min_stock_level')
        )

        for product in low_stock_products:
            try:
                # Get the restock rule for this product
                restock_rule = RestockRule.objects.get(product=product)
                
                # Check if supplier contact info exists
                if not restock_rule.supplier_email and not restock_rule.supplier_phone:
                    continue

                # Prepare notification data
                subject = f'Low Stock Alert: {product.name}'
                message = f'''
                Dear {restock_rule.supplier_name},

                This is a notification that the following product is running low on stock:

                Product: {product.name}
                Current Stock: {product.quantity}
                Minimum Stock Level: {product.min_stock_level}
                Recommended Reorder Quantity: {restock_rule.reorder_quantity}

                Please arrange for restocking at your earliest convenience.

                Best regards,
                StockSavvy System
                '''

                # Send email if supplier email exists
                if restock_rule.supplier_email:
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        [restock_rule.supplier_email],
                        fail_silently=False,
                    )

                # TODO: Add SMS notification when SMS service is integrated

            except RestockRule.DoesNotExist:
                continue
            except Exception as e:
                logger.error(f"Error processing low stock notification for product {product.id}: {str(e)}")
                continue

        logger.info("Successfully checked low stock items")
    except Exception as e:
        logger.error(f"Error checking low stock: {str(e)}")
        raise

def backup_data():
    """Backup sales history and product data to Google Cloud Storage"""
    try:
        # Initialize Google Cloud Storage client
        storage_client = storage.Client()
        bucket_name = os.getenv('GCS_BUCKET_NAME', 'your-bucket-name')
        bucket = storage_client.bucket(bucket_name)

        # Example: Backup sales history
        sales_data = 'path/to/sales_data.json'  # Replace with actual data export logic
        blob = bucket.blob('backups/sales_data.json')
        blob.upload_from_filename(sales_data)

        # Example: Backup product data
        product_data = 'path/to/product_data.json'  # Replace with actual data export logic
        blob = bucket.blob('backups/product_data.json')
        blob.upload_from_filename(product_data)

        logger.info("Successfully backed up data to Google Cloud Storage")
    except Exception as e:
        logger.error(f"Error backing up data: {str(e)}")
        raise 