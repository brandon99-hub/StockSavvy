// @ts-ignore
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import SalesList from '../components/sales/SalesList';
import CreateSaleForm from '../components/sales/CreateSaleForm';
import { Sale, SaleItem, Product, User, Customer } from '../types';
import { useAuth } from '../lib/auth';
import { apiRequest } from '../lib/queryClient';

const SalesPage = () => {
  const [activeTab, setActiveTab] = useState<string>('list');
  const { user } = useAuth();
  const canCreateSale = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff';

  const queryClient = useQueryClient();

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
  const { data: productsData, isLoading: isProductsLoading, refetch: refetchProducts } = useQuery<any>({
    queryKey: ['/api/products/'],
    queryFn: () => apiRequest('/api/products/'),
    // Refetch every 5 seconds to ensure we have the latest prices
    refetchInterval: 5000,
    // Also refetch when the window regains focus
    refetchOnWindowFocus: true,
    // Don't cache the data for too long
    staleTime: 1000
  });

  const products = Array.isArray(productsData) ? productsData : (productsData?.results || []);

  // Fetch users for user lookup
  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/'],
    queryFn: () => apiRequest('/api/users/')
  });

  // Fetch customers
  const { data: customers = [], isLoading: isCustomersLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers/'],
    queryFn: () => apiRequest('/api/customers/')
  });

  const isLoading = isSalesLoading || isSaleItemsLoading || isProductsLoading || isUsersLoading || isCustomersLoading;

  // Convert products and users arrays to objects for easier lookup
  const productsMap = products.reduce((acc: Record<number, Product>, product: Product) => {
    acc[product.id] = product;
    return acc;
  }, {} as Record<number, Product>);

  const usersMap = users.reduce((acc: Record<number, User>, user: User) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<number, User>);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'create') {
      refetchProducts();
    }
  };

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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
            <CreateSaleForm products={products} customers={customers} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SalesPage;
