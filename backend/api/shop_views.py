from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .permissions import IsSystemAdmin, IsShopManager, IsShopStaff, HasShopAccess
from django.db import transaction
from django.db.models import Q, F, Sum
from django.utils import timezone
import logging

from .models import (
    Shop, ShopInventory, Customer, PaymentMethod, 
    SalePayment, CreditTransaction, User, Product, Activity
)
from .serializers import (
    ShopSerializer, ShopInventorySerializer, CustomerSerializer,
    PaymentMethodSerializer, SalePaymentSerializer, CreditTransactionSerializer
)

from .services.bc_sync import BCSyncService


logger = logging.getLogger(__name__)


class ShopViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shops.
    Admin can create/edit/delete shops.
    Shop managers can only view their assigned shop.
    """
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSystemAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter shops based on user role"""
        user = self.request.user
        
        # Admin can see all shops
        if user.role == 'admin' or user.can_access_all_shops:
            return Shop.objects.all()
        
        # Shop managers/staff can only see their assigned shop
        if user.shop:
            return Shop.objects.filter(id=user.shop.id)
        
        return Shop.objects.none()

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class ShopInventoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shop inventory.
    Staff can view/update inventory for their shop only.
    """
    queryset = ShopInventory.objects.all()
    serializer_class = ShopInventorySerializer

    def get_permissions(self):
        if self.action in ['add_stock', 'create', 'update', 'partial_update']:
            return [IsShopStaff()]
        if self.action in ['destroy']:
            return [IsSystemAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter inventory based on user's shop"""
        user = self.request.user
        shop_id = self.request.query_params.get('shop_id')
        
        # Admin can see all shops' inventory
        if user.role == 'admin' or user.can_access_all_shops:
            if shop_id:
                return ShopInventory.objects.filter(shop_id=shop_id).select_related('product', 'shop')
            return ShopInventory.objects.all().select_related('product', 'shop')
        
        # Shop staff can only see their shop's inventory
        if user.shop:
            return ShopInventory.objects.filter(shop=user.shop).select_related('product', 'shop')
        
        return ShopInventory.objects.none()

    @action(detail=False, methods=['post'])
    def add_stock(self, request):
        """Add stock to a specific shop inventory"""
            
        shop_id = request.data.get('shop_id')
        product_id = request.data.get('product_id')
        barcode = request.data.get('barcode')
        quantity = request.data.get('quantity', 0)
        multiplier = request.data.get('multiplier', 1)
        sync_from_bc = request.data.get('sync_from_bc', False)
        
        if not (product_id or barcode):
            return Response({'error': 'Product ID or Barcode required'}, status=status.HTTP_400_BAD_REQUEST)
            
        product = None
        if product_id:
            product = Product.objects.filter(id=product_id).first()
        elif barcode:
            product = Product.objects.filter(barcode=barcode).first()
            if not product and sync_from_bc:
                product = BCSyncService.sync_by_barcode(barcode)
                
        if not product:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            shop = Shop.objects.get(id=shop_id)
        except Shop.DoesNotExist:
            return Response({'error': 'Shop not found'}, status=status.HTTP_404_NOT_FOUND)
            
        total_quantity_to_add = int(quantity) * int(multiplier)
        
        inventory, created = ShopInventory.objects.get_or_create(
            shop=shop,
            product=product,
            defaults={'quantity': 0}
        )
        
        inventory.quantity = F('quantity') + total_quantity_to_add
        inventory.save()
        
        # Refresh from DB to get the actual value after F expression if needed, 
        # but for Response we can just say "added X"
        
        Activity.objects.create(
            type='restock',
            description=f"Stock Intake: Added {total_quantity_to_add} units of {product.name} to {shop.name}",
            user=request.user,
            status='completed'
        )
        
        return Response({
            'message': 'Stock added successfully',
            'product_name': product.name,
            'added_quantity': total_quantity_to_add,
            'new_total': inventory.quantity # Note: F expressions won't show new total here until refresh
        })

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get low stock items for user's shop"""
        
        user = request.user
        
        # Get shop_id from query params or user's shop
        shop_id = request.query_params.get('shop_id')
        if not shop_id and user.shop:
            shop_id = user.shop.id
        
        if not shop_id:
            return Response({'error': 'Shop ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user has access to this shop
        if user.role != 'admin' and not user.can_access_all_shops:
            if not user.shop or user.shop.id != int(shop_id):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        low_stock_items = ShopInventory.objects.filter(
            shop_id=shop_id,
            quantity__lte=F('min_stock_level')
        ).select_related('product', 'shop')
        
        serializer = self.get_serializer(low_stock_items, many=True)
        return Response(serializer.data)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing customers.
    Staff can manage customers for their shop only.
    """
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action in ['destroy', 'record_payment']:
            return [IsShopManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter customers based on user's shop"""
        user = self.request.user
        shop_id = self.request.query_params.get('shop_id')
        
        queryset = Customer.objects.all().select_related('shop')
        
        # Admin can see all customers
        if user.role == 'admin' or user.can_access_all_shops:
            if shop_id:
                queryset = queryset.filter(shop_id=shop_id)
        else:
            # Shop staff can only see their shop's customers
            if user.shop:
                queryset = queryset.filter(shop=user.shop)
            else:
                return Customer.objects.none()
        
        # Search functionality
        search_query = self.request.query_params.get('search', self.request.query_params.get('q', ''))
        phone_query = self.request.query_params.get('phone', '')
        
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) | 
                Q(phone__icontains=search_query) |
                Q(id_number__icontains=search_query)
            )
        elif phone_query:
            queryset = queryset.filter(phone__icontains=phone_query)

        return queryset.order_by('-created_at')

