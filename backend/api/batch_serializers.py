from rest_framework import serializers
from .batch_models import ProductBatch, BatchSaleItem
from .utils import to_nairobi

class ProductBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBatch
        fields = [
            'id', 'product', 'batch_number', 'purchase_price', 'selling_price',
            'quantity', 'remaining_quantity', 'purchase_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in ['purchase_date', 'created_at', 'updated_at']:
            if data.get(field):
                data[field] = to_nairobi(getattr(instance, field)).isoformat() if getattr(instance, field) else None
        return data

class BatchSaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchSaleItem
        fields = ['id', 'sale_item', 'batch', 'quantity', 'created_at']
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('created_at'):
            data['created_at'] = to_nairobi(getattr(instance, 'created_at')).isoformat() if getattr(instance, 'created_at') else None
        return data 
