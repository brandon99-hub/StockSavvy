import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import InventoryList from '../components/inventory/InventoryList';
import AddProductForm from '../components/inventory/AddProductForm';
import RestockRulesManager from '../components/inventory/RestockRulesManager';
import { Product, Category, SyncProgress } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../lib/auth';
import { apiRequest, queryClient } from '../lib/queryClient';
import { ProductBatches } from '../components/inventory/ProductBatches';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { Combobox } from '../components/ui/combobox';
import { Shop } from '../types';
import { Progress } from '../components/ui/progress';
import { Card, CardContent } from '../components/ui/card';
import { useEffect, useCallback } from 'react';

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState<string>('list');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedShop, setSelectedShop] = useState<number | 'all'>('all');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  // Fetch products with server-side pagination and filters
  const { data: productsData = { results: [], total_count: 0, total_pages: 0 }, isLoading: isProductsLoading } = useQuery<{
    results: Product[],
    total_count: number,
    total_pages: number,
    current_page: number
  }>({
    queryKey: ['/api/products', page, searchQuery, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);

      return apiRequest(`/api/products/?${params.toString()}`);
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 1000
  });

  const products = productsData.results;

  // Fetch categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest('/api/categories/'),
  });

  // Fetch low stock products (handling wrapped response)
  const { data: lowStockProductsData = { items: [] }, isLoading: isLowStockLoading } = useQuery<{
    items: Product[],
    summary: any,
    pagination: any
  }>({
    queryKey: ['/api/products/low-stock'],
    queryFn: () => apiRequest('/api/products/low-stock/'),
  });

  const lowStockProducts = lowStockProductsData.items;

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['/api/shops/'],
    queryFn: () => apiRequest('/api/shops/'),
    enabled: user?.role === 'admin'
  });

  const { toast } = useToast();

  // WebSocket for sync progress
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = '8000'; // Backend port
      const wsUrl = `${protocol}//${host}:${port}/ws/sync-progress/`;

      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Sync progress update:', data);
        setSyncProgress(data);

        if (data.status === 'complete') {
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          setTimeout(() => setSyncProgress(null), 3000);
          toast({
            title: "Sync Complete",
            description: "Product inventory has been successfully synchronized.",
          });
        }
      };

      ws.onclose = () => {
        console.log('Sync WebSocket closed. Reconnecting...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('Sync WebSocket error:', err);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [toast]);
  const syncMutation = useMutation({
    mutationFn: () => apiRequest('/api/reports/sync_bc/', { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Sync Successful",
        description: `Created: ${data.created}, Updated: ${data.updated}, Skipped: ${data.skipped}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "An error occurred during synchronization",
        variant: "destructive",
      });
    }
  });

  const isLoading = isProductsLoading || isCategoriesLoading || isLowStockLoading;

  // Handle edit product
  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setActiveTab('add');
  };

  // Handle view batches
  const handleViewBatches = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('batches');
  };

  // Handle cancel
  const handleCancel = () => {
    setEditProduct(null);
    setActiveTab('list');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Inventory Management</h1>
        <div className="flex gap-2 items-center">
          {user?.role === 'admin' && (
            <Combobox
              options={[
                { value: 'all', label: 'All Shops' },
                ...shops.map(shop => ({
                  value: shop.id.toString(),
                  label: shop.name
                }))
              ]}
              value={selectedShop.toString()}
              onValueChange={(v) => setSelectedShop(v === 'all' ? 'all' : parseInt(v))}
              placeholder="Select shop"
              searchPlaceholder="Search shops..."
              className="w-[200px]"
            />
          )}
          {canEdit && (
            <Button
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync with BC'}
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => {
              setEditProduct(null);
              setActiveTab('add');
            }}>
              <i className="fas fa-plus mr-2"></i> Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Sync Progress Overlay */}
      {syncProgress && syncProgress.status === 'syncing' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-blue-100 overflow-hidden">
            <div className="h-1 bg-blue-600 animate-pulse w-full" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 border-none m-0 p-0 text-base leading-tight">Synchronizing Products</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Fetching latest data from Business Central</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-blue-600 leading-none">
                    {Math.round(syncProgress.percentage)}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Progress value={syncProgress.percentage} className="h-2 bg-blue-50" />
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 px-0.5">
                  <span>Processed: {syncProgress.current}</span>
                  <span>Total: {syncProgress.total}</span>
                </div>
              </div>

              {syncProgress.last_product && (
                <div className="bg-gray-50 rounded-md p-3 border border-gray-100 flex items-start gap-3">
                  <Package className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Current Item</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{syncProgress.last_product}</p>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-center text-gray-500 italic">
                Please don't close this window while the sync is in progress...
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Product List</TabsTrigger>
          {canEdit && (
            <TabsTrigger value="add">{editProduct ? 'Edit Product' : 'Add Product'}</TabsTrigger>
          )}
          {canEdit && (
            <TabsTrigger value="restock">Restock Rules</TabsTrigger>
          )}
          {selectedProduct && (
            <TabsTrigger value="batches">Batches</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="list">
          <InventoryList
            products={products}
            categories={categories}
            onEdit={handleEditProduct}
            onViewBatches={handleViewBatches}
            searchQuery={searchQuery}
            onSearch={(q) => {
              setSearchQuery(q);
              setPage(1); // Reset to page 1 on search
            }}
            selectedCategory={selectedCategory}
            onCategoryChange={(c) => {
              setSelectedCategory(c);
              setPage(1); // Reset to page 1 on category change
            }}
            totalCount={productsData.total_count}
            totalPages={productsData.total_pages}
            currentPage={page}
            onPageChange={setPage}
            isLoading={isProductsLoading}
          />
        </TabsContent>
        {canEdit && (
          <TabsContent value="add">
            <AddProductForm
              categories={categories}
              editProduct={editProduct}
              onCancel={handleCancel}
            />
          </TabsContent>
        )}
        {canEdit && (
          <TabsContent value="restock">
            {isLoading ? (
              <div className="text-center py-8">Loading restock data...</div>
            ) : (
              <RestockRulesManager
                products={products}
                lowStockProducts={lowStockProducts}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/restock-rules/'] });
                }}
              />
            )}
          </TabsContent>
        )}
        {selectedProduct && (
          <TabsContent value="batches">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Batches for {selectedProduct.name}</h2>
                <Button onClick={() => setActiveTab('list')}>
                  Back to Products
                </Button>
              </div>
              <ProductBatches productId={selectedProduct.id} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default InventoryPage;