class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing customers.
    Staff can manage customers for their shop only.
    """
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action in ['destroy', 'record_payment']:
            return [IsShopManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter customers based on user's shop"""
        user = self.request.user
        shop_id = self.request.query_params.get('shop_id')
        
        # Admin can see all customers
        if user.role == 'admin' or user.can_access_all_shops:
            if shop_id:
                return Customer.objects.filter(shop_id=shop_id).select_related('shop').order_by('-created_at')
            return Customer.objects.all().select_related('shop').order_by('-created_at')
        
        # Shop staff can only see their shop's customers
        if user.shop:
            return Customer.objects.filter(shop=user.shop).select_related('shop').order_by('-created_at')
        
        return Customer.objects.none()

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # Ensure shop_id is set
        if 'shop' not in request.data:
            if request.user.shop:
                request.data['shop'] = request.user.shop.id
            else:
                return Response({'error': 'Shop ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Delete a customer (Admin/Manager only)"""
        # Note: Permission logic moved to get_permissions
        
        customer = self.get_object()
        
        # Check if customer has outstanding balance
        if customer.current_balance > 0:
            return Response({'error': 'Cannot delete customer with outstanding balance'}, status=status.HTTP_400_BAD_REQUEST)
        
        customer_name = customer.name
        customer_id = customer.id
        
        try:
            with transaction.atomic():
                # Get the shop_id for the activity log before deletion
                shop_id = customer.shop_id
                
                # Delete the customer
                customer.delete()
                
                # Create activity log
                Activity.objects.create(
                    type='customer_deleted',
                    description=f'Customer deleted: {customer_name}',
                    user=request.user,
                    shop_id=shop_id,
                    created_at=timezone.now(),
                    status='completed'
                )
                
                return Response({'message': 'Customer deleted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error deleting customer: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a credit payment for a customer"""
        
        customer = self.get_object()
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'Cash')
        notes = request.data.get('notes', '')
        
        if not amount or float(amount) <= 0:
            return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
        
        amount = float(amount)
        
        try:
            with transaction.atomic():
                # Update customer balance
                customer.current_balance -= amount
                if customer.current_balance < 0:
                    customer.current_balance = 0
                customer.save()
                
                # Create credit transaction
                CreditTransaction.objects.create(
                    customer=customer,
                    shop=customer.shop,
                    transaction_type='payment',
                    amount=-amount,  # Negative for payment
                    balance_after=customer.current_balance,
                    payment_method=payment_method,
                    notes=notes,
                    user=request.user
                )
                
                return Response({
                    'message': 'Payment recorded successfully',
                    'new_balance': str(customer.current_balance)
                })
        except Exception as e:
            logger.error(f"Error recording payment: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for payment methods (read-only).
    """
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class CreditTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing credit transactions (read-only).
    """
    queryset = CreditTransaction.objects.all()
    serializer_class = CreditTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter transactions based on user's shop"""
        user = self.request.user
        customer_id = self.request.query_params.get('customer_id')
        shop_id = self.request.query_params.get('shop_id')
        
        queryset = CreditTransaction.objects.all().select_related('customer', 'shop', 'created_by')
        
        # Admin can see all transactions
        if user.role == 'admin' or user.can_access_all_shops:
            if shop_id:
                queryset = queryset.filter(shop_id=shop_id)
        else:
            # Shop staff can only see their shop's transactions
            if user.shop:
                queryset = queryset.filter(shop=user.shop)
            else:
                return CreditTransaction.objects.none()
        
        # Filter by customer
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        return queryset

    def list(self, request, *args, **kwargs):
        auth_error = self.check_token_auth(request)
        if auth_error:
            return auth_error
        return super().list(request, *args, **kwargs)
