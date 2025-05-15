from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
import bcrypt
from django.db import connection
from django.contrib.auth.hashers import check_password, make_password  # Add this
from django.core.exceptions import ValidationError


class UserManager(BaseUserManager):
    def get_by_natural_key(self, username):
        # Direct ORM query without recursion
        return self.get(**{self.model.USERNAME_FIELD: username})

    # Remove the custom get() method completely
    # Let BaseUserManager handle it

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
        # Use Django's password hashing
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        # Use Django's password verification
        return check_password(raw_password, self.password)

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
        managed = True

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
    category = models.ForeignKey(Category, models.DO_NOTHING, blank=True, null=True, db_constraint=False)
    quantity = models.IntegerField(default=0)  # Total available quantity
    min_stock_level = models.IntegerField()
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'products'

    def clean(self):
        if self.quantity < 0:
            raise ValidationError('Quantity cannot be negative')
        if self.min_stock_level < 0:
            raise ValidationError('Minimum stock level cannot be negative')
        if self.buy_price <= 0:
            raise ValidationError('Buy price must be positive')
        if self.sell_price <= 0:
            raise ValidationError('Sell price must be positive')
        if self.sell_price < self.buy_price:
            raise ValidationError('Sell price cannot be less than buy price')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

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
    sale = models.ForeignKey('Sale', models.DO_NOTHING, db_constraint=False)
    product = models.ForeignKey(Product, models.DO_NOTHING, db_constraint=False)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'sale_items'

class Sale(models.Model):
    sale_date = models.DateTimeField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    user = models.ForeignKey(User, models.DO_NOTHING, blank=True, null=True, db_constraint=False)
    created_at = models.DateTimeField()
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    original_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'sales'

class Activity(models.Model):
    type = models.TextField()
    description = models.TextField()
    product = models.ForeignKey(Product, models.SET_NULL, blank=True, null=True)
    user = models.ForeignKey(User, models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField()
    status = models.TextField()

    class Meta:
        managed = True
        db_table = 'activities'

class ProductForecast(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='forecasts')
    forecast_date = models.DateField()
    forecast_quantity = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    model_info = models.CharField(max_length=50)  # e.g., 'Prophet', 'MovingAverage'

    class Meta:
        unique_together = ('product', 'forecast_date')
        ordering = ['forecast_date']

    def __str__(self):
        return f"{self.product.name} forecast for {self.forecast_date}" 
