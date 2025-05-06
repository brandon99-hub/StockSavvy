from django.contrib.auth.hashers import make_password
from rest_framework import serializers
from .models import (
    User, Category, Product, RestockRule,
    SaleItem, Sale, Activity
)
import datetime
from django.utils import timezone
from django.db.models import Max
from django.db import connection
from decimal import Decimal
import logging

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

    def create(self, validated_data):
        try:
            # Check if SKU is provided
            sku = validated_data.get('sku')
            if not sku:
                # Get the highest numeric SKU
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT sku FROM products 
                        WHERE sku ~ '^[0-9]+$' 
                        ORDER BY CAST(sku AS INTEGER) DESC 
                        LIMIT 1
                    """)
                    result = cursor.fetchone()
                    highest_sku = int(result[0]) if result else 139
                    new_sku = str(highest_sku + 1)
                    validated_data['sku'] = new_sku

            # Validate category
            category_id = validated_data.get('categoryId')
            if category_id:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT id FROM categories WHERE id = %s", [category_id])
                    if not cursor.fetchone():
                        raise serializers.ValidationError("Invalid category ID")

            # Format decimal fields
            for field in ['buyPrice', 'sellPrice']:
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
                    validated_data.get('categoryId'),
                    validated_data.get('quantity', 0),
                    validated_data.get('minStockLevel', 0),
                    validated_data.get('buyPrice', 0),
                    validated_data.get('sellPrice', 0),
                    validated_data.get('created_at'),
                    validated_data.get('updated_at')
                ])
                product_id = cursor.fetchone()[0]

            # Return the created product
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM products WHERE id = %s
                """, [product_id])
                columns = [col[0] for col in cursor.description]
                product = dict(zip(columns, cursor.fetchone()))

            return product

        except Exception as e:
            logger.error(f"Error creating product: {str(e)}")
            raise serializers.ValidationError(f"Error creating product: {str(e)}")

    def update(self, instance, validated_data):
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
        # Convert decimal fields to strings to avoid serialization issues
        for field in ['total_amount', 'discount', 'discount_percentage', 'original_amount']:
            if field in data and data[field] is not None:
                data[field] = str(data[field])
        return data


class ActivitySerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    created_at = serializers.DateTimeField(format='iso-8601')
    
    class Meta:
        model = Activity
        fields = ['id', 'type', 'description', 'product', 'user', 'created_at', 'status'] 