import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'your-secret-key-here')

#DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'api',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_q',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be as high as possible
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, '../frontend/client/dist/public')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',  # Default hasher
    # ... other hashers
]

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres.tmfdwxfdtwjbulrwqmus:Exlifes_6969@aws-0-eu-west-2.pooler.supabase.com:6543/postgres')

# Parse database URL
db_config = dj_database_url.parse(DATABASE_URL)
# Add additional options
db_config.update({
    'ENGINE': 'django.db.backends.postgresql',
    'OPTIONS': {
        'client_encoding': 'UTF8',
        'sslmode': 'require'
    },
    'CONN_MAX_AGE': 600,
})

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'postgres',
        'USER': 'postgres.tmfdwxfdtwjbulrwqmus',
        'PASSWORD': 'Exlifes_6969',
        'HOST': 'aws-0-eu-west-2.pooler.supabase.com',
        'PORT': '6543',
        'CONN_MAX_AGE': 60,  # Force reconnection every 60 seconds
        'OPTIONS': {
            'client_encoding': 'UTF8',
            'sslmode': 'require'
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://stocksavvy-ahtd.onrender.com"
]
CSRF_TRUSTED_ORIGINS = ["https://stocksavvy-ahtd.onrender.com"]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# URL Settings
APPEND_SLASH = True
# settings.py

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, '../frontend/client/dist/public'),  # Remove /assets from path
]

TEMPLATES[0]['DIRS'] = [
    os.path.join(BASE_DIR, '../frontend/client/dist/public'),
]

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEBUG = os.getenv("DEBUG", "False") == "True"  # Use environment variable

SESSION_COOKIE_SECURE = not DEBUG  # True in production
CSRF_COOKIE_SECURE = not DEBUG
# Session Settings
SESSION_COOKIE_SAMESITE = 'Lax'
#SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
#CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS

# Ensure Whitenoise is properly configured
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend'
]
# Custom User Model
AUTH_USER_MODEL = 'api.User'

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # Or your SMTP server
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = ''  # Your email address
EMAIL_HOST_PASSWORD = ''  # Your email password or app-specific password
DEFAULT_FROM_EMAIL = ''  # Your email address

# Django Q Configuration
Q_CLUSTER = {
    'name': 'StockSavvy',
    'workers': 4,
    'recycle': 500,
    'timeout': 90,
    'retry': 120,  # Added retry setting that's larger than timeout
    'compress': True,
    'save_limit': 250,
    'queue_limit': 500,
    'cpu_affinity': 1,
    'label': 'Django Q',
    'redis': {
        'host': '127.0.0.1',
        'port': 6379,
        'db': 0,
    }
}
