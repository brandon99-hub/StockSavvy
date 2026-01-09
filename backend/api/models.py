from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
import bcrypt
from django.db import connection
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError


class UserManager(BaseUserManager):
    def get_by_natural_key(self, username):
        # Direct ORM query without recursion
        return self.get(**{self.model.USERNAME_FIELD: username})

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


# ============ NEW: Shop Model ============
class Shop(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    location = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    manager = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_shops')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shops'
        managed = True

    def __str__(self):
        return f"{self.name} ({self.code})"


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
    
    # NEW: Multi-shop fields
    shop = models.ForeignKey(Shop, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')
    can_access_all_shops = models.BooleanField(default=False)
    email = models.EmailField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        managed = True
        db_table = 'categories'


class Product(models.Model):
    name = models.TextField()
    sku = models.TextField(unique=True)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, models.DO_NOTHING, blank=True, null=True, db_constraint=False)
    min_stock_level = models.IntegerField()
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    
    # NEW: BC Integration fields
    barcode = models.CharField(max_length=100, blank=True, null=True)
    bc_item_no = models.CharField(max_length=50, unique=True, blank=True, null=True)
    last_bc_sync = models.DateTimeField(blank=True, null=True)
    uom_data = models.JSONField(blank=True, null=True)
    sync_hash = models.CharField(max_length=64, blank=True, null=True)
    is_manual_override = models.BooleanField(default=False)
    
    # NEW: UOM / Packaging fields
    uom_type = models.CharField(max_length=20, default='PCS', choices=[('PCS', 'Pieces'), ('CARTON', 'Carton')])
    pieces_per_carton = models.IntegerField(default=1)
    carton_buy_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    carton_sell_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # NEW: Master quantity tracking
    master_quantity = models.IntegerField(default=0)

    class Meta:
        managed = True
        db_table = 'products'
    
    def get_shop_total_quantity(self):
        """Calculate sum of quantities across all shops"""
        from django.db.models import Sum
        result = self.shop_stock.aggregate(total=Sum('quantity'))
        return result['total'] or 0
    
    def has_quantity_mismatch(self):
        """Check if master != sum of shop quantities"""
        return self.master_quantity != self.get_shop_total_quantity()
    
    def quantity_difference(self):
        """Return difference (master - shop_total)"""
        return self.master_quantity - self.get_shop_total_quantity()
    
    def update_master_quantity(self):
        """Recalculate master_quantity from shop totals"""
        self.master_quantity = self.get_shop_total_quantity()
        self.save(update_fields=['master_quantity'])

    def clean(self):
        if self.min_stock_level < 0:
            raise ValidationError('Minimum stock level cannot be negative')
        if self.buy_price < 0:
            raise ValidationError('Buy price cannot be negative')
        if self.sell_price < 0:
            raise ValidationError('Sell price cannot be negative')
        if self.pieces_per_carton < 1:
            raise ValidationError('Pieces per carton must be at least 1')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# ============ NEW: Shop Inventory Model ============
class ShopInventory(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='inventory')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='shop_stock')
    quantity = models.IntegerField(default=0)
    min_stock_level = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shop_inventory'
        managed = True
        unique_together = ('shop', 'product')

    def __str__(self):
        return f"{self.shop.name} - {self.product.name}: {self.quantity}"


# ============ NEW: Customer Model ============
class Customer(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='customers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50)
    id_number = models.CharField(max_length=50, blank=True, null=True)
    credit_limit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, default='active')  # active, suspended, blacklisted
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        managed = True
        unique_together = ('shop', 'phone')

    def __str__(self):
        return f"{self.name} ({self.phone})"


# ============ NEW: Payment Method Model ============
class PaymentMethod(models.Model):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_methods'
        managed = True

    def __str__(self):
        return self.name


class RestockRule(models.Model):
    product = models.ForeignKey(Product, models.DO_NOTHING, blank=True, null=True)
    reorder_quantity = models.IntegerField()
    is_auto_reorder_enabled = models.BooleanField()
    supplier_id = models.IntegerField(blank=True, null=True)
    supplier_name = models.TextField()
    supplier_email = models.TextField(blank=True, null=True)
    supplier_phone = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = True
        db_table = 'restock_rules'


class SaleItem(models.Model):
    sale = models.ForeignKey('Sale', models.DO_NOTHING, db_constraint=False)
    product = models.ForeignKey(Product, models.DO_NOTHING, db_constraint=False)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = True
        db_table = 'sale_items'


class Sale(models.Model):
    sale_date = models.DateTimeField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    user = models.ForeignKey(User, models.DO_NOTHING, blank=True, null=True, db_constraint=False)
    created_at = models.DateTimeField()
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    original_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # NEW: Multi-shop and credit fields
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='sales', null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    payment_status = models.CharField(max_length=20, default='paid')  # paid, credit, partial
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    amount_credit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        managed = True
        db_table = 'sales'


# ============ NEW: Sale Payment Model ============
class SalePayment(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sale_payments'
        managed = True

    def __str__(self):
        return f"{self.sale.id} - {self.payment_method.name}: {self.amount}"


# ============ NEW: Credit Transaction Model ============
class CreditTransaction(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='credit_history')
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='credit_transactions', null=True, blank=True)
    sale = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True)
    transaction_type = models.CharField(max_length=20)  # 'sale', 'payment'
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='created_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'credit_transactions'
        managed = True
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.name} - {self.transaction_type}: {self.amount}"


class Activity(models.Model):
    type = models.TextField()
    description = models.TextField()
    product = models.ForeignKey(Product, models.SET_NULL, blank=True, null=True)
    user = models.ForeignKey(User, models.SET_NULL, null=True, blank=True)
    shop = models.ForeignKey('Shop', models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
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
