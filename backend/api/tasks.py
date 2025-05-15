from django.core.management import call_command
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def generate_daily_forecasts():
    """Generate forecasts for all products daily"""
    try:
        logger.info("Starting daily forecast generation...")
        call_command('generate_forecasts')
        logger.info("Daily forecast generation completed successfully")
    except Exception as e:
        logger.error(f"Error generating forecasts: {str(e)}")
        raise 