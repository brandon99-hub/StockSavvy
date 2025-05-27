from django.core.management.base import BaseCommand
from api.models import ProductForecast
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clear all existing product forecasts'

    def handle(self, *args, **options):
        try:
            # Get count before deletion
            count = ProductForecast.objects.count()
            
            # Delete all forecasts
            ProductForecast.objects.all().delete()
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully deleted {count} forecasts')
            )
            
        except Exception as e:
            logger.error(f"Error clearing forecasts: {str(e)}")
            self.stdout.write(
                self.style.ERROR(f'Error clearing forecasts: {str(e)}')
            ) 