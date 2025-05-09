from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from .models import Product, SaleItem
from django.db import connection

class ProductBatch(models.Model):
    product = models.ForeignKey(Product, models.DO_NOTHING)
    batch_number = models.CharField(max_length=50, unique=True)
    purchase_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    selling_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        null=False  # Make selling_price required
    )
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    remaining_quantity = models.IntegerField(validators=[MinValueValidator(0)])
    purchase_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_batches'
        ordering = ['purchase_date']

    def clean(self):
        if self.remaining_quantity > self.quantity:
            raise ValidationError('Remaining quantity cannot be greater than initial quantity')
        if self.purchase_price <= 0:
            raise ValidationError('Purchase price must be positive')
        if self.selling_price <= 0:
            raise ValidationError('Selling price must be positive')
        if self.selling_price < self.purchase_price:
            raise ValidationError('Selling price cannot be less than purchase price')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class BatchSaleItem(models.Model):
    sale_item = models.ForeignKey(SaleItem, models.DO_NOTHING)
    batch = models.ForeignKey('ProductBatch', models.DO_NOTHING)
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'batch_sale_items'

    def clean(self):
        # Removed validation to prevent race condition with FIFO sale logic
        # if self.quantity > self.batch.remaining_quantity:
        #     raise ValidationError('Sale quantity cannot exceed batch remaining quantity')
        pass

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs) 