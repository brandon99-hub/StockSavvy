// @ts-ignore
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import InventoryList from '../components/inventory/InventoryList';
import AddProductForm from '../components/inventory/AddProductForm';
import RestockRulesManager from '../components/inventory/RestockRulesManager';
import { Product, Category } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../lib/auth';

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState<string>('list');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  // Fetch products
  const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/'],
  });

  // Fetch categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories/'],
  });
  
  // Fetch low stock products
  const { data: lowStockProducts = [], isLoading: isLowStockLoading } = useQuery<Product[]>({
    queryKey: ['products/low-stock/'],
  });

  const isLoading = isProductsLoading || isCategoriesLoading || isLowStockLoading;

  // Handle edit product
  const handleEditProduct = (product: Product) => {
    setEditProduct(product);
    setActiveTab('add');
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
          <Button
            onClick={() => setActiveTab('add')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            Add Product
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Products</TabsTrigger>
          {canEdit && (
            <>
              <TabsTrigger value="add">Add/Edit Product</TabsTrigger>
              <TabsTrigger value="restock">Restock Rules</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="list">
          <InventoryList
            products={products}
            onEdit={canEdit ? handleEditProduct : undefined}
            isLoading={isLoading}
          />
        </TabsContent>

        {canEdit && (
          <>
            <TabsContent value="add">
              <AddProductForm
                categories={categories}
                editProduct={editProduct}
                onCancel={handleCancel}
              />
            </TabsContent>
            <TabsContent value="restock">
              <RestockRulesManager />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default InventoryPage;
