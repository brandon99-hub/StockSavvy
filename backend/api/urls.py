from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, CategoryViewSet, ProductViewSet, SaleViewSet,
    ActivityViewSet, RestockRuleViewSet, AnalyticsViewSet,
    DashboardViewSet, ReportViewSet, SaleItemViewSet,
    profit_report, test_connection
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'products', ProductViewSet, basename='products')
router.register(r'sales', SaleViewSet, basename='sales')
router.register(r'activities', ActivityViewSet, basename='activities')
router.register(r'restock-rules', RestockRuleViewSet, basename='restock-rules')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'reports', ReportViewSet, basename='reports')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'sales-items', SaleItemViewSet, basename='sale-items')

urlpatterns = [
    path('', include(router.urls)),
    path('test/', test_connection),
    path('reports/profit/', profit_report, name='profit-report'),
    path('products/low-stock/', ProductViewSet.as_view({'get': 'low_stock'}), name='low-stock-products'),
    path('dashboard/stats/', DashboardViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
    path('dashboard/category-chart/', DashboardViewSet.as_view({'get': 'category_chart'}), name='dashboard-category-chart'),
    path('dashboard/sales-chart/', DashboardViewSet.as_view({'get': 'sales_chart'}), name='dashboard-sales-chart'),
] 