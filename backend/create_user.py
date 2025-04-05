import os
import django
import bcrypt
from django.db import connection

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Create admin user directly with SQL
username = 'admin'
password = 'admin123'

try:
    # Hash the password with bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode(), salt).decode()
    
    # Check if user exists
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM users WHERE username = %s", [username])
        user = cursor.fetchone()
        
        if user:
            # Update existing user
            cursor.execute("""
                UPDATE users 
                SET password = %s, is_staff = TRUE, is_superuser = TRUE 
                WHERE username = %s
            """, [hashed_password, username])
            print(f"User '{username}' updated with new password")
        else:
            # Create new user
            cursor.execute("""
                INSERT INTO users 
                (username, password, role, is_active, is_staff, is_superuser) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """, [username, hashed_password, 'admin', True, True, True])
            print(f"User '{username}' created successfully")
    
    print('Admin user setup complete. You can now log in with:')
    print(f'Username: {username}')
    print(f'Password: {password}')
    
except Exception as e:
    print(f'Error creating user: {e}') 