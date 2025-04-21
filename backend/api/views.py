from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, BasePermission
from django.contrib.auth import login, logout, get_user_model, authenticate
from django.db.models import Sum, F, Count
from django.db.models.functions import TruncDate
from .models import Category, Product, Sale, SaleItem, Activity, RestockRule
from .serializers import (
    UserSerializer, CategorySerializer, ProductSerializer,
    SaleSerializer, SaleItemSerializer, ActivitySerializer,
    RestockRuleSerializer
)
import jwt
import datetime
from django.db import connection
from rest_framework.authtoken.models import Token
from django.utils import timezone
import decimal
from django.views.generic import TemplateView
from django.conf import settings
from django.db import models
from django.db import transaction
import logging
from rest_framework.exceptions import APIException
from django.core.exceptions import ValidationError

User = get_user_model()

# Add logging configuration
logger = logging.getLogger(__name__)

class APIError(APIException):
    status_code = 400
    default_detail = 'An error occurred'
    default_code = 'error'

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail, code)


class FrontendAppView(TemplateView):
    template_name = "index.html"


class IsAdminOrManager(BasePermission):
    """
    Custom permission to only allow admin or manager users to access the view.
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return False

        # Check if user has admin or manager role
        return request.user.role in ['admin', 'manager']


@api_view(['GET'])
def test_connection(request):
    return Response({
        'status': 'success',
        'message': 'Django backend is connected to frontend',
        'version': '1.0.0'
    })


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = []

    def get_queryset(self):
        return User.objects.all().only(
            'id', 'username', 'role', 'name', 'is_staff', 'is_superuser'
        )

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    user_id = int(parts[1])
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "SELECT is_staff, is_superuser FROM users WHERE id = %s",
                            [user_id]
                        )
                        row = cursor.fetchone()
                        if row:
                            is_staff, is_superuser = row
                            return True, user_id, is_staff or is_superuser
                except (IndexError, ValueError):
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, _, _ = self.check_token_auth(request)
        if is_authenticated:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin and str(user_id) != str(kwargs.get('pk')):
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin and str(user_id) != str(kwargs.get('pk')):
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def login(self, request):
        try:
            username = request.data.get('username')
            password = request.data.get('password')

            print(f"Login attempt for username: {username}")  # Debug log

            if not username or not password:
                return Response(
                    {'message': 'Username and password are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Use Django's authenticate
            user = authenticate(request, username=username, password=password)
            print(f"Authentication result: {'Success' if user else 'Failed'}")  # Debug log

            if user is not None and user.is_active:
                # Generate token and return user data
                token = f"token_{user.id}"
                
                # Create user data response
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'role': user.role,
                    'is_active': user.is_active,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'name': user.name,
                    'token': token
                }

                # Store the token in the session
                request.session['auth_token'] = token
                
                # Log successful login
                print(f"Login successful for user: {username}")
                
                # Create activity log
                Activity.objects.create(
                    user=user,
                    type='login',
                    description=f'User {username} logged in',
                    created_at=timezone.now()
                )

                return Response(user_data)
            else:
                print(f"Login failed for user: {username}")  # Debug log
                return Response(
                    {'message': 'Invalid credentials'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        except Exception as e:
            print(f"Login error for {username}: {str(e)}")  # Debug log
            return Response(
                {'message': 'Login error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=False, methods=['post'])
    def logout(self, request):
        return Response({'message': 'Logged out successfully'})

    def destroy(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            # Get the product before deletion
            instance = self.get_object()
            product_name = instance.name
            product_id = instance.id
            
            # Start a transaction
            with transaction.atomic():
                # Delete related activities first
                with connection.cursor() as cursor:
                    # Delete related sale items
                    cursor.execute("DELETE FROM sale_items WHERE product_id = %s", [product_id])
                    
                    # Delete related activities
                    cursor.execute("DELETE FROM activities WHERE product_id = %s", [product_id])
                
                    # Delete the product
                    cursor.execute("DELETE FROM products WHERE id = %s", [product_id])
                
                # Create final deletion activity log
                Activity.objects.create(
                    type='product_deleted',
                    description=f'Product deleted: {product_name}',
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
            
            return Response({"message": "Product deleted successfully"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error deleting product: {str(e)}")
            return Response(
                {"detail": f"Error deleting product: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    if len(parts) >= 2:
                        user_id = int(parts[1])
                        # Get user from database to check admin status
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT is_staff, is_superuser FROM users WHERE id = %s",
                                [user_id]
                            )
                            row = cursor.fetchone()
                            if row:
                                is_staff, is_superuser = row
                                return True, user_id, is_staff or is_superuser
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, user_id, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not is_admin:
            return Response(
                {"detail": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not is_admin:
            return Response(
                {"detail": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        try:
            # Get the category before deletion
            instance = self.get_object()
            category_name = instance.name
            category_id = instance.id
            
            # Start transaction
            with transaction.atomic(), connection.cursor() as cursor:
                # Get all product IDs in this category
                cursor.execute("SELECT id FROM products WHERE category_id = %s", [category_id])
                product_ids = [row[0] for row in cursor.fetchall()]
                
                # Delete related sale items for all products in this category
                if product_ids:
                    cursor.execute("DELETE FROM sale_items WHERE product_id = ANY(%s)", [product_ids])
                
                # Delete all products in this category
                cursor.execute("DELETE FROM products WHERE category_id = %s", [category_id])
            
            # Delete the category
                cursor.execute("DELETE FROM categories WHERE id = %s", [category_id])
            
            # Create activity log
            Activity.objects.create(
                type='category_deleted',
                description=f'Category deleted: {category_name}',
                user_id=user_id,
                created_at=timezone.now(),
                status='completed'
            )
            
            return Response({"message": "Category deleted successfully"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error deleting category: {str(e)}")
            return Response(
                {"detail": f"Error deleting category: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return False, None, False

        token = auth_header.split(' ')[1]
        if not token.startswith('token_'):
            return False, None, False

        try:
            parts = token.split('_')
            user_id = int(parts[1])
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
        except (IndexError, ValueError, Exception) as e:
            print(f"Token validation error: {str(e)}")
            return False, None, False

        return False, None, False

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
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
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.sku,
                        p.quantity,
                        p.min_stock_level,
                        p.sell_price::float as sell_price,
                        c.name as category_name,
                        CASE 
                            WHEN p.quantity = 0 THEN 'Out of Stock'
                            WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                            ELSE 'In Stock'
                        END as status
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.quantity <= p.min_stock_level
                    ORDER BY 
                        CASE 
                            WHEN p.quantity = 0 THEN 1
                            WHEN p.quantity <= p.min_stock_level THEN 2
                            ELSE 3
                        END,
                        p.quantity ASC,
                        p.name ASC
                """)
                columns = [col[0] for col in cursor.description]
                low_stock_items = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format the response
                for item in low_stock_items:
                    if 'sell_price' in item and item['sell_price'] is not None:
                        item['sell_price'] = str(item['sell_price'])

                return Response(low_stock_items)
        except Exception as e:
            print(f"Error in low stock: {str(e)}")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def list(self, request):
        is_authenticated, role, is_authorized = self.check_token_auth(request)
        if not is_authenticated or not is_authorized:
            return Response({"detail": "Authentication failed"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT p.*, c.name as category_name, p.description
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    ORDER BY p.name
                """)
                columns = [col[0] for col in cursor.description]
                products = [dict(zip(columns, row)) for row in cursor.fetchall()]
                return Response(products)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, *args, **kwargs):
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
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not is_admin:
            return Response(
                {"detail": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Create the product
            response = super().create(request, *args, **kwargs)
            
            if response.status_code == 201:  # If product was created successfully
                # Get the created product data
                product_data = response.data
                
                # Create activity log
                Activity.objects.create(
                    type='product_added',
                    description=f'New product added: {product_data["name"]}',
                    product_id=product_data['id'],
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
            
            return response
            
        except Exception as e:
            return Response(
                {"detail": f"Error creating product: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get the product before update
            instance = self.get_object()
            old_quantity = instance.quantity
            
            # Update the product
            response = super().update(request, *args, **kwargs)
            
            if response.status_code == 200:  # If product was updated successfully
                # Get the updated product data
                product_data = response.data
                
                # Create activity log for product update
                Activity.objects.create(
                    type='product_updated',
                    description=f'Product updated: {product_data["name"]}',
                    product_id=product_data['id'],
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
                
                # If quantity changed, create a stock update activity
                new_quantity = product_data['quantity']
                if new_quantity != old_quantity:
                    Activity.objects.create(
                        type='stock_updated',
                        description=f'Stock updated for {product_data["name"]} from {old_quantity} to {new_quantity}',
                        product_id=product_data['id'],
                        user_id=user_id,
                        created_at=timezone.now(),
                        status='completed'
                    )
            
            return response
            
        except Exception as e:
            return Response(
                {"detail": f"Error updating product: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get the product before deletion
            instance = self.get_object()
            product_name = instance.name
            product_id = instance.id
            
            # Start a transaction
            with transaction.atomic():
                # Delete related activities first
                with connection.cursor() as cursor:
                    # Delete related sale items
                    cursor.execute("DELETE FROM sale_items WHERE product_id = %s", [product_id])
                    
                    # Delete related activities
                    cursor.execute("DELETE FROM activities WHERE product_id = %s", [product_id])
                
                    # Delete the product
                    cursor.execute("DELETE FROM products WHERE id = %s", [product_id])
                
                # Create final deletion activity log
                Activity.objects.create(
                    type='product_deleted',
                    description=f'Product deleted: {product_name}',
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
            
            return Response({"message": "Product deleted successfully"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error deleting product: {str(e)}")
            return Response(
                {"detail": f"Error deleting product: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().restock(request, pk)


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = []

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
                
                # For receipt endpoint, we only need authentication, not authorization
                if request.resolver_match and request.resolver_match.url_name == 'sale-receipt':
                    return True, user_id, True

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

    def list(self, request, *args, **kwargs):
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
            with connection.cursor() as cursor:
                cursor.execute("""
                    WITH sale_items_count AS (
                        SELECT 
                            sale_id,
                            COUNT(*) as items_count,
                            SUM(si.quantity) as total_quantity,
                            STRING_AGG(CONCAT(p.name, ' (', si.quantity, ')'), ', ') as product_names
                        FROM sale_items si
                        JOIN products p ON si.product_id = p.id
                        GROUP BY sale_id
                    )
                    SELECT 
                        s.id,
                        s.sale_date,
                        s.total_amount::float,
                        s.original_amount::float,
                        s.discount::float,
                        s.discount_percentage::float,
                        s.user_id,
                        u.name as sold_by,
                        COALESCE(sic.items_count, 0) as items_count,
                        COALESCE(sic.total_quantity, 0) as total_quantity,
                        CASE 
                            WHEN sic.product_names IS NULL THEN 'No items'
                            ELSE sic.product_names
                        END as items,
                        s.created_at
                    FROM sales s
                    LEFT JOIN users u ON s.user_id = u.id
                    LEFT JOIN sale_items_count sic ON s.id = sic.sale_id
                    ORDER BY s.created_at DESC
                """)
                columns = [col[0] for col in cursor.description]
                sales = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format the data
                for sale in sales:
                    # Format dates
                    if 'sale_date' in sale and sale['sale_date']:
                        sale['sale_date'] = sale['sale_date'].isoformat()
                    if 'created_at' in sale and sale['created_at']:
                        sale['created_at'] = sale['created_at'].isoformat()
                    
                    # Get sale items
                    cursor.execute("""
                        SELECT 
                            si.id,
                            si.quantity,
                            si.unit_price,
                            si.total_price,
                            p.name as product_name
                        FROM sale_items si
                        JOIN products p ON si.product_id = p.id
                        WHERE si.sale_id = %s
                    """, [sale['id']])
                    items_columns = [col[0] for col in cursor.description]
                    items = [dict(zip(items_columns, row)) for row in cursor.fetchall()]
                    sale['items'] = items

                return Response(sales)
        except Exception as e:
            print(f"Error in sale list: {str(e)}")
            return Response(
                {"detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        try:
            is_authenticated, user_id, is_admin = self.check_token_auth(request)
            if not is_authenticated:
                logger.warning(f'Unauthorized sale creation attempt by user {user_id}')
                return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

            # Validate sale items
            sale_items = request.data.get('sale_items', [])
            if not sale_items:
                logger.warning('Attempt to create sale with no items')
                raise APIError('Sale must contain at least one item')

            # Start transaction
            with transaction.atomic():
                # Create sale
                sale_data = request.data.copy()
                sale_data['user_id'] = user_id
                sale_serializer = self.get_serializer(data=sale_data)
                if not sale_serializer.is_valid():
                    logger.warning(f'Invalid sale data: {sale_serializer.errors}')
                    raise APIError(sale_serializer.errors)

                sale = sale_serializer.save()

                # Create sale items and update stock
                for item_data in sale_items:
                    product_id = item_data.get('product_id')
                    quantity = item_data.get('quantity')

                    if not product_id or not quantity:
                        logger.warning(f'Missing product_id or quantity in sale item: {item_data}')
                        raise APIError('Invalid sale item data')

                    try:
                        product = Product.objects.get(id=product_id)
                    except Product.DoesNotExist:
                        logger.warning(f'Product not found: {product_id}')
                        raise APIError(f'Product {product_id} not found')

                    if product.quantity < quantity:
                        logger.warning(f'Insufficient stock for product {product_id}')
                        raise APIError(f'Insufficient stock for {product.name}')

                    # Create sale item
                    SaleItem.objects.create(
                        sale=sale,
                        product=product,
                        quantity=quantity,
                        unit_price=product.sell_price,
                        total_price=quantity * product.sell_price
                    )

                    # Update product stock
                    product.quantity -= quantity
                    product.save()

                # Log activity
                Activity.objects.create(
                    type='sale_created',
                    description=f'Sale #{sale.id} created',
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
                
                logger.info(f'Sale #{sale.id} created successfully')
                return Response(sale_serializer.data, status=status.HTTP_201_CREATED)

        except APIError as e:
            logger.error(f'Sale creation error: {str(e)}')
            return Response({"detail": str(e)}, status=e.status_code)
        except ValidationError as e:
            logger.error(f'Validation error in sale creation: {str(e)}')
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f'Unexpected error in sale creation: {str(e)}')
            return Response(
                {"detail": "An unexpected error occurred"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, *args, **kwargs):
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
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        try:
            # Get sale details
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        s.id, s.sale_date,
                        (s.original_amount - COALESCE(s.discount, 0)) as total_amount,
                        s.original_amount,
                        s.discount,
                        s.discount_percentage, s.created_at,
                        COALESCE(u.name, 'Administrator') as cashier_name
                    FROM sales s
                    LEFT JOIN users u ON s.user_id = u.id
                    WHERE s.id = %s
                """, [pk])
                sale_row = cursor.fetchone()
                
                if not sale_row:
                    logger.warning(f'Sale not found: {pk}')
                    return Response(
                        {"detail": "Sale not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                columns = [col[0] for col in cursor.description]
                sale = dict(zip(columns, sale_row))

                # Get sale items
                cursor.execute("""
                    SELECT 
                        si.id, si.quantity, si.unit_price, si.total_price,
                        p.name as product_name, p.sku
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = %s
                """, [pk])
                columns = [col[0] for col in cursor.description]
                items = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format the receipt data
                receipt_data = {
                    'sale': {
                        'id': sale['id'],
                        'sale_date': sale['sale_date'].isoformat() if sale['sale_date'] else None,
                        'total_amount': str(sale['total_amount']),
                        'original_amount': str(sale['original_amount']),
                        'discount': str(sale['discount']),
                        'discount_percentage': str(sale['discount_percentage']),
                        'created_at': sale['created_at'].isoformat() if sale['created_at'] else None,
                        'cashier_name': sale['cashier_name']
                    },
                    'items': [{
                        'id': item['id'],
                        'quantity': item['quantity'],
                        'unit_price': str(item['unit_price']),
                        'total_price': str(item['total_price']),
                        'product_name': item['product_name'],
                        'sku': item['sku']
                    } for item in items]
                }

                return Response(receipt_data)

        except Exception as e:
            logger.error(f"Error generating receipt: {str(e)}")
            return Response(
                {"detail": "Error generating receipt. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def clear_all(self, request):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Start a transaction
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Delete all sale items first
                    cursor.execute("DELETE FROM sale_items")
                    
                    # Delete all sales
                    cursor.execute("DELETE FROM sales")
                    
                    # Delete related activities
                    cursor.execute("DELETE FROM activities WHERE type IN ('sale_created', 'sale_deleted')")
                
                # Create activity log
                Activity.objects.create(
                    type='sales_cleared',
                    description='All sales data has been cleared',
                    user_id=user_id,
                    created_at=timezone.now(),
                    status='completed'
                )
            
            return Response({"message": "All sales data has been cleared successfully"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error clearing sales: {str(e)}")
            return Response(
                {"detail": f"Error clearing sales: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return False, None, False

        token = auth_header.split(' ')[1]
        if not token.startswith('token_'):
            return False, None, False

        try:
            parts = token.split('_')
            user_id = int(parts[1])
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
        except (IndexError, ValueError, Exception) as e:
            print(f"Token validation error: {str(e)}")
            return False, None, False

        return False, None, False

    def list(self, request, *args, **kwargs):
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
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        a.id,
                        a.type,
                        a.description,
                        a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi' as created_at,
                        a.status,
                        u.name as user_name,
                        CASE 
                            WHEN a.type = 'sale' THEN 'sale'
                            WHEN a.type = 'restock' THEN 'restock'
                            WHEN a.type = 'low_stock' THEN 'warning'
                            ELSE 'info'
                        END as activity_type
                    FROM activities a
                    LEFT JOIN users u ON a.user_id = u.id
                    ORDER BY a.created_at DESC
                    LIMIT 50
                """)
                activities = [
                    {
                        **dict(zip([col[0] for col in cursor.description], row)),
                        'created_at': row[3].isoformat() if row[3] else None
                    }
                    for row in cursor.fetchall()
                ]
                return Response(activities)
        except Exception as e:
            print(f"Error in ActivityViewSet list: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, *args, **kwargs):
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
        return super().retrieve(request, *args, **kwargs)


class SaleItemViewSet(viewsets.ModelViewSet):
    queryset = SaleItem.objects.all()
    serializer_class = SaleItemSerializer
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    if len(parts) >= 2:
                        user_id = int(parts[1])
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
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Get sale_id from query params if provided
            sale_id = request.query_params.get('sale_id')
            
            with connection.cursor() as cursor:
                base_query = """
                    SELECT 
                        si.id,
                        si.sale_id,
                        si.product_id,
                        si.quantity,
                        si.unit_price,
                        si.total_price,
                        p.name as product_name,
                        p.sku as product_sku,
                        c.name as category_name
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    LEFT JOIN categories c ON p.category_id = c.id
                """
                
                if sale_id:
                    # If sale_id provided, filter by that sale
                    cursor.execute(base_query + " WHERE si.sale_id = %s ORDER BY si.id", [sale_id])
                else:
                    # Otherwise, get all sale items
                    cursor.execute(base_query + " ORDER BY si.id DESC")
                
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format decimal values and group by sale_id
                grouped_items = {}
                for row in results:
                    sale_id = row['sale_id']
                    if sale_id not in grouped_items:
                        grouped_items[sale_id] = []
                    
                    # Format decimal values
                    for key in ['unit_price', 'total_price']:
                        if key in row and row[key] is not None:
                            row[key] = str(row[key])

                    grouped_items[sale_id].append({
                        'id': row['id'],
                        'product_id': row['product_id'],
                        'quantity': row['quantity'],
                        'unit_price': row['unit_price'],
                        'total_price': row['total_price'],
                        'product_name': row['product_name']
                    })

                return Response(grouped_items)

        except Exception as e:
            print(f"Error in SaleItemViewSet list: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def check_token_auth(request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False, None, False

    token = auth_header.split(' ')[1]
    if not token.startswith('token_'):
        return False, None, False

    try:
        parts = token.split('_')
        user_id = int(parts[1])
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT is_staff, is_superuser, role FROM users WHERE id = %s",
                [user_id]
            )
            row = cursor.fetchone()
            if row:
                is_staff, is_superuser, role = row
                is_admin = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager'])
                return True, user_id, is_admin
    except (IndexError, ValueError) as e:
        print(f"Token validation error: {str(e)}")
        return False, None, False

    return False, None, False


@api_view(['GET'])
def profit_report(request):
    # Validate token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

    token = auth_header.split(' ')[1]
    try:
        # Decode token and get user info
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        
        # Get user role and permissions
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT u.is_staff, u.is_superuser, ur.role 
                FROM users u 
                LEFT JOIN user_roles ur ON u.id = ur.user_id 
                WHERE u.id = %s
            """, [user_id])
            row = cursor.fetchone()
            if not row:
                return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)
            
            is_staff, is_superuser, role = row
            is_admin = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager'])
            if not is_admin:
                return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        # Get date range from query params
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')
        if not start_date or not end_date:
            return Response({"detail": "Date range required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get profit report data with optimized query
        with connection.cursor() as cursor:
            cursor.execute("""
                WITH monthly_data AS (
                    SELECT 
                        DATE_TRUNC('month', s.created_at) as month,
                        COALESCE(SUM(s.total_amount::float), 0) as revenue,
                        COALESCE(SUM(si.quantity * p.buy_price::float), 0) as cost,
                        COALESCE(SUM(s.total_amount::float - (si.quantity * p.buy_price::float)), 0) as profit,
                        COUNT(DISTINCT s.id) as transaction_count,
                        COUNT(DISTINCT si.product_id) as unique_products
                    FROM sales s
                    LEFT JOIN sale_items si ON s.id = si.sale_id
                    LEFT JOIN products p ON si.product_id = p.id
                    WHERE s.created_at BETWEEN %s::timestamp AND %s::timestamp + interval '1 day'
                    GROUP BY DATE_TRUNC('month', s.created_at)
                )
                SELECT 
                    month,
                    revenue,
                    cost,
                    profit,
                    transaction_count,
                    unique_products,
                    CASE 
                        WHEN revenue > 0 THEN ROUND(CAST((profit / revenue * 100) AS DECIMAL(10,2)), 2)
                        ELSE 0 
                    END as profit_margin
                FROM monthly_data
                ORDER BY month DESC
            """, [start_date, end_date])

            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Calculate totals
            total_revenue = sum(float(row['revenue']) for row in results) if results else 0
            total_cost = sum(float(row['cost']) for row in results) if results else 0
            total_profit = sum(float(row['profit']) for row in results) if results else 0
            total_transactions = sum(int(row['transaction_count']) for row in results) if results else 0
            total_margin = round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 0

            # Format response data
            for row in results:
                row['month'] = row['month'].strftime('%Y-%m-%d')
                for key in ['revenue', 'cost', 'profit', 'profit_margin']:
                    if key in row and row[key] is not None:
                        row[key] = str(row[key])

            return Response({
                'summary': {
                    'totalRevenue': str(total_revenue),
                    'totalCost': str(total_cost),
                    'totalProfit': str(total_profit),
                    'totalTransactions': total_transactions,
                    'profitMargin': total_margin
                },
                'monthly': results
            })

    except jwt.InvalidTokenError:
        return Response({"detail": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        print(f"Error generating profit report: {str(e)}")
        return Response({"detail": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RestockRuleViewSet(viewsets.ModelViewSet):
    queryset = RestockRule.objects.all()
    serializer_class = RestockRuleSerializer
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    if len(parts) >= 2:
                        user_id = int(parts[1])
                        # Get user from database to check admin status
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT is_staff, is_superuser, role FROM users WHERE id = %s",
                                [user_id]
                            )
                            row = cursor.fetchone()
                            if row:
                                is_staff, is_superuser, role = row
                                # Allow access if user is staff, superuser, admin, or manager
                                is_authorized = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager'])
                                return True, user_id, is_authorized
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        is_authenticated, user_id, is_authorized = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_authorized:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    if len(parts) >= 2:
                        user_id = int(parts[1])
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
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with connection.cursor() as cursor:
                # Sales analytics
                cursor.execute("""
                    SELECT 
                        COALESCE(SUM(total_amount), 0) as total_sales,
                        COUNT(*) as sales_count,
                        COALESCE(AVG(total_amount), 0) as avg_sale,
                        COALESCE(SUM(si.quantity), 0) as total_items_sold
                    FROM sales s
                    LEFT JOIN sale_items si ON s.id = si.sale_id
                    WHERE s.created_at >= NOW() - INTERVAL '30 days'
                """)
                sales_data = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                # Product analytics with proper low stock calculation
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_products,
                        COUNT(CASE WHEN quantity <= min_stock_level AND quantity > 0 THEN 1 END) as low_stock_count,
                        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count,
                        COALESCE(SUM(quantity * sell_price), 0) as inventory_value
                    FROM products
                """)
                product_data = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                # Get low stock items with proper ordering
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.sku,
                        p.quantity,
                        p.min_stock_level,
                        p.sell_price,
                        c.name as category_name,
                        CASE 
                            WHEN p.quantity = 0 THEN 'Out of Stock'
                            WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                            ELSE 'In Stock'
                        END as status
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.quantity <= p.min_stock_level
                    ORDER BY 
                        CASE 
                            WHEN p.quantity = 0 THEN 1
                            WHEN p.quantity <= p.min_stock_level THEN 2
                            ELSE 3
                        END,
                        p.quantity ASC,
                        p.name ASC
                    LIMIT 10
                """)
                low_stock_items = [
                    {
                        **dict(zip([col[0] for col in cursor.description], row)),
                        'sell_price': str(row[5]) if row[5] is not None else '0.00'
                    }
                    for row in cursor.fetchall()
                ]

                # Recent activities with proper timezone handling and formatting
                cursor.execute("""
                    SELECT 
                        a.id,
                        a.type,
                        a.description,
                        a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi' as created_at,
                        a.status,
                        u.name as user_name,
                        CASE 
                            WHEN a.type = 'sale' THEN 'sale'
                            WHEN a.type = 'restock' THEN 'restock'
                            WHEN a.type = 'low_stock' THEN 'warning'
                            ELSE 'info'
                        END as activity_type
                    FROM activities a
                    LEFT JOIN users u ON a.user_id = u.id
                    WHERE a.created_at >= NOW() - INTERVAL '7 days'
                    ORDER BY a.created_at DESC
                    LIMIT 10
                """)
                activities = [
                    {
                        **dict(zip([col[0] for col in cursor.description], row)),
                        'created_at': row[3].isoformat() if row[3] else None
                    }
                    for row in cursor.fetchall()
                ]

                return Response({
                    'sales': {
                        'total': str(sales_data['total_sales']),
                        'count': sales_data['sales_count'],
                        'average': str(sales_data['avg_sale']),
                        'itemsSold': sales_data['total_items_sold']
                    },
                    'inventory': {
                        'totalProducts': product_data['total_products'],
                        'lowStock': product_data['low_stock_count'],
                        'outOfStock': product_data['out_of_stock_count'],
                        'value': str(product_data['inventory_value'])
                    },
                    'lowStockItems': low_stock_items,
                    'recentActivities': activities
                })
        except Exception as e:
            print(f"Error in analytics: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportViewSet(viewsets.ViewSet):
    permission_classes = []

    def check_token_auth(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token and token.startswith('token_'):
                try:
                    parts = token.split('_')
                    if len(parts) >= 2:
                        user_id = int(parts[1])
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
                except (jwt.InvalidTokenError, IndexError, ValueError, Exception) as e:
                    print(f"Token validation error: {str(e)}")
                    return False, None, False
            return False, None, False

    @action(detail=False, methods=['get'])
    def inventory(self, request):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Get page number from query params, default to 1
            page = int(request.query_params.get('page', 1))
            items_per_page = 6
            offset = (page - 1) * items_per_page

            with connection.cursor() as cursor:
                # Get total count for pagination
                cursor.execute("SELECT COUNT(*) FROM products")
                total_count = cursor.fetchone()[0]
                total_pages = (total_count + items_per_page - 1) // items_per_page

                # Get summary statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_products,
                        COUNT(CASE WHEN quantity <= min_stock_level AND quantity > 0 THEN 1 END) as low_stock_count,
                        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count,
                        COALESCE(SUM(quantity * buy_price), 0) as total_value
                    FROM products
                """)
                summary = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                # Get category breakdown
                cursor.execute("""
                    SELECT 
                        c.name,
                        COUNT(p.id) as product_count,
                        COALESCE(SUM(p.quantity), 0) as total_quantity,
                        COALESCE(SUM(p.quantity * p.buy_price), 0) as value
                    FROM categories c
                    LEFT JOIN products p ON c.id = p.category_id
                    GROUP BY c.id, c.name
                    ORDER BY value DESC
                """)
                categories = [dict(zip([col[0] for col in cursor.description], row))
                              for row in cursor.fetchall()]

                # Get paginated product details
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.sku,
                        p.quantity,
                        p.min_stock_level,
                        p.buy_price,
                        p.sell_price,
                        p.description,
                        c.name as category_name,
                        CASE 
                            WHEN p.quantity = 0 THEN 'Out of Stock'
                            WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                            ELSE 'In Stock'
                        END as status
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    ORDER BY 
                        CASE 
                            WHEN p.quantity = 0 THEN 1
                            WHEN p.quantity <= p.min_stock_level THEN 2
                            ELSE 3
                        END,
                        p.name
                    LIMIT %s OFFSET %s
                """, [items_per_page, offset])
                products = [dict(zip([col[0] for col in cursor.description], row))
                            for row in cursor.fetchall()]

                # Format decimal values
                for row in products:
                    if 'buy_price' in row and row['buy_price'] is not None:
                        row['buy_price'] = str(row['buy_price'])
                    if 'sell_price' in row and row['sell_price'] is not None:
                        row['sell_price'] = str(row['sell_price'])

                return Response({
                    'summary': {
                        'totalProducts': summary['total_products'],
                        'lowStock': summary['low_stock_count'],
                        'outOfStock': summary['out_of_stock_count'],
                        'totalValue': str(summary['total_value'])
                    },
                    'categories': categories,
                    'products': products,
                    'pagination': {
                        'currentPage': page,
                        'totalPages': total_pages,
                        'totalItems': total_count,
                        'itemsPerPage': items_per_page
                    }
                })

        except Exception as e:
            print(f"Error generating inventory report: {str(e)}")
            return Response(
                {"detail": "Error generating inventory report"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def sales_chart(self, request):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Get page number from query params, default to 1
            page = int(request.query_params.get('page', 1))
            items_per_page = 6
            offset = (page - 1) * items_per_page

            with connection.cursor() as cursor:
                # Get total count for pagination
                cursor.execute("""
                    SELECT COUNT(DISTINCT DATE_TRUNC('day', s.created_at)::date)
                    FROM sales s
                    WHERE s.created_at >= NOW() - INTERVAL '30 days'
                """)
                total_count = cursor.fetchone()[0]
                total_pages = (total_count + items_per_page - 1) // items_per_page

                # Get paginated sales data
                cursor.execute("""
                    SELECT 
                        DATE_TRUNC('day', s.created_at)::date as date,
                        COALESCE(SUM(s.total_amount), 0) as amount,
                        COUNT(DISTINCT s.id) as transaction_count,
                        COUNT(DISTINCT si.product_id) as unique_products
                    FROM sales s
                    LEFT JOIN sale_items si ON s.id = si.sale_id
                    WHERE s.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY DATE_TRUNC('day', s.created_at)
                    ORDER BY date DESC
                    LIMIT %s OFFSET %s
                """, [items_per_page, offset])
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format dates and decimal values
                for row in results:
                    if 'date' in row and row['date'] is not None:
                        row['date'] = row['date'].isoformat()
                    if 'amount' in row and row['amount'] is not None:
                        row['amount'] = str(row['amount'])

                return Response({
                    'items': results,
                    'summary': {
                        'totalItems': sum(row['transaction_count'] for row in results),
                        'totalValue': str(sum(float(row['amount']) for row in results))
                    },
                    'pagination': {
                        'currentPage': page,
                        'totalPages': total_pages,
                        'totalItems': total_count,
                        'itemsPerPage': items_per_page
                    }
                })
        except Exception as e:
            print(f"Error in sales_chart: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def profit(self, request):
        is_authenticated, user_id, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            start_date = request.query_params.get('start')
            end_date = request.query_params.get('end')
            if not start_date or not end_date:
                return Response({"detail": "Date range required"}, status=status.HTTP_400_BAD_REQUEST)

            with connection.cursor() as cursor:
                # Get monthly profit data
                cursor.execute("""
                    WITH monthly_data AS (
                        SELECT 
                            DATE_TRUNC('month', s.created_at) as month,
                            COALESCE(SUM(s.total_amount::float), 0) as revenue,
                            COALESCE(SUM(si.quantity * p.buy_price::float), 0) as cost,
                            COALESCE(SUM(s.total_amount::float - (si.quantity * p.buy_price::float)), 0) as profit,
                            COUNT(DISTINCT s.id) as transaction_count,
                            COUNT(DISTINCT si.product_id) as unique_products
                        FROM sales s
                        LEFT JOIN sale_items si ON s.id = si.sale_id
                        LEFT JOIN products p ON si.product_id = p.id
                        WHERE s.created_at BETWEEN %s::timestamp AND %s::timestamp + interval '1 day'
                        GROUP BY DATE_TRUNC('month', s.created_at)
                    )
                    SELECT 
                        month,
                        revenue,
                        cost,
                        profit,
                        transaction_count,
                        unique_products,
                        CASE 
                            WHEN revenue > 0 THEN ROUND(CAST((profit / revenue * 100) AS DECIMAL(10,2)), 2)
                            ELSE 0 
                        END as profit_margin
                    FROM monthly_data
                    ORDER BY month DESC
                """, [start_date, end_date])

                columns = [col[0] for col in cursor.description]
                monthly_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Calculate totals
                total_revenue = sum(float(row['revenue']) for row in monthly_data) if monthly_data else 0
                total_cost = sum(float(row['cost']) for row in monthly_data) if monthly_data else 0
                total_profit = sum(float(row['profit']) for row in monthly_data) if monthly_data else 0
                total_transactions = sum(int(row['transaction_count']) for row in monthly_data) if monthly_data else 0
                total_margin = round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 0

                # Format response data
                for row in monthly_data:
                    row['month'] = row['month'].strftime('%Y-%m-%d')
                    for key in ['revenue', 'cost', 'profit', 'profit_margin']:
                        if key in row and row[key] is not None:
                            row[key] = str(row[key])

                return Response({
                    'summary': {
                        'totalRevenue': str(total_revenue),
                        'totalCost': str(total_cost),
                        'totalProfit': str(total_profit),
                        'totalTransactions': total_transactions,
                        'profitMargin': total_margin
                    },
                    'monthly': monthly_data
                })
        except Exception as e:
            print(f"Error generating profit report: {str(e)}")
            return Response(
                {"detail": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with connection.cursor() as cursor:
                # Get current month stats with proper low stock counting
                cursor.execute("""
                    SELECT 
                        COALESCE((SELECT COUNT(*) FROM products), 0) as total_products,
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM products 
                            WHERE quantity <= min_stock_level 
                            AND quantity > 0
                        ), 0) as low_stock_products,
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM products 
                            WHERE quantity = 0
                        ), 0) as out_of_stock_products,
                        COALESCE((
                            SELECT SUM(total_amount) 
                            FROM sales 
                            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as total_sales,
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM sales 
                            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as total_orders
                """)
                current_stats = cursor.fetchone()

                # Get last month stats for comparison
                cursor.execute("""
                    SELECT 
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM products 
                            WHERE created_at < DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as last_month_products,
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM products 
                            WHERE quantity <= min_stock_level 
                            AND quantity > 0 
                            AND created_at < DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as last_month_low_stock,
                        COALESCE((
                            SELECT SUM(total_amount) 
                            FROM sales 
                            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                            AND created_at < DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as last_month_sales,
                        COALESCE((
                            SELECT COUNT(*) 
                            FROM sales 
                            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                            AND created_at < DATE_TRUNC('month', CURRENT_DATE)
                        ), 0) as last_month_orders
                """)
                last_month_stats = cursor.fetchone()

                if current_stats and last_month_stats:
                    total_products, low_stock_products, out_of_stock_products, total_sales, total_orders = current_stats
                    last_month_products, last_month_low_stock, last_month_sales, last_month_orders = last_month_stats

                    # Calculate percentage changes
                    products_change = ((total_products - last_month_products) / last_month_products * 100) if last_month_products > 0 else 0
                    low_stock_change = ((low_stock_products - last_month_low_stock) / last_month_low_stock * 100) if last_month_low_stock > 0 else 0
                    sales_change = ((total_sales - last_month_sales) / last_month_sales * 100) if last_month_sales > 0 else 0
                    orders_change = ((total_orders - last_month_orders) / last_month_orders * 100) if last_month_orders > 0 else 0

                    return Response({
                        'totalProducts': total_products,
                        'lowStockCount': low_stock_products,
                        'outOfStockCount': out_of_stock_products,
                        'totalSales': float(total_sales),
                        'pendingOrders': total_orders,
                        'compareLastMonth': {
                            'products': round(products_change, 1),
                            'lowStock': round(low_stock_change, 1),
                            'sales': round(sales_change, 1),
                            'orders': round(orders_change, 1)
                        }
                    })
        except Exception as e:
            print(f"Error in stats: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "Error fetching stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def category_chart(self, request):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    WITH category_totals AS (
                        SELECT 
                            c.id,
                            c.name,
                            COALESCE(COUNT(p.id), 0) as product_count,
                            COALESCE(SUM(p.quantity), 0) as total_quantity,
                            COALESCE(SUM(p.quantity * p.sell_price), 0) as total_value
                        FROM categories c
                        LEFT JOIN products p ON c.id = p.category_id
                        GROUP BY c.id, c.name
                    ),
                    total_products AS (
                        SELECT COALESCE(SUM(product_count), 0) as total FROM category_totals
                    )
                    SELECT 
                        id,
                        name,
                        product_count,
                        total_quantity,
                        total_value,
                        CASE 
                            WHEN (SELECT total FROM total_products) > 0 
                            THEN (product_count::float / (SELECT total FROM total_products) * 100)
                            ELSE 0 
                        END as percentage
                    FROM category_totals
                    ORDER BY percentage DESC
                """)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format decimal values
                for row in results:
                    if 'total_value' in row and row['total_value'] is not None:
                        row['total_value'] = str(row['total_value'])
                    if 'percentage' in row and row['percentage'] is not None:
                        row['percentage'] = round(float(row['percentage']), 1)

                return Response(results)
        except Exception as e:
            print(f"Error in category_chart: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
