from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def start_scheduler():
    """Start the background scheduler"""
    scheduler = BackgroundScheduler()
    
    try:
        logger.info("Starting scheduler...")
        scheduler.start()
    except Exception as e:
        logger.error(f"Error starting scheduler: {str(e)}")
        raise 