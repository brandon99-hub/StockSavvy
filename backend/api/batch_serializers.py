from rest_framework import serializers
from .batch_models import ProductBatch, BatchSaleItem

class ProductBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBatch
        fields = [
            'id', 'product', 'batch_number', 'purchase_price', 'selling_price',
            'quantity', 'remaining_quantity', 'purchase_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class BatchSaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchSaleItem
        fields = ['id', 'sale_item', 'batch', 'quantity', 'created_at']
        read_only_fields = ['id', 'created_at'] 
