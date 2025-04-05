from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
import bcrypt
from django.db import connection

class UserManager(BaseUserManager):
    def get_by_natural_key(self, username):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, username, password, role, is_active, is_staff, is_superuser, name FROM users WHERE username = %s",
                [username]
            )
            row = cursor.fetchone()
            if row is None:
                raise self.model.DoesNotExist(f"User with username {username} does not exist")
            user = self.model(
                id=row[0],
                username=row[1],
                password=row[2],
                role=row[3],
                is_active=row[4],
                is_staff=row[5],
                is_superuser=row[6],
                name=row[7]
            )
            return user
    
    def get(self, **kwargs):
        if 'username' in kwargs:
            return self.get_by_natural_key(kwargs['username'])
        raise ValueError("This UserManager only supports get by username")
        
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set')
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra_fields)

class User(AbstractBaseUser):
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)
    role = models.CharField(max_length=20, default='user')
    name = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    last_login = None  # Override the last_login field from AbstractBaseUser
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []
    
    objects = UserManager()
    
    def set_password(self, raw_password):
        salt = bcrypt.gensalt()
        self.password = bcrypt.hashpw(raw_password.encode(), salt).decode()
        
    def check_password(self, raw_password):
        return bcrypt.checkpw(raw_password.encode(), self.password.encode())
    
    def has_perm(self, perm, obj=None):
        return self.is_superuser
    
    def has_module_perms(self, app_label):
        return self.is_superuser
        
    @property
    def is_anonymous(self):
        return False
        
    @property
    def is_authenticated(self):
        return True

    class Meta:
        db_table = 'users'
        managed = False

class Category(models.Model):
    name = models.TextField(unique=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'categories'

class Product(models.Model):
    name = models.TextField()
    sku = models.TextField(unique=True)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, models.DO_NOTHING, blank=True, null=True)
    quantity = models.IntegerField()
    min_stock_level = models.IntegerField()
    buy_price = models.DecimalField(max_digits=65535, decimal_places=65535)
    sell_price = models.DecimalField(max_digits=65535, decimal_places=65535)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'products'

class RestockRule(models.Model):
    product = models.ForeignKey(Product, models.DO_NOTHING)
    reorder_quantity = models.IntegerField()
    is_auto_reorder_enabled = models.BooleanField()
    supplier_id = models.IntegerField(blank=True, null=True)
    supplier_name = models.TextField()
    supplier_email = models.TextField(blank=True, null=True)
    supplier_phone = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'restock_rules'

class SaleItem(models.Model):
    sale = models.ForeignKey('Sale', models.DO_NOTHING)
    product = models.ForeignKey(Product, models.DO_NOTHING)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=65535, decimal_places=65535)
    total_price = models.DecimalField(max_digits=65535, decimal_places=65535)

    class Meta:
        managed = False
        db_table = 'sale_items'

class Sale(models.Model):
    sale_date = models.DateTimeField()
    total_amount = models.DecimalField(max_digits=65535, decimal_places=65535)
    user = models.ForeignKey(User, models.DO_NOTHING, blank=True, null=True)
    created_at = models.DateTimeField()
    discount = models.DecimalField(max_digits=65535, decimal_places=65535)
    discount_percentage = models.DecimalField(max_digits=65535, decimal_places=65535)
    original_amount = models.DecimalField(max_digits=65535, decimal_places=65535)

    class Meta:
        managed = False
        db_table = 'sales'

class Activity(models.Model):
    type = models.TextField()
    description = models.TextField()
    product = models.ForeignKey(Product, models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey(User, models.DO_NOTHING)
    created_at = models.DateTimeField()
    status = models.TextField()

    class Meta:
        managed = False
        db_table = 'activities' 