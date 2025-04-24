import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import InventoryList from '../components/inventory/InventoryList';
import AddProductForm from '../components/inventory/AddProductForm';
import RestockRulesManager from '../components/inventory/RestockRulesManager';
import { Product, Category } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../lib/auth';
import { apiRequest } from '../lib/queryClient';
import { ProductBatches } from '../components/inventory/ProductBatches';

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState<string>('list');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  // Fetch products
  const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: () => apiRequest('/api/products/'),
    // Refetch every 5 seconds to ensure we have the latest prices
    refetchInterval: 5000,
    // Also refetch when the window regains focus
    refetchOnWindowFocus: true,
    // Don't cache the data for too long
    staleTime: 1000
  });

  // Fetch categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest('/api/categories/'),
  });

  // Fetch low stock products
  const { data: lowStockProducts = [], isLoading: isLowStockLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/low-stock'],
    queryFn: () => apiRequest('/api/products/low-stock/'),
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
        {canEdit && (
          <Button onClick={() => {
            setEditProduct(null);
            setActiveTab('add');
          }}>
            <i className="fas fa-plus mr-2"></i> Add Product
          </Button>
        )}
      </div>

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
          {isLoading ? (
            <div className="text-center py-8">Loading inventory data...</div>
          ) : (
            <InventoryList 
              products={products} 
              categories={categories} 
              onEdit={handleEditProduct}
              onViewBatches={handleViewBatches}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          )}
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
