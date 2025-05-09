from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Fixes the inconsistent migration history by inserting fake api migrations'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # First, let's check what migrations exist in the database
            cursor.execute("SELECT id, app, name, applied FROM django_migrations ORDER BY applied")
            migrations = cursor.fetchall()

            if not migrations:
                self.stdout.write(self.style.ERROR("No migrations found in the database"))
                return

            self.stdout.write(self.style.SUCCESS("Current migrations in the database:"))
            for migration in migrations:
                self.stdout.write(f"ID: {migration[0]}, App: {migration[1]}, Name: {migration[2]}, Applied: {migration[3]}")

            # Check if the admin.0001_initial migration exists
            cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='admin' AND name='0001_initial'")
            admin_migration = cursor.fetchone()

            # Check if the api.0001_initial migration exists
            cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='api' AND name='0001_initial'")
            api_migration = cursor.fetchone()

            # Check if the api.0002_add_batch_tables migration exists
            cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='api' AND name='0002_add_batch_tables'")
            api_batch_migration = cursor.fetchone()

            if admin_migration:
                admin_id, admin_app, admin_name, admin_applied = admin_migration

                # Handle api.0001_initial migration
                if not api_migration:
                    # Create a timestamp 1 second before the admin migration
                    api_applied = admin_applied - datetime.timedelta(seconds=1)

                    self.stdout.write(self.style.WARNING(f"Admin migration found (applied: {admin_applied}), but api migration not found. Creating fake api migration with timestamp {api_applied}"))

                    # Insert a fake api.0001_initial migration with a timestamp before admin.0001_initial
                    cursor.execute(
                        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
                        ['api', '0001_initial', api_applied]
                    )

                    self.stdout.write(self.style.SUCCESS("Successfully inserted fake api.0001_initial migration"))
                elif admin_applied < api_migration[3]:
                    # If admin migration was applied before api migration, update the api migration timestamp
                    self.stdout.write(self.style.WARNING(f"Found inconsistency: admin.0001_initial (applied: {admin_applied}) is before api.0001_initial (applied: {api_migration[3]})"))

                    # Create a timestamp 1 second before the admin migration
                    new_api_applied = admin_applied - datetime.timedelta(seconds=1)

                    # Update the api migration timestamp
                    cursor.execute(
                        "UPDATE django_migrations SET applied = %s WHERE id = %s",
                        [new_api_applied, api_migration[0]]
                    )

                    self.stdout.write(self.style.SUCCESS(f"Successfully updated api.0001_initial timestamp to {new_api_applied}"))

                # Handle api.0002_add_batch_tables migration
                if not api_batch_migration:
                    # Check if api.0001_initial exists now (either it existed before or we just created it)
                    cursor.execute("SELECT id, app, name, applied FROM django_migrations WHERE app='api' AND name='0001_initial'")
                    api_migration = cursor.fetchone()

                    if api_migration:
                        # Create a timestamp 1 second after the api.0001_initial migration
                        api_batch_applied = api_migration[3] + datetime.timedelta(seconds=1)

                        self.stdout.write(self.style.WARNING(f"api.0001_initial migration found (applied: {api_migration[3]}), but api.0002_add_batch_tables migration not found. Creating fake api.0002_add_batch_tables migration with timestamp {api_batch_applied}"))

                        # Insert a fake api.0002_add_batch_tables migration
                        cursor.execute(
                            "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
                            ['api', '0002_add_batch_tables', api_batch_applied]
                        )

                        self.stdout.write(self.style.SUCCESS("Successfully inserted fake api.0002_add_batch_tables migration"))
                    else:
                        self.stdout.write(self.style.ERROR("Could not find or create api.0001_initial migration"))
            else:
                self.stdout.write(self.style.ERROR("Could not find admin.0001_initial migration"))
