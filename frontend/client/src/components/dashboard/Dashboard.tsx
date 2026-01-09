// @ts-ignore
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Product, Activity, Category, Shop } from "../../types";
import StatCard from "./StatCard";
import SalesChart from "./SalesChart";
import CategoryChart from "./CategoryChart";
import LowStockTable from "./LowStockTable";
import RecentActivityTable from "./RecentActivityTable";
import { Skeleton } from "../ui/skeleton";
import { apiRequest } from "../../lib/queryClient";
import { Loader2, LineChart, Store } from "lucide-react";
import { Button } from "../ui/button";
import { Combobox } from "../ui/combobox";
import apiClient from '../../lib/api';
import { Forecast } from '../../types/forecast';
import { useAuth } from "../../lib/auth";

// Response type interfaces
interface LowStockResponse {
    items: Product[];
    summary: {
        total: number;
        outOfStock: number;
        lowStock: number;
    };
}

interface SalesChartData {
    date: string;
    amount: number;
}

interface CategoryChartData {
    id: number;
    name: string;
    percentage: number;
    value: number;
}

interface DashboardStats {
    totalProducts: number;
    totalStockQuantity: number;
    lowStockCount: number;
    totalSales: number;
    pendingOrders: number;
    compareLastMonth: {
        products: number;
        lowStock: number;
        sales: number;
        orders: number;
    };
}

