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
            selling_price = request.data.get('selling_price')

            if not selling_price:
                return Response(
                    {"detail": "Selling price is required for batches"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get the product
            with connection.cursor() as cursor:
                cursor.execute("SELECT id, quantity, sell_price FROM products WHERE id = %s", [product_id])
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
            is_authenticated, user_id, is_authorized = self.check_token_auth(request)
            instance = self.get_object()
            old_quantity = instance.quantity
            old_remaining = instance.remaining_quantity
            new_quantity = int(request.data.get('quantity', old_quantity))

            # Log the request data for debugging
            logger.info(f"Update batch request data: {request.data}")

            # Ensure selling_price is properly handled
            if 'selling_price' in request.data:
                if request.data['selling_price'] == '' or request.data['selling_price'] is None:
                    request.data['selling_price'] = None
                else:
                    try:
                        request.data['selling_price'] = float(request.data['selling_price'])
                    except (ValueError, TypeError):
                        return Response(
                            {"detail": "Invalid selling price format"},
                            status=status.HTTP_400_BAD_REQUEST
                        )

            # If quantity is being updated, update remaining_quantity accordingly
            if 'quantity' in request.data:
                sold = old_quantity - old_remaining
                new_remaining = max(new_quantity - sold, 0)
                request.data['remaining_quantity'] = new_remaining

            serializer = self.get_serializer(instance, data=request.data, partial=True)
            if not serializer.is_valid():
                logger.error(f"Serializer validation errors: {serializer.errors}")
                return Response(
                    {"detail": "Invalid data", "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            self.perform_update(serializer)

            # Update product quantity if quantity changed
            if old_quantity != new_quantity:
                quantity_diff = new_quantity - old_quantity
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE products SET quantity = quantity + %s WHERE id = %s",
                        [quantity_diff, instance.product_id]
                    )

            # Create activity log for the update
            Activity.objects.create(
                type='batch_updated',
                description=f'Batch #{instance.id} updated for product {instance.product_id}',
                product_id=instance.product_id,
                user_id=user_id,
                created_at=timezone.now(),
                status='completed'
            )

            return Response({"detail": "Batch updated successfully", "data": serializer.data})

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error updating batch: {error_msg}")
            return Response(
                {"detail": "Error updating batch. Please try again."},
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
            return Response({"detail": "Batch deleted successfully"}, status=status.HTTP_200_OK)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error deleting batch: {error_msg}")
            return Response(
                {"detail": "Error deleting batch. Please try again."},
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
            # Extract user_id from token, handling different formats
            user_id = None
            if token.startswith('token_'):
                parts = token.split('_')
                if len(parts) > 1:
                    user_id = int(parts[1])
            else:
                # Try to extract user_id from other token formats
                parts = token.split('_')
                if len(parts) > 0:
                    # Try to find a part that can be converted to an integer
                    for part in parts:
                        try:
                            user_id = int(part)
                            break
                        except ValueError:
                            continue

            if user_id is None:
                return False, None, False

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
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not is_authorized:
            return Response(
                {"detail": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            sale_item_id = request.data.get('sale_item')
            quantity = int(request.data.get('quantity', 0))
            original_quantity = quantity
            sale_portions = []  # To track each portion of the sale (initial or batch)

            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id, product_id, quantity
                    FROM sale_items
                    WHERE id = %s
                """, [sale_item_id])
                sale_item = cursor.fetchone()

                if not sale_item:
                    return Response(
                        {"detail": "Sale item not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )

                product_id = sale_item[1]

                # Get product info
                cursor.execute("""
                    SELECT quantity, buy_price, sell_price
                    FROM products
                    WHERE id = %s
                """, [product_id])
                product = cursor.fetchone()
                product_quantity = product[0]
                current_buy_price = product[1]
                current_sell_price = product[2]

                # Get all batches ordered by purchase_date
                cursor.execute("""
                    SELECT id, remaining_quantity, selling_price, purchase_price, purchase_date
                    FROM product_batches
                    WHERE product_id = %s AND remaining_quantity > 0
                    ORDER BY purchase_date ASC, id ASC
                """, [product_id])
                batches = cursor.fetchall()
                batch_idx = 0

                # FIFO loop: use batches only
                while quantity > 0:
                    if batch_idx < len(batches):
                        batch = batches[batch_idx]
                        batch_id = batch[0]
                        batch_remaining = batch[1]
                        batch_selling_price = batch[2]
                        batch_purchase_price = batch[3]
                        use_qty = min(quantity, batch_remaining)
                        # Update batch remaining_quantity
                        cursor.execute("""
                            UPDATE product_batches
                            SET remaining_quantity = remaining_quantity - %s
                            WHERE id = %s
                        """, [use_qty, batch_id])
                        # Update product quantity
                        cursor.execute("""
                            UPDATE products
                            SET quantity = quantity - %s
                            WHERE id = %s
                        """, [use_qty, product_id])
                        # Record this portion
                        sale_portions.append({
                            'type': 'batch',
                            'batch_id': batch_id,
                            'quantity': use_qty,
                            'buy_price': batch_purchase_price,
                            'sell_price': batch_selling_price
                        })
                        batches = list(batches)
                        batches[batch_idx] = (batch_id, batch_remaining - use_qty, batch_selling_price, batch_purchase_price, batch[4])
                        quantity -= use_qty
                        # If batch is depleted, move to next batch
                        if batches[batch_idx][1] == 0:
                            batch_idx += 1
                        continue
                    # If no more batches, use regular product quantity
                    if product_quantity > 0:
                        use_qty = min(quantity, product_quantity)
                        cursor.execute("""
                            UPDATE products
                            SET quantity = quantity - %s
                            WHERE id = %s
                        """, [use_qty, product_id])
                        sale_portions.append({
                            'type': 'regular',
                            'quantity': use_qty,
                            'buy_price': current_buy_price,
                            'sell_price': current_sell_price
                        })
                        product_quantity -= use_qty
                        quantity -= use_qty
                        continue
                    # If no stock left
                    break

                # Now, create sale items for each portion
                for portion in sale_portions:
                    if portion['type'] == 'regular':
                        serializer = self.get_serializer(data={
                            'sale_item': sale_item_id,
                            'quantity': portion['quantity']
                        })
                        serializer.is_valid(raise_exception=True)
                        self.perform_create(serializer)
                    elif portion['type'] == 'batch':
                        serializer = self.get_serializer(data={
                            'sale_item': sale_item_id,
                            'batch': portion['batch_id'],
                            'quantity': portion['quantity']
                        })
                        serializer.is_valid(raise_exception=True)
                        self.perform_create(serializer)

            return Response({'detail': f'Sale of {original_quantity} completed FIFO', 'portions': sale_portions}, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating batch sale item: {str(e)}")
            return Response(
                {"detail": f"Error creating batch sale item: {str(e)}"},
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
