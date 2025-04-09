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

User = get_user_model()


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

            # Use Django's authenticate
            user = authenticate(request, username=username, password=password)

            if user is not None:
                # Generate token and return user data
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'role': user.role,
                    'is_active': user.is_active,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'name': user.name,
                    'token': f"token_{user.id}_{user.username}"
                }
                # Log activity (your existing code)
                return Response(user_data)
            else:
                return Response(
                    {'message': 'Invalid credentials'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        except Exception as e:
            print(f"Login error: {str(e)}")
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
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response({"message": "User deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Error deleting user: {str(e)}"},
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


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
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
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
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

    def update(self, request, *args, **kwargs):
        is_authenticated, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        is_authenticated, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.sku,
                        p.quantity,
                        p.min_stock_level,
                        p.sell_price,
                        c.name as category_name,
                        COALESCE(SUM(si.quantity), 0) as total_sold,
                        p.quantity <= p.min_stock_level as is_low_stock,
                        p.quantity = 0 as is_out_of_stock,
                        CASE 
                            WHEN p.quantity = 0 THEN 'Out of Stock'
                            WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                            ELSE 'Normal'
                        END as stock_status,
                        CASE
                            WHEN p.quantity = 0 THEN 'critical'
                            WHEN p.quantity <= p.min_stock_level THEN 'warning'
                            ELSE 'normal'
                        END as status_level
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN sale_items si ON p.id = si.product_id
                    WHERE p.quantity <= p.min_stock_level
                    GROUP BY 
                        p.id, p.name, p.sku, p.quantity, p.min_stock_level,
                        p.sell_price, c.name
                    ORDER BY 
                        p.quantity = 0 DESC,
                        p.quantity ASC,
                        p.name ASC
                """)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format decimal values
                for row in results:
                    if 'sell_price' in row and row['sell_price'] is not None:
                        row['sell_price'] = str(row['sell_price'])

                return Response({
                    'items': results,
                    'summary': {
                        'total': len(results),
                        'outOfStock': sum(1 for item in results if item['is_out_of_stock']),
                        'lowStock': sum(1 for item in results if item['is_low_stock'] and not item['is_out_of_stock'])
                    }
                })
        except Exception as e:
            print(f"Error in low_stock: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        is_authenticated, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        product = self.get_object()
        quantity = request.data.get('quantity', 0)

        if quantity <= 0:
            return Response(
                {'message': 'Quantity must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )

        product.stock_quantity += quantity
        product.save()

        # Create activity log
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO activities (type, description, user_id, created_at, status) VALUES (%s, %s, %s, NOW(), %s)",
                    ['restock', f'Restocked {quantity} units of {product.name}', request.user.id, 'success']
                )
        except Exception as e:
            print(f"Could not create activity: {str(e)}")

        return Response(ProductSerializer(product).data)


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
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
                    return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
        except (IndexError, ValueError, Exception) as e:
            print(f"Token validation error: {str(e)}")
            return False, None, False

        return False, None, False

    def list(self, request, *args, **kwargs):
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
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        is_authenticated, user_id, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        now = timezone.now()

        try:
            # Get username from token
            token = request.headers.get('Authorization').split(' ')[1]
            username = token.split('_')[2]  # token format is token_userid_username

            # Get the user instance by username
            user = User.objects.get_by_natural_key(username)

            # Create the sale
            sale = Sale.objects.create(
                user_id=user.id,
                sale_date=now,
                created_at=now,
                total_amount=float(data.get('totalAmount', 0)),
                discount=float(data.get('discount', 0)),
                discount_percentage=float(data.get('discountPercentage', 0)),
                original_amount=float(data.get('originalAmount', 0))
            )

            # Create sale items and track total items
            items_data = data.get('items', [])
            total_items = 0

            for item_data in items_data:
                product = Product.objects.get(id=item_data.get('id'))
                quantity = int(item_data['quantity'])
                unit_price = float(item_data.get('unitPrice', 0))
                total_price = float(item_data.get('totalPrice', quantity * unit_price))

                total_items += quantity

                # Create sale item
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price
                )

                # Update product quantity
                product.quantity = F('quantity') - quantity
                product.updated_at = now
                product.save()

                # Log activity for each item
                Activity.objects.create(
                    type='sale',
                    description=f'Sold {quantity} {product.name}(s)',
                    product=product,
                    user=user,
                    created_at=now,
                    status='success'
                )

                # Check if product is low on stock after sale
                if product.quantity <= product.min_stock_level:
                    Activity.objects.create(
                        type='low_stock',
                        description=f'Low stock alert: {product.name} ({product.quantity} remaining)',
                        product=product,
                        user=user,
                        created_at=now,
                        status='warning'
                    )

            # Create a summary activity
            Activity.objects.create(
                type='sale',
                description=f'Created sale #{sale.id} with {total_items} items for KSh {sale.total_amount}',
                user=user,
                created_at=now,
                status='success'
            )

            return Response(SaleSerializer(sale).data)

        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
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
                    return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
        except (IndexError, ValueError, Exception) as e:
            print(f"Token validation error: {str(e)}")
            return False, None, False

        return False, None, False

    def list(self, request, *args, **kwargs):
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
        return super().list(request, *args, **kwargs)


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
                                return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    WITH sale_details AS (
                        SELECT 
                            si.id,
                            si.sale_id,
                            si.product_id,
                            si.quantity,
                            si.unit_price,
                            si.total_price,
                            p.name as product_name,
                            p.sku as product_sku,
                            c.name as category_name,
                            s.created_at as sale_date,
                            s.total_amount as sale_total,
                            u.username as sold_by
                        FROM sale_items si
                        JOIN products p ON si.product_id = p.id
                        LEFT JOIN categories c ON p.category_id = c.id
                        JOIN sales s ON si.sale_id = s.id
                        LEFT JOIN users u ON s.user_id = u.id
                    )
                    SELECT 
                        *,
                        COUNT(*) OVER() as total_count,
                        SUM(total_price) OVER() as total_value
                    FROM sale_details
                    ORDER BY sale_date DESC
                """)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format decimal values and dates
                for row in results:
                    for key, value in row.items():
                        if isinstance(value, (datetime.date, datetime.datetime)):
                            row[key] = value.isoformat()
                        elif isinstance(value, decimal.Decimal):
                            row[key] = str(value)

                if not results:
                    return Response({
                        'items': [],
                        'summary': {
                            'totalItems': 0,
                            'totalValue': '0.00'
                        }
                    })

                return Response({
                    'items': [{k: v for k, v in row.items() if k not in ['total_count', 'total_value']}
                              for row in results],
                    'summary': {
                        'totalItems': results[0]['total_count'],
                        'totalValue': str(results[0]['total_value'])
                    }
                })

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
                # Match exactly how ViewSets check admin status
                is_admin = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager'])
                return True, user_id, is_admin
    except (IndexError, ValueError) as e:
        print(f"Token validation error: {str(e)}")
        return False, None, False

    return False, None, False


@api_view(['GET'])
def profit_report(request):
    # Validate token once at the start
    is_authenticated, user_id, is_admin = check_token_auth(request)
    if not is_authenticated:
        return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
    if not is_admin:
        return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    try:
        # Get date range from query params
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')

        date_filter = ""
        params = []
        if start_date and end_date:
            date_filter = """
                WHERE s.created_at >= %s::timestamp
                AND s.created_at <= %s::timestamp + interval '1 day'
            """
            params = [start_date, end_date]
        else:
            date_filter = "WHERE s.created_at >= DATE_TRUNC('month', CURRENT_DATE)"

        # Get profit report data
        with connection.cursor() as cursor:
            cursor.execute(f"""
                WITH monthly_data AS (
                    SELECT 
                        DATE_TRUNC('month', s.created_at) as month,
                        COALESCE(SUM(s.total_amount::float), 0) as revenue,
                        COALESCE(SUM(si.quantity * p.buy_price::float), 0) as cost,
                        COALESCE(SUM(s.total_amount - si.quantity * p.buy_price)::float, 0) as profit,
                        COUNT(DISTINCT s.id) as total_sales,
                        COALESCE(SUM(si.quantity), 0) as total_items_sold
                    FROM sales s
                    LEFT JOIN sale_items si ON s.id = si.sale_id
                    LEFT JOIN products p ON si.product_id = p.id
                    {date_filter}
                    GROUP BY DATE_TRUNC('month', s.created_at)
                )
                SELECT 
                    month,
                    revenue,
                    cost,
                    profit,
                    total_sales,
                    total_items_sold,
                    CASE 
                        WHEN revenue > 0 THEN CAST((profit / revenue * 100) AS DECIMAL(10,2))
                        ELSE 0 
                    END as profit_margin
                FROM monthly_data
                ORDER BY month DESC
            """, params)

            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Calculate totals
            total_revenue = sum(float(row['revenue']) for row in results) if results else 0
            total_cost = sum(float(row['cost']) for row in results) if results else 0
            total_profit = sum(float(row['profit']) for row in results) if results else 0
            total_margin = round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 0

            # Format values
            for row in results:
                row['month'] = row['month'].strftime('%Y-%m-%d')
                for key in ['revenue', 'cost', 'profit']:
                    if key in row and row[key] is not None:
                        row[key] = str(row[key])

            return Response({
                'summary': {
                    'totalRevenue': str(total_revenue),
                    'totalCost': str(total_cost),
                    'totalProfit': str(total_profit),
                    'profitMargin': total_margin
                },
                'monthly': results
            })

    except Exception as e:
        print(f"Error in profit_report: {str(e)}")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
                                return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def list(self, request, *args, **kwargs):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
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
                                return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
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

                # Product analytics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_products,
                        COUNT(CASE WHEN quantity <= min_stock_level THEN 1 END) as low_stock_count,
                        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count,
                        COALESCE(SUM(quantity * sell_price), 0) as inventory_value
                    FROM products
                """)
                product_data = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                # Recent activities with proper timezone handling and formatting
                cursor.execute("""
                    SELECT 
                        a.id,
                        a.type,
                        a.description,
                        a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi' as created_at,
                        a.status,
                        u.username as user_name,
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
                    'recentActivities': activities
                })
        except Exception as e:
            print(f"Error in analytics: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportViewSet(viewsets.ViewSet):
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
                    return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
        except (IndexError, ValueError) as e:
            print(f"Token validation error: {str(e)}")
            return False, None, False

        return False, None, False

    def list(self, request):
        is_authenticated, _, is_admin = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        report_type = request.query_params.get('type', 'inventory')
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')

        try:
            with connection.cursor() as cursor:
                if report_type == 'inventory':
                    # First get the summary counts
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as total_products,
                            COUNT(CASE WHEN quantity <= min_stock_level AND quantity > 0 THEN 1 END) as low_stock_count,
                            COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count,
                            COALESCE(SUM(quantity * sell_price), 0) as total_value
                        FROM products
                    """)
                    summary = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                    # Get category breakdown
                    cursor.execute("""
                        SELECT 
                            c.name as category,
                            COUNT(p.id) as product_count,
                            COALESCE(SUM(p.quantity), 0) as total_quantity,
                            COALESCE(SUM(p.quantity * p.sell_price), 0) as value,
                            CAST(
                                (COUNT(p.id)::float * 100 / NULLIF((SELECT COUNT(*) FROM products), 0)) 
                                AS DECIMAL(10,1)
                            ) as percentage
                        FROM categories c
                        LEFT JOIN products p ON c.id = p.category_id
                        GROUP BY c.name
                        HAVING COUNT(p.id) > 0
                        ORDER BY COUNT(p.id) DESC
                    """)
                    categories = [dict(zip([col[0] for col in cursor.description], row))
                                  for row in cursor.fetchall()]

                    # Get product details
                    cursor.execute("""
                        SELECT 
                            p.id,
                            p.name,
                            p.sku,
                            p.quantity as current_stock,
                            p.min_stock_level,
                            p.buy_price,
                            p.sell_price,
                            c.name as category,
                            CASE 
                                WHEN p.quantity = 0 THEN 'Out of Stock'
                                WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                                ELSE 'Normal'
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
                    """)
                    products = [dict(zip([col[0] for col in cursor.description], row))
                                for row in cursor.fetchall()]

                    # Format decimal values
                    for product in products:
                        for key in ['buy_price', 'sell_price']:
                            if key in product and product[key] is not None:
                                product[key] = str(product[key])

                    return Response({
                        'summary': {
                            'totalProducts': summary['total_products'],
                            'lowStock': summary['low_stock_count'],
                            'outOfStock': summary['out_of_stock_count'],
                            'totalValue': str(summary['total_value'])
                        },
                        'categories': categories,
                        'products': products
                    })

                elif report_type == 'sales':
                    date_filter = ""
                    params = []
                    if start_date and end_date:
                        date_filter = """
                            WHERE s.created_at >= %s::timestamp
                            AND s.created_at <= %s::timestamp + interval '1 day'
                        """
                        params = [start_date, end_date]
                    else:
                        # Default to current month if no date range specified
                        date_filter = "WHERE s.created_at >= DATE_TRUNC('month', CURRENT_DATE)"

                    # Get sales summary
                    cursor.execute(f"""
                        WITH sales_summary AS (
                            SELECT 
                                COALESCE(SUM(s.total_amount), 0) as total_sales,
                                COUNT(DISTINCT s.id) as total_transactions,
                                COALESCE(AVG(s.total_amount), 0) as avg_sale,
                                COALESCE(SUM(si.quantity), 0) as total_items
                            FROM sales s
                            LEFT JOIN sale_items si ON s.id = si.sale_id
                            {date_filter}
                        )
                        SELECT 
                            total_sales,
                            total_transactions,
                            avg_sale,
                            total_items
                        FROM sales_summary
                    """, params)
                    summary = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))

                    # Get sales details
                    cursor.execute(f"""
                        SELECT 
                            s.id,
                            s.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi' as created_at,
                            s.total_amount::float,
                            s.original_amount::float,
                            s.discount::float,
                            u.username as sold_by,
                            COUNT(si.id) as items_count,
                            SUM(si.quantity) as total_items,
                            STRING_AGG(
                                CONCAT(p.name, ' (', si.quantity, ' @ ', si.unit_price::float, ')'),
                                ', '
                            ) as items_list
                        FROM sales s
                        LEFT JOIN sale_items si ON s.id = si.sale_id
                        LEFT JOIN products p ON si.product_id = p.id
                        LEFT JOIN users u ON s.user_id = u.id
                        {date_filter}
                        GROUP BY s.id, s.created_at, s.total_amount, s.original_amount, 
                                s.discount, u.username
                        ORDER BY s.created_at DESC
                    """, params)

                    sales = [dict(zip([col[0] for col in cursor.description], row))
                             for row in cursor.fetchall()]

                    # Format dates and decimal values
                    for sale in sales:
                        if 'created_at' in sale:
                            sale['created_at'] = sale['created_at'].isoformat()
                        for key in ['total_amount', 'original_amount', 'discount']:
                            if key in sale and sale[key] is not None:
                                sale[key] = str(sale[key])

                    return Response({
                        'summary': {
                            'totalSales': str(summary['total_sales']),
                            'totalTransactions': summary['total_transactions'],
                            'averageSale': str(summary['avg_sale']),
                            'totalItems': summary['total_items']
                        },
                        'sales': sales
                    })

        except Exception as e:
            print(f"Error in reports: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def sales_chart(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        DATE_TRUNC('day', s.created_at)::date as date,
                        COALESCE(SUM(s.total_amount), 0) as amount
                    FROM sales s
                    WHERE s.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY DATE_TRUNC('day', s.created_at)
                    ORDER BY date ASC
                """)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
                return Response(results)
        except Exception as e:
            print(f"Error in sales_chart: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    WITH low_stock_items AS (
                        SELECT 
                            p.id,
                            p.name,
                            p.sku,
                            p.quantity as current_stock,
                            p.min_stock_level,
                            p.sell_price,
                            c.name as category_name,
                            COALESCE(SUM(si.quantity), 0) as total_sold,
                            p.quantity = 0 as is_out_of_stock,
                            CASE 
                                WHEN p.quantity = 0 THEN 'Out of Stock'
                                WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                                ELSE 'Normal'
                            END as status,
                            CASE
                                WHEN p.quantity = 0 THEN 'critical'
                                WHEN p.quantity <= p.min_stock_level THEN 'warning'
                                ELSE 'normal'
                            END as severity
                        FROM products p
                        LEFT JOIN categories c ON p.category_id = c.id
                        LEFT JOIN sale_items si ON p.id = si.product_id
                        WHERE p.quantity <= p.min_stock_level
                        GROUP BY 
                            p.id, p.name, p.sku, p.quantity, p.min_stock_level,
                            p.sell_price, c.name
                    )
                    SELECT 
                        *,
                        (
                            SELECT COUNT(*) 
                            FROM low_stock_items 
                            WHERE status = 'Out of Stock'
                        ) as out_of_stock_count,
                        (
                            SELECT COUNT(*) 
                            FROM low_stock_items 
                            WHERE status = 'Low Stock'
                        ) as low_stock_count
                    FROM low_stock_items
                    ORDER BY 
                        is_out_of_stock DESC,
                        current_stock ASC,
                        name ASC
                """)

                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format decimal values
                for row in results:
                    if 'sell_price' in row and row['sell_price'] is not None:
                        row['sell_price'] = str(row['sell_price'])

                if not results:
                    return Response({
                        'items': [],
                        'summary': {
                            'total': 0,
                            'outOfStock': 0,
                            'lowStock': 0
                        }
                    })

                return Response({
                    'items': [{k: v for k, v in row.items() if k not in ['out_of_stock_count', 'low_stock_count']}
                              for row in results],
                    'summary': {
                        'total': len(results),
                        'outOfStock': results[0]['out_of_stock_count'],
                        'lowStock': results[0]['low_stock_count']
                    }
                })

        except Exception as e:
            print(f"Error in low_stock: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DashboardViewSet(viewsets.ViewSet):
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
                                return True, user_id, is_staff or is_superuser or role in ['admin', 'manager']
                except (IndexError, ValueError) as e:
                    print(f"Token validation error: {str(e)}")
                    pass
        return False, None, False

    def stats(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            with connection.cursor() as cursor:
                # Get current month stats
                cursor.execute("""
                    SELECT 
                        COALESCE((SELECT COUNT(*) FROM products), 0) as total_products,
                        COALESCE((SELECT COUNT(*) FROM products WHERE quantity <= min_stock_level), 0) as low_stock_products,
                        COALESCE((SELECT SUM(total_amount) FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as total_sales,
                        COALESCE((SELECT COUNT(*) FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as total_orders
                """)
                current_stats = cursor.fetchone()

                # Get last month stats for comparison
                cursor.execute("""
                    SELECT 
                        COALESCE((SELECT COUNT(*) FROM products WHERE created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as last_month_products,
                        COALESCE((SELECT COUNT(*) FROM products WHERE quantity <= min_stock_level AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as last_month_low_stock,
                        COALESCE((SELECT SUM(total_amount) FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as last_month_sales,
                        COALESCE((SELECT COUNT(*) FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as last_month_orders
                """)
                last_month_stats = cursor.fetchone()

                if current_stats and last_month_stats:
                    total_products, low_stock_products, total_sales, total_orders = current_stats
                    last_month_products, last_month_low_stock, last_month_sales, last_month_orders = last_month_stats

                    # Calculate percentage changes
                    products_change = ((
                                               total_products - last_month_products) / last_month_products * 100) if last_month_products > 0 else 0
                    low_stock_change = ((
                                                low_stock_products - last_month_low_stock) / last_month_low_stock * 100) if last_month_low_stock > 0 else 0
                    sales_change = ((
                                            total_sales - last_month_sales) / last_month_sales * 100) if last_month_sales > 0 else 0
                    orders_change = ((
                                             total_orders - last_month_orders) / last_month_orders * 100) if last_month_orders > 0 else 0

                    return Response({
                        'totalProducts': total_products,
                        'lowStockCount': low_stock_products,
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

    def category_chart(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

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

    def sales_chart(self, request):
        is_authenticated, _, _ = self.check_token_auth(request)
        if not is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        DATE_TRUNC('day', s.created_at)::date as date,
                        COALESCE(SUM(s.total_amount), 0) as amount
                    FROM sales s
                    WHERE s.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY DATE_TRUNC('day', s.created_at)
                    ORDER BY date ASC
                """)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]

                # Format dates and decimal values
                for row in results:
                    if 'date' in row and row['date'] is not None:
                        row['date'] = row['date'].isoformat()
                    if 'amount' in row and row['amount'] is not None:
                        row['amount'] = str(row['amount'])

                return Response(results)
        except Exception as e:
            print(f"Error in sales_chart: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
