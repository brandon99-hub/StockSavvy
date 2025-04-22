from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from .batch_models import ProductBatch, BatchSaleItem
from .batch_serializers import ProductBatchSerializer, BatchSaleItemSerializer
from .models import Product, SaleItem, Activity
from django.db import connection
import logging

logger = logging.getLogger(__name__)

class ProductBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductBatch.objects.all()
    serializer_class = ProductBatchSerializer
    permission_classes = []
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['batch_number']
    ordering_fields = ['purchase_date', 'remaining_quantity', 'purchase_price']

    def check_token_auth(self, request):
        try:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                logger.warning('Missing or invalid authorization header')
                return False, None, False

            token = auth_header.split(' ')[1]
            if not token:
                logger.warning('Invalid token format')
                return False, None, False

            try:
                parts = token.split('_')
                user_id = int(parts[1]) if len(parts) > 1 else None

                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT is_staff, is_superuser, role FROM users WHERE id = %s",
                        [user_id]
                    )
                    row = cursor.fetchone()
                    if row:
                        is_staff, is_superuser, role = row
                        # Allow access if user is staff, superuser, admin, or manager
                        is_authorized = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager', 'staff'])
                        return True, user_id, is_authorized
                return False, None, False
            except (IndexError, ValueError) as e:
                logger.warning(f'Error parsing token: {str(e)}')
                return False, None, False
        except Exception as e:
            logger.error(f'Unexpected error in token authentication: {str(e)}')
            return False, None, False

    def get_queryset(self):
        is_authenticated, user_id, is_authorized = self.check_token_auth(self.request)
        if not is_authenticated or not is_authorized:
            return ProductBatch.objects.none()

        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        min_remaining = self.request.query_params.get('min_remaining')
        max_remaining = self.request.query_params.get('max_remaining')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if min_remaining:
            queryset = queryset.filter(remaining_quantity__gte=min_remaining)
        if max_remaining:
            queryset = queryset.filter(remaining_quantity__lte=max_remaining)
        if start_date:
            queryset = queryset.filter(purchase_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(purchase_date__lte=end_date)

        return queryset

    def list(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            product_id = request.data.get('product')
            quantity = int(request.data.get('quantity', 0))
            purchase_price = float(request.data.get('purchase_price', 0))

            # Get the product
            with connection.cursor() as cursor:
                cursor.execute("SELECT id, quantity FROM products WHERE id = %s", [product_id])
                product = cursor.fetchone()
                if not product:
                    return Response(
                        {"detail": "Product not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Set remaining_quantity equal to quantity
            request.data['remaining_quantity'] = quantity

            # Create the batch
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            # Update product quantity
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE products SET quantity = quantity + %s WHERE id = %s",
                    [quantity, product_id]
                )

            # Create activity log
            Activity.objects.create(
                type='batch_added',
                description=f'New batch added for product {product_id}',
                product_id=product_id,
                user_id=user_id,
                created_at=timezone.now(),
                status='completed'
            )

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating batch: {str(e)}")
            return Response(
                {"detail": f"Error creating batch: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            old_quantity = instance.quantity
            new_quantity = int(request.data.get('quantity', old_quantity))

            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            # Update product quantity if quantity changed
            if old_quantity != new_quantity:
                quantity_diff = new_quantity - old_quantity
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE products SET quantity = quantity + %s WHERE id = %s",
                        [quantity_diff, instance.product_id]
                    )

            return Response(serializer.data)

        except Exception as e:
            logger.error(f"Error updating batch: {str(e)}")
            return Response(
                {"detail": "Error updating batch"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            
            # Check if batch has any sales
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT COUNT(*) FROM batch_sale_items WHERE batch_id = %s",
                    [instance.id]
                )
                sale_count = cursor.fetchone()[0]
                
                if sale_count > 0:
                    return Response(
                        {"detail": "Cannot delete batch with existing sales"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Update product quantity
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE products SET quantity = quantity - %s WHERE id = %s",
                    [instance.quantity, instance.product_id]
                )

            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)

        except Exception as e:
            logger.error(f"Error deleting batch: {str(e)}")
            return Response(
                {"detail": "Error deleting batch"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response(
                {"detail": "Product ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_batches,
                        COALESCE(SUM(quantity), 0) as total_quantity,
                        COALESCE(SUM(remaining_quantity), 0) as total_remaining,
                        COALESCE(AVG(purchase_price), 0) as avg_price
                    FROM product_batches
                    WHERE product_id = %s
                """, [product_id])
                stats = cursor.fetchone()

            return Response({
                'total_batches': stats[0] or 0,
                'total_quantity': stats[1] or 0,
                'total_remaining': stats[2] or 0,
                'average_price': float(stats[3] or 0)
            })

        except Exception as e:
            logger.error(f"Error getting batch stats: {str(e)}")
            return Response(
                {"detail": f"Error getting batch statistics: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BatchSaleItemViewSet(viewsets.ModelViewSet):
    queryset = BatchSaleItem.objects.all()
    serializer_class = BatchSaleItemSerializer

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return False, None, False

        token = auth_header.split(' ')[1]
        if not token:
            return False, None, False

        try:
            parts = token.split('_')
            user_id = int(parts[1]) if len(parts) > 1 else None
            
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT is_staff, is_superuser, role FROM users WHERE id = %s",
                    [user_id]
                )
                row = cursor.fetchone()
                if row:
                    is_staff, is_superuser, role = row
                    # Allow access if user is staff, superuser, admin, or manager
                    is_authorized = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager', 'staff'])
                    return True, user_id, is_authorized
            return False, None, False
        except (IndexError, ValueError) as e:
            logger.warning(f'Error parsing token: {str(e)}')
            return False, None, False
        except Exception as e:
            logger.error(f'Unexpected error in token authentication: {str(e)}')
            return False, None, False

    def get_queryset(self):
        is_authenticated, user_id, is_authorized = self.check_token_auth(self.request)
        if not is_authenticated:
            return BatchSaleItem.objects.none()
        if not is_authorized:
            return BatchSaleItem.objects.none()

        queryset = super().get_queryset()
        sale_id = self.request.query_params.get('sale_id')
        if sale_id:
            return queryset.filter(sale_item__sale_id=sale_id)
        return queryset

    def list(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            sale_item_id = request.data.get('sale_item')
            quantity = int(request.data.get('quantity', 0))

            # Get the sale item
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT si.id, si.product_id, si.quantity
                    FROM sale_items si
                    WHERE si.id = %s
                """, [sale_item_id])
                sale_item = cursor.fetchone()
                if not sale_item:
                    return Response(
                        {"detail": "Sale item not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Find the oldest batch with remaining quantity
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id, remaining_quantity
                    FROM product_batches
                    WHERE product_id = %s AND remaining_quantity > 0
                    ORDER BY purchase_date ASC
                    LIMIT 1
                """, [sale_item[1]])
                batch = cursor.fetchone()

                if not batch:
                    return Response(
                        {"detail": "No available batches for this product"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if batch[1] < quantity:
                    return Response(
                        {"detail": "Insufficient quantity in oldest batch"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Create the batch sale item
            serializer = self.get_serializer(data={
                'sale_item': sale_item_id,
                'batch': batch[0],
                'quantity': quantity
            })
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            # Update batch remaining quantity
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE product_batches
                    SET remaining_quantity = remaining_quantity - %s
                    WHERE id = %s
                """, [quantity, batch[0]])

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating batch sale item: {str(e)}")
            return Response(
                {"detail": "Error creating batch sale item"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def sale_details(self, request):
        sale_id = request.query_params.get('sale_id')
        if not sale_id:
            return Response(
                {"detail": "Sale ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        bsi.id,
                        bsi.quantity,
                        pb.batch_number,
                        pb.purchase_price,
                        p.name as product_name
                    FROM batch_sale_items bsi
                    JOIN product_batches pb ON bsi.batch_id = pb.id
                    JOIN products p ON pb.product_id = p.id
                    WHERE bsi.sale_item_id IN (
                        SELECT id FROM sale_items WHERE sale_id = %s
                    )
                """, [sale_id])
                details = cursor.fetchall()

            return Response([{
                'id': row[0],
                'quantity': row[1],
                'batch_number': row[2],
                'purchase_price': float(row[3]),
                'product_name': row[4]
            } for row in details])

        except Exception as e:
            logger.error(f"Error getting sale details: {str(e)}")
            return Response(
                {"detail": "Error getting sale details"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 