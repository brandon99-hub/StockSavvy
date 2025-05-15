from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        try:
            from .scheduler import start_scheduler
            start_scheduler()
            logger.info("Forecast scheduler started successfully")
        except Exception as e:
            logger.error(f"Failed to start forecast scheduler: {str(e)}") 