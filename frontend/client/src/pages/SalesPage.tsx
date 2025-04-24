// @ts-ignore
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import SalesList from '../components/sales/SalesList';
import CreateSaleForm from '../components/sales/CreateSaleForm';
import { Sale, SaleItem, Product, User } from '../types';
import { useAuth } from '../lib/auth';
import { apiRequest } from '../lib/queryClient';

const SalesPage = () => {
  const [activeTab, setActiveTab] = useState<string>('list');
  const { user } = useAuth();
  const canCreateSale = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff';

  // Fetch sales
  const { data: sales = [], isLoading: isSalesLoading } = useQuery<Sale[]>({
    queryKey: ['/api/sales/'],
    queryFn: () => apiRequest('/api/sales/')
  });

  // Fetch sale items
  const { data: saleItems = {}, isLoading: isSaleItemsLoading } = useQuery<Record<number, SaleItem[]>>({
    queryKey: ['/api/sales-items/'],
    queryFn: () => apiRequest('/api/sales-items/')
  });

  // Fetch products for product lookup
  const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/'],
    queryFn: () => apiRequest('/api/products/'),
    // Refetch every 5 seconds to ensure we have the latest prices
    refetchInterval: 5000,
    // Also refetch when the window regains focus
    refetchOnWindowFocus: true,
    // Don't cache the data for too long
    staleTime: 1000
  });

  // Fetch users for user lookup
  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/'],
    queryFn: () => apiRequest('/api/users/')
  });

  const isLoading = isSalesLoading || isSaleItemsLoading || isProductsLoading || isUsersLoading;

  // Convert products and users arrays to objects for easier lookup
  const productsMap = products.reduce((acc, product) => {
    acc[product.id] = product;
    return acc;
  }, {} as Record<number, Product>);

  const usersMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<number, User>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Sales Management</h1>
        {canCreateSale && (
          <Button onClick={() => setActiveTab('create')}>
            <i className="fas fa-plus mr-2"></i> Create Sale
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Sales History</TabsTrigger>
          {canCreateSale && (
            <TabsTrigger value="create">Create Sale</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="list">
          {isLoading ? (
            <div className="text-center py-8">Loading sales data...</div>
          ) : (
            <SalesList 
              sales={sales} 
              saleItems={saleItems} 
              products={productsMap}
              users={usersMap}
            />
          )}
        </TabsContent>
        {canCreateSale && (
          <TabsContent value="create">
            <CreateSaleForm products={products} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SalesPage;
