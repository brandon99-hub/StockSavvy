from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, CategoryViewSet, ProductViewSet, SaleViewSet,
    ActivityViewSet, RestockRuleViewSet, AnalyticsViewSet,
    ReportViewSet, SaleItemViewSet,
    profit_report, test_connection, get_product_forecasts, all_product_forecasts
)
from .batch_views import ProductBatchViewSet, BatchSaleItemViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'products', ProductViewSet, basename='products')
router.register(r'sales', SaleViewSet, basename='sales')
router.register(r'activities', ActivityViewSet, basename='activities')
router.register(r'restock-rules', RestockRuleViewSet, basename='restock-rules')
router.register(r'analytics', AnalyticsViewSet, basename='analytics')
router.register(r'reports', ReportViewSet, basename='reports')
router.register(r'sales-items', SaleItemViewSet, basename='sale-items')
router.register(r'product-batches', ProductBatchViewSet)
router.register(r'batch-sale-items', BatchSaleItemViewSet)

urlpatterns = [
    path('test/', test_connection),
    path('reports/profit/', profit_report, name='profit-report'),
    path('reports/inventory/', ReportViewSet.as_view({'get': 'inventory'}), name='inventory-report'),
    path('reports/sales/', ReportViewSet.as_view({'get': 'sales_chart'}), name='sales-report'),
    path('products/low-stock/', ProductViewSet.as_view({'get': 'low_stock'}), name='low-stock-products'),
    path('dashboard/stats/', ReportViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
    path('dashboard/category-chart/', ReportViewSet.as_view({'get': 'category_chart'}), name='dashboard-category-chart'),
    path('dashboard/sales-chart/', ReportViewSet.as_view({'get': 'sales_chart'}), name='dashboard-sales-chart'),
    path('dashboard/top-products/', ReportViewSet.as_view({'get': 'top_products'}), name='dashboard-top-products'),
    path('products/<int:pk>/reorder/', ProductViewSet.as_view({'post': 'restock'}), name='product-restock'),
    path('products/<int:product_id>/forecasts/', get_product_forecasts, name='product-forecasts'),
    path('forecasts/', all_product_forecasts, name='all-product-forecasts'),
    path('', include(router.urls)),
]
