from django.core.management.base import BaseCommand
from api.tasks import setup_scheduled_tasks
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Sets up all scheduled tasks for the application'

    def handle(self, *args, **options):
        try:
            setup_scheduled_tasks()
            self.stdout.write(self.style.SUCCESS('Successfully set up all scheduled tasks'))
        except Exception as e:
            logger.error(f"Error setting up tasks: {str(e)}")
            self.stdout.write(self.style.ERROR(f'Error setting up tasks: {str(e)}')) 