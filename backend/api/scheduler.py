from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django.conf import settings
from .tasks import generate_forecasts
import logging

logger = logging.getLogger(__name__)

def start_scheduler():
    """Start the background scheduler for forecast generation"""
    scheduler = BackgroundScheduler()
    
    # Add the forecast generation job to run at midnight every day
    scheduler.add_job(
        generate_forecasts,
        trigger=CronTrigger(hour=0, minute=0),  # Run at midnight
        id='generate_forecasts',
        name='Generate daily product forecasts',
        replace_existing=True
    )
    
    try:
        logger.info("Starting forecast scheduler...")
        scheduler.start()
    except Exception as e:
        logger.error(f"Error starting scheduler: {str(e)}")
        raise 