from django.contrib.auth.hashers import make_password
from rest_framework import serializers
from .models import (
    User, Category, Product, RestockRule,
    SaleItem, Sale, Activity, ProductForecast
)
import datetime
from django.utils import timezone
from django.db.models import Max
from django.db import connection
from decimal import Decimal
import logging
from .utils import to_nairobi
import pytz
import re

logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'name', 'role', 'is_staff', 'is_superuser']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        # Hash password during creation
        validated_data['password'] = make_password(validated_data.get('password'))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Hash password if provided during update
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data.get('password'))
        return super().update(instance, validated_data)


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=255)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        # Ensure name is properly formatted
        validated_data['name'] = validated_data['name'].strip()
        # Set timestamp
        validated_data['created_at'] = datetime.datetime.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Ensure name is properly formatted
        if 'name' in validated_data:
            validated_data['name'] = validated_data['name'].strip()
        return super().update(instance, validated_data)


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    buy_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    sell_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'description', 'category', 'category_id',
            'quantity', 'min_stock_level', 'buy_price', 'sell_price',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_hybrid_sku(self, sku):
        if re.fullmatch(r'^[A-Za-z]{1,3}[0-9]+$', sku):
            return True, None
        if re.fullmatch(r'^[A-Za-z]{1,}$', sku):
            return False, "SKU must end with a number for auto-generation. You can disable auto-generation or change the SKU."
        if re.search(r'[0-9].*[A-Za-z]', sku) or re.match(r'^[A-Za-z]{4,}', sku):
            return False, "SKU must have up to 3 letters at the start, followed by numbers only. No numbers allowed between letters."
        return False, "Invalid SKU format. Use up to 3 letters followed by numbers (e.g., ABC001)."

    def create(self, validated_data):
        # Outlier price detection
        name = validated_data.get('name')
        category_id = validated_data.get('category_id')
        sell_price = float(validated_data.get('sell_price', 0))
        force = self.context.get('force', False)
        if name and category_id and sell_price > 0 and not force:
            is_outlier, stats = is_price_outlier(name, category_id, sell_price)
            if is_outlier:
                raise serializers.ValidationError({
                    'sell_price': [
                        f"Warning: The selling price ({sell_price}) is an outlier for similar products in this category. Typical range: {stats['lower_bound']:.2f} - {stats['upper_bound']:.2f}. If you are sure, you can override this warning."
                    ]
                })
        try:
            # Check if SKU is provided
            sku = validated_data.get('sku')
            if sku:
                valid, error = self.validate_hybrid_sku(sku)
                if not valid:
                    raise serializers.ValidationError({'sku': error})

            # Validate category
            category_id = validated_data.get('category_id')
            if category_id:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT id FROM categories WHERE id = %s", [category_id])
                    if not cursor.fetchone():
                        raise serializers.ValidationError("Invalid category ID")

            # Format decimal fields
            for field in ['buy_price', 'sell_price']:
                if field in validated_data:
                    validated_data[field] = Decimal(str(validated_data[field])).quantize(Decimal('0.01'))

            # Set timestamps with timezone awareness
            validated_data['created_at'] = timezone.now()
            validated_data['updated_at'] = timezone.now()

            # Create the product
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO products (
                        sku, name, description, category_id, quantity, 
                        min_stock_level, buy_price, sell_price, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, [
                    validated_data.get('sku'),
                    validated_data.get('name'),
                    validated_data.get('description'),
                    validated_data.get('category_id'),
                    validated_data.get('quantity', 0),
                    validated_data.get('min_stock_level', 0),
                    validated_data.get('buy_price', 0),
                    validated_data.get('sell_price', 0),
                    validated_data.get('created_at'),
                    validated_data.get('updated_at')
                ])
                product_id = cursor.fetchone()[0]

            # Return the created Product instance, not a dict!
            return Product.objects.get(id=product_id)

        except Exception as e:
            logger.error(f"Error creating product: {str(e)}")
            raise serializers.ValidationError(f"Error creating product: {str(e)}")

    def update(self, instance, validated_data):
        # Outlier price detection
        name = validated_data.get('name', instance.name)
        category_id = validated_data.get('category_id', instance.category_id)
        sell_price = float(validated_data.get('sell_price', instance.sell_price))
        force = self.context.get('force', False)
        if name and category_id and sell_price > 0 and not force:
            is_outlier, stats = is_price_outlier(name, category_id, sell_price)
            if is_outlier:
                raise serializers.ValidationError({
                    'sell_price': [
                        f"Warning: The selling price ({sell_price}) is an outlier for similar products in this category. Typical range: {stats['lower_bound']:.2f} - {stats['upper_bound']:.2f}. If you are sure, you can override this warning."
                    ]
                })
        category_id = validated_data.pop('category_id', None)
        if category_id is not None:
            try:
                validated_data['category'] = Category.objects.get(id=category_id)
            except Category.DoesNotExist:
                raise serializers.ValidationError({'category_id': 'Category does not exist'})
        
        # Ensure decimal fields are properly formatted
        if 'buy_price' in validated_data:
            validated_data['buy_price'] = str(validated_data['buy_price'])
        if 'sell_price' in validated_data:
            validated_data['sell_price'] = str(validated_data['sell_price'])
        
        # Update timestamp with timezone awareness
        validated_data['updated_at'] = timezone.now()
        
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Convert date fields to Nairobi timezone
        for field in ['created_at', 'updated_at']:
            if data.get(field):
                data[field] = to_nairobi(getattr(instance, field)).isoformat() if getattr(instance, field) else None
        return data


class RestockRuleSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = RestockRule
        fields = [
            'id', 'product', 'reorder_quantity', 'is_auto_reorder_enabled',
            'supplier_id', 'supplier_name', 'supplier_email', 'supplier_phone',
            'created_at', 'updated_at'
        ]


class SaleItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = SaleItem
        fields = ['id', 'sale', 'product', 'quantity', 'unit_price', 'total_price']


class SaleSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    items = SaleItemSerializer(many=True, read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True, required=False)
    discount_percentage = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True, required=False)
    original_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True, required=False)
    sale_date = serializers.DateTimeField(format='iso-8601')
    created_at = serializers.DateTimeField(format='iso-8601', required=False)
    
    class Meta:
        model = Sale
        fields = [
            'id', 'sale_date', 'total_amount', 'user', 'user_id', 'created_at',
            'discount', 'discount_percentage', 'original_amount', 'items'
        ]

    def create(self, validated_data):
        validated_data['created_at'] = timezone.now()
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Convert date fields to Nairobi timezone
        for field in ['sale_date', 'created_at']:
            if data.get(field):
                data[field] = to_nairobi(getattr(instance, field)).isoformat() if getattr(instance, field) else None
        # Convert decimal fields to strings to avoid serialization issues
        for field in ['total_amount', 'discount', 'discount_percentage', 'original_amount']:
            if field in data and data[field] is not None:
                data[field] = str(data[field])
        return data


class ActivitySerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    created_at = serializers.DateTimeField(format='iso-8601', required=False)
    
    class Meta:
        model = Activity
        fields = ['id', 'type', 'description', 'product', 'user', 'user_id', 'created_at', 'status']

    def create(self, validated_data):
        user_id = validated_data.pop('user_id', None)
        if user_id:
            try:
                validated_data['user'] = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise serializers.ValidationError({'user_id': 'User does not exist'})
        # Ensure created_at is set and timezone-aware in Africa/Nairobi
        if not validated_data.get('created_at'):
            nairobi_tz = pytz.timezone('Africa/Nairobi')
            validated_data['created_at'] = timezone.now().astimezone(nairobi_tz)
        else:
            dt = validated_data['created_at']
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, datetime.timezone.utc)
            validated_data['created_at'] = dt.astimezone(pytz.timezone('Africa/Nairobi'))
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            if data.get('created_at'):
                data['created_at'] = to_nairobi(getattr(instance, 'created_at')).isoformat() if getattr(instance, 'created_at') else None
        except Exception as e:
            data['created_at'] = str(getattr(instance, 'created_at'))
        return data 


class ProductForecastSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductForecast
        fields = ['id', 'forecast_date', 'forecast_quantity', 'created_at', 'model_info'] 

def is_price_outlier(name, category_id, sell_price):
    """
    Check if the given sell_price is an outlier for products with the same category and similar name.
    Uses IQR (interquartile range) for robust outlier detection.
    Returns (is_outlier: bool, stats: dict)
    """
    # Find similar products by category and name (case-insensitive, partial match)
    name_pattern = f"%{name.split()[0]}%" if name else "%"
    with connection.cursor() as cursor:
        cursor.execute('''
            SELECT sell_price FROM products
            WHERE category_id = %s AND LOWER(name) LIKE LOWER(%s) AND sell_price > 0
        ''', [category_id, name_pattern])
        prices = [float(row[0]) for row in cursor.fetchall()]

    if len(prices) < 5:
        # Not enough data to judge outliers
        return False, {"reason": "not enough data", "n": len(prices)}

    prices.sort()
    q1 = prices[len(prices)//4]
    q3 = prices[3*len(prices)//4]
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    is_outlier = sell_price < lower_bound or sell_price > upper_bound
    return is_outlier, {
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
        "lower_bound": lower_bound,
        "upper_bound": upper_bound,
        "n": len(prices),
        "prices": prices[:10]  # sample
    } 