const Dashboard = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [view, setView] = useState<'day' | 'week' | 'month'>('day');
    const [topForecasts, setTopForecasts] = useState<{ product: string; sku: string; forecast: number }[]>([]);
    const [selectedShop, setSelectedShop] = useState<number | 'all'>(user?.shop || 'all');
    const [isSyncing, setIsSyncing] = useState(false);

    const isAdmin = user?.role === 'admin' || user?.can_access_all_shops;

    // Fetch shops (for admin)
    const { data: shops = [] } = useQuery<Shop[]>({
        queryKey: ['/api/shops/'],
        queryFn: () => apiRequest('/api/shops/'),
        enabled: isAdmin,
    });

    // Dashboard stats query
    const { data: stats, isLoading: isStatsLoading } = useQuery<DashboardStats>({
        queryKey: ["dashboard", "stats", selectedShop],
        queryFn: () => apiRequest(`/api/dashboard/stats/?shop=${selectedShop}`),
        refetchInterval: 60000,
    });


    // Low stock products query
    const { data: lowStockData, isLoading: isLowStockLoading } =
        useQuery<LowStockResponse>({
            queryKey: ["dashboard", "low-stock", selectedShop],
            queryFn: async () => {
                const response = await apiRequest(`/api/products/low-stock/?shop=${selectedShop}`);
                if (response && response.items) {
                    return response as LowStockResponse;
                }
                // Fallback for backward compatibility
                return {
                    items: Array.isArray(response) ? response : [],
                    summary: {
                        total: Array.isArray(response) ? response.length : 0,
                        outOfStock: 0,
                        lowStock: 0
                    }
                };
            }
        });

    // Categories query
    const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
        queryKey: ["dashboard", "categories"],
        queryFn: () => apiRequest('/api/categories/'),
        staleTime: 300000 // Categories don't change often
    });

    // Sales chart data query
    const { data: salesData = [], isLoading: isSalesDataLoading } = useQuery<SalesChartData[]>({
        queryKey: ["dashboard", "sales-chart", selectedShop],
        queryFn: async () => {
            try {
                const response = await apiRequest(`/api/dashboard/sales-chart/?shop=${selectedShop}`);
                const salesArray = response?.items || [];

                if (!Array.isArray(salesArray)) {
                    console.error('Sales data structure:', response);
                    return [];
                }

                return salesArray.map(item => ({
                    date: new Date(item.date).toISOString(),
                    amount: parseFloat(item.amount) || 0
                })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            } catch (error) {
                console.error('Error fetching sales data:', error);
                return [];
            }
        },
        refetchInterval: 60000,
        staleTime: 55000
    });

    // Category chart data query
    const { data: categoryData = [], isLoading: isCategoryDataLoading } = useQuery<CategoryChartData[]>({
        queryKey: ["dashboard", "category-chart", selectedShop],
        queryFn: async () => {
            try {
                const response = await apiRequest(`/api/dashboard/category-chart/?shop=${selectedShop}`);
                console.log('Raw Category API response:', JSON.stringify(response, null, 2));

                if (!Array.isArray(response)) {
                    console.error('Category data is not an array:', response);
                    return [];
                }

                // Transform the data to match the CategoryChartData interface
                const validCategories = response.map(item => ({
                    id: item.id,
                    name: item.name,
                    value: parseFloat(item.total_value) || 0,
                    percentage: item.percentage || 0
                }));

                console.log('Processed category data:', validCategories);
                return validCategories;
            } catch (error) {
                console.error('Error fetching category data:', error);
                return [];
            }
        },
        refetchInterval: 60000,
        staleTime: 55000
    });

    // Recent activities query
    const { data: activities = [], isLoading: isActivitiesLoading } = useQuery<Activity[]>({
        queryKey: ["dashboard", "activities", selectedShop],
        queryFn: async () => {
            try {
                const response = await apiRequest(`/api/activities/?shop=${selectedShop}`);
                if (!Array.isArray(response)) {
                    console.error('Activities data is not an array:', response);
                    return [];
                }
                return response;
            } catch (error) {
                console.error('Error fetching activities:', error);
                return [];
            }
        },
        refetchInterval: 30000,
        staleTime: 25000
    });

    // Quantity mismatches query (admin only)
    const { data: mismatchProducts = [] } = useQuery<Product[]>({
        queryKey: ["dashboard", "mismatches", selectedShop],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/products/');
                if (!Array.isArray(response)) return [];
                // Filter products with mismatches
                return response.filter(p => p.has_mismatch);
            } catch (error) {
                console.error('Error fetching mismatch data:', error);
                return [];
            }
        },
        enabled: isAdmin,
        refetchInterval: 60000,
    });

    useEffect(() => {
        const fetchTopForecasts = async () => {
            try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().slice(0, 10);
                // Fetch only the first page, sorted by forecast_quantity desc, filtered for tomorrow
                const res: any = await apiClient.get(`/api/products/forecasts/?page=1&limit=3&forecast_date=${tomorrowStr}`);
                const top = res.results.map((f: any) => ({
                    product: f.product_name,
                    sku: f.sku,
                    forecast: f.forecast_quantity
                }));
                setTopForecasts(top);
            } catch (err) {
                setTopForecasts([]);
            }
        };
        fetchTopForecasts();
    }, []);

    // Loading state
    const isLoading =
        isStatsLoading ||
        isLowStockLoading ||
        isSalesDataLoading ||
        isCategoryDataLoading ||
        isActivitiesLoading ||
        isCategoriesLoading;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-10 w-1/3 mb-6" />
                    <Skeleton className="h-5 w-1/2 mb-6" />
                </div>

                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Skeleton className="h-80 lg:col-span-2" />
                    <Skeleton className="h-80" />
                </div>

                {/* Tables Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96 lg:col-span-2" />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-600">
                            {isAdmin && selectedShop === 'all'
                                ? "Real-time summary across all retail locations"
                                : `Daily performance and inventory status for this location`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdmin && selectedShop !== 'all' && (
                            <Button
                                variant="outline"
                                className="hidden md:flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5"
                                onClick={() => window.location.href = `/users?shop=${selectedShop}`}
                            >
                                <i className="fas fa-users-cog"></i>
                                Manage Staff
                            </Button>
                        )}
                        {isAdmin && shops.length > 0 && (
                            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1 shadow-sm">
                                <Store className="h-4 w-4 text-gray-400" />
                                <Combobox
                                    options={[
                                        { value: 'all', label: 'All Shops' },
                                        ...shops.map(shop => ({
                                            value: shop.id.toString(),
                                            label: shop.name
                                        }))
                                    ]}
                                    value={selectedShop.toString()}
                                    onValueChange={(value) => {
                                        setIsSyncing(true);
                                        setSelectedShop(value === 'all' ? 'all' : Number(value));
                                        setTimeout(() => setIsSyncing(false), 800);
                                    }}
                                    placeholder="Select shop"
                                    searchPlaceholder="Search shops..."
                                    className="w-[180px] border-none shadow-none"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Premium Loading Overlay */}
            {isSyncing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-300">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border flex flex-col items-center gap-4 scale-animation">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                            <Store className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-gray-800">Synchronizing Data</h3>
                            <p className="text-sm text-gray-500">Updating records for {selectedShop === 'all' ? 'all shops' : shops.find(s => s.id === selectedShop)?.name}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin || user?.role === 'manager' ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 mb-6`}>
                <StatCard
                    title={selectedShop === 'all' ? "Total Catalog Items" : "Shop Inventory Items"}
                    value={stats?.totalProducts || 0}
                    subValue={selectedShop !== 'all' ? `${stats?.totalStockQuantity || 0} Total Units` : undefined}
                    icon="box-open"
                    iconBg="bg-blue-100"
                    iconColor="text-blue-500"
                    change={stats?.compareLastMonth.products || 0}
                    changePeriod="from last month"
                />
                <StatCard
                    title="Low Stock Items"
                    value={stats?.lowStockCount || 0}
                    icon="exclamation-triangle"
                    iconBg="bg-amber-100"
                    iconColor="text-amber-500"
                    change={stats?.compareLastMonth.lowStock || 0}
                    changePeriod="from last week"
                />

                {(isAdmin || user?.role === 'manager') && (
                    <>
                        <StatCard
                            title="Total Sales"
                            value={`KSh ${(stats?.totalSales || 0).toLocaleString()}`}
                            icon="shopping-cart"
                            iconBg="bg-green-100"
                            iconColor="text-green-500"
                            change={stats?.compareLastMonth.sales || 0}
                            changePeriod="from last month"
                        />
                        <StatCard
                            title="Completed Sales"
                            value={stats?.pendingOrders || 0}
                            icon="clock"
                            iconBg="bg-purple-100"
                            iconColor="text-purple-500"
                            change={stats?.compareLastMonth.orders || 0}
                            changePeriod="from yesterday"
                        />
                    </>
                )}
            </div>

            {/* Charts Row */}
            <div className={`grid grid-cols-1 ${isAdmin || user?.role === 'manager' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-6 mb-6`}>
                {(isAdmin || user?.role === 'manager') && (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        {isSalesDataLoading ? (
                            <div className="h-80 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            {selectedShop === 'all' ? 'Consolidated Sales' : 'Shop Sales Performance'}
                                        </h3>
                                        <p className="text-sm text-gray-600">Revenue trends over time</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={view === 'day' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setView('day')}
                                        >
                                            Day
                                        </Button>
                                        <Button
                                            variant={view === 'week' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setView('week')}
                                        >
                                            Week
                                        </Button>
                                        <Button
                                            variant={view === 'month' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setView('month')}
                                        >
                                            Month
                                        </Button>
                                    </div>
                                </div>
                                <SalesChart data={salesData || []} view={view} />
                            </>
                        )}
                    </div>
                )}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    {isCategoryDataLoading ? (
                        <div className="h-80 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <CategoryChart data={categoryData || []} />
                    )}
                </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <LowStockTable
                    products={lowStockData?.items || []}
                    categories={categories || []}
                    onReorder={async (productId: number) => {
                        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard", "low-stock", selectedShop] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard", "stats", selectedShop] });
                    }}
                />
                <RecentActivityTable
                    activities={activities || []}
                    queryClient={queryClient}
                    selectedShop={selectedShop}
                />
            </div>

            {/* Quantity Mismatch Alert (Admin only) */}
            {isAdmin && mismatchProducts.length > 0 && (
                <div className="mt-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-200 flex flex-col md:flex-row items-start gap-4 transition-all duration-200" style={{ background: 'linear-gradient(135deg, #fff5f0 0%, #ffe6d9 100%)' }}>
                        <div className="flex items-center justify-center bg-orange-100 rounded-full w-16 h-16 mr-4 shadow-md flex-shrink-0">
                            <Store className="w-9 h-9 text-orange-500" aria-hidden="true" />
                        </div>
                        <div className="flex-1 w-full">
                            <h2 className="text-lg font-bold mb-2 text-orange-800 flex items-center gap-2">
                                ⚠️ Quantity Mismatches Detected ({mismatchProducts.length})
                            </h2>
                            <p className="text-sm text-orange-600 mb-3">
                                The following products have discrepancies between master quantity and shop totals:
                            </p>
                            <ul className="divide-y divide-orange-100 max-h-60 overflow-y-auto">
                                {mismatchProducts.slice(0, 10).map((product) => (
                                    <li
                                        key={product.id}
                                        className="flex justify-between items-center py-2 px-2 rounded-lg transition-all duration-150 hover:bg-orange-50/70"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900">
                                                {product.name}
                                            </span>
                                            <span className="text-xs text-gray-500">SKU: {product.sku}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm text-gray-600">
                                                Master: <span className="font-bold">{product.master_quantity}</span>
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                Shops: <span className="font-bold">{product.shop_total_quantity}</span>
                                            </span>
                                            <span className="font-extrabold text-orange-700 text-sm">
                                                Diff: {(product.quantity_diff ?? 0) > 0 ? '+' : ''}{product.quantity_diff ?? 0}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {mismatchProducts.length > 10 && (
                                <p className="text-xs text-orange-600 mt-2">
                                    ...and {mismatchProducts.length - 10} more. Check Inventory page for full list.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Forecast summary widget at the bottom */}
            <div className="mt-8">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex flex-col md:flex-row items-center gap-4 transition-all duration-200" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e6eaff 100%)' }}>
                    <div className="flex items-center justify-center bg-blue-100 rounded-full w-16 h-16 mr-4 shadow-md">
                        <LineChart className="w-9 h-9 text-blue-500" aria-hidden="true" />
                    </div>
                    <div className="flex-1 w-full">
                        <h2 className="text-lg font-bold mb-2 text-blue-800 flex items-center gap-2">
                            Tomorrow's Top 3 Forecasted Products
                        </h2>
                        {topForecasts.length === 0 ? (
                            <div className="text-blue-600">No forecast data available for tomorrow.</div>
                        ) : (
                            <ul className="divide-y divide-blue-100">
                                {topForecasts.map((item, idx) => (
                                    <li
                                        key={item.sku}
                                        className="flex justify-between items-center py-2 px-2 rounded-lg transition-all duration-150 hover:bg-blue-50/70 active:bg-blue-100/80"
                                    >
                                        <span className="font-semibold text-gray-900">
                                            {idx + 1}. {item.product} <span className="text-xs text-gray-500">(SKU: {item.sku})</span>
                                        </span>
                                        <span className="font-extrabold text-blue-700 text-xl drop-shadow-sm">
                                            {item.forecast}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
