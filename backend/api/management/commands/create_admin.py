from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection
from django.contrib.auth.hashers import make_password

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a new admin user with a known password'

    def handle(self, *args, **options):
        username = 'admin'
        password = 'temporary_password_123'
        
        # Check if user exists
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE username = %s", [username])
            user_exists = cursor.fetchone() is not None

        if user_exists:
            # Update existing user
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET password = %s, is_staff = TRUE, is_superuser = TRUE, role = 'admin' WHERE username = %s",
                    [make_password(password), username]
                )
            self.stdout.write(self.style.SUCCESS(f'Updated admin user "{username}" with new password'))
        else:
            # Create new user
            User.objects.create_user(
                username=username,
                password=password,
                is_staff=True,
                is_superuser=True,
                role='admin'
            )
            self.stdout.write(self.style.SUCCESS(f'Created admin user "{username}"')) 