from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Fixes the inconsistent migration history by updating the django_migrations table'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if the admin.0001_initial migration exists
            cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='admin' AND name='0001_initial'")
            admin_migration = cursor.fetchone()
            
            # Check if the api.0001_initial migration exists
            cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='api' AND name='0001_initial'")
            api_migration = cursor.fetchone()
            
            if admin_migration and api_migration:
                admin_id, admin_app, admin_name, admin_applied = admin_migration
                api_id, api_app, api_name, api_applied = api_migration
                
                # If admin migration was applied before api migration, swap their applied timestamps
                if admin_applied < api_applied:
                    self.stdout.write(self.style.WARNING(f"Found inconsistency: admin.0001_initial (applied: {admin_applied}) is before api.0001_initial (applied: {api_applied})"))
                    
                    # Swap the applied timestamps
                    cursor.execute(
                        "UPDATE django_migrations SET applied = %s WHERE id = %s",
                        [api_applied, admin_id]
                    )
                    cursor.execute(
                        "UPDATE django_migrations SET applied = %s WHERE id = %s",
                        [admin_applied, api_id]
                    )
                    
                    self.stdout.write(self.style.SUCCESS("Successfully fixed migration history by swapping applied timestamps"))
                else:
                    self.stdout.write(self.style.SUCCESS("No inconsistency found in migration history"))
            else:
                self.stdout.write(self.style.ERROR("Could not find both admin.0001_initial and api.0001_initial migrations"))