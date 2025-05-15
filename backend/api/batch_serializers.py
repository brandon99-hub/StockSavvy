from rest_framework import serializers
from .batch_models import ProductBatch, BatchSaleItem
from .utils import to_nairobi
from api.serializers import is_price_outlier

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

    def create(self, validated_data):
        # Outlier price detection
        product = validated_data.get('product')
        selling_price = float(validated_data.get('selling_price', 0))
        force = self.context.get('force', False)
        if product and selling_price > 0 and not force:
            name = getattr(product, 'name', None)
            category_id = getattr(product, 'category_id', None)
            if name and category_id:
                is_outlier, stats = is_price_outlier(name, category_id, selling_price)
                if is_outlier:
                    raise serializers.ValidationError({
                        'selling_price': [
                            f"Warning: The selling price ({selling_price}) is an outlier for similar products in this category. Typical range: {stats['lower_bound']:.2f} - {stats['upper_bound']:.2f}. If you are sure, you can override this warning."
                        ]
                    })
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Outlier price detection
        product = validated_data.get('product', instance.product)
        selling_price = float(validated_data.get('selling_price', instance.selling_price))
        force = self.context.get('force', False)
        if product and selling_price > 0 and not force:
            name = getattr(product, 'name', None)
            category_id = getattr(product, 'category_id', None)
            if name and category_id:
                is_outlier, stats = is_price_outlier(name, category_id, selling_price)
                if is_outlier:
                    raise serializers.ValidationError({
                        'selling_price': [
                            f"Warning: The selling price ({selling_price}) is an outlier for similar products in this category. Typical range: {stats['lower_bound']:.2f} - {stats['upper_bound']:.2f}. If you are sure, you can override this warning."
                        ]
                    })
        return super().update(instance, validated_data)

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
