// @ts-ignore
import React, {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Product, Activity, Category} from "../../types";
import StatCard from "./StatCard";
import SalesChart from "./SalesChart";
import CategoryChart from "./CategoryChart";
import LowStockTable from "./LowStockTable";
import RecentActivityTable from "./RecentActivityTable";
import {Skeleton} from "../ui/skeleton";
import { apiRequest } from "../../lib/queryClient";
import { Loader2 } from "lucide-react";

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
    const [view, setView] = useState<'day' | 'week' | 'month'>('day');

    // Dashboard stats query
    const {data: stats, isLoading: isStatsLoading} = useQuery<DashboardStats>({
        queryKey: ["dashboard", "stats"],
        queryFn: () => apiRequest('/api/dashboard/stats/'),
        refetchInterval: 60000,
    });

    // Low stock products query
    const {data: lowStockData, isLoading: isLowStockLoading} =
        useQuery<LowStockResponse>({
            queryKey: ["dashboard", "low-stock"],
            queryFn: () => apiRequest('/api/products/low-stock/')
        });

    // Sales chart data query
    const {data: salesData = [], isLoading: isSalesDataLoading} = useQuery<SalesChartData[]>({
        queryKey: ["dashboard", "sales-chart"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/dashboard/sales-chart/');
                // The API returns { items: [], summary: {} }
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
        staleTime: 55000 // Add staleTime to prevent unnecessary refetches
    });

    // Category chart data query
    const {data: categoryData = [], isLoading: isCategoryDataLoading} = useQuery<CategoryChartData[]>({
        queryKey: ["dashboard", "category-chart"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/dashboard/category-chart/');
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
        staleTime: 55000 // Add staleTime to prevent unnecessary refetches
    });

    // Recent activities query
    const {data: activities = [], isLoading: isActivitiesLoading} = useQuery<Activity[]>({
        queryKey: ["dashboard", "activities"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/activities/');
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
        staleTime: 25000 // Add staleTime to prevent unnecessary refetches
    });

    const {data: categories = []} = useQuery<Category[]>({
        queryKey: ["dashboard", "categories"],
        queryFn: () => apiRequest('/api/categories/'),
        staleTime: 300000 // Categories don't change often, cache for 5 minutes
    });

    // Loading state
    const isLoading =
        isStatsLoading ||
        isLowStockLoading ||
        isSalesDataLoading ||
        isCategoryDataLoading ||
        isActivitiesLoading;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-10 w-1/3 mb-6"/>
                    <Skeleton className="h-5 w-1/2 mb-6"/>
                </div>

                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32"/>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Skeleton className="h-80 lg:col-span-2"/>
                    <Skeleton className="h-80"/>
                </div>

                {/* Tables Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96"/>
                    <Skeleton className="h-96 lg:col-span-2"/>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
                <p className="text-gray-600">
                    Welcome back! Here's what's happening with your inventory today.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    title="Total Stock Items"
                    value={stats?.totalProducts || 0}
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
                    title="Pending Orders"
                    value={stats?.pendingOrders || 0}
                    icon="clipboard-list"
                    iconBg="bg-purple-100"
                    iconColor="text-purple-500"
                    change={stats?.compareLastMonth.orders || 0}
                    changePeriod="from yesterday"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    {isSalesDataLoading ? (
                        <div className="h-80 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-end space-x-2 mb-4">
                                <button 
                                    type="button"
                                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                        view === 'day' 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setView('day')}
                                >
                                    Day
                                </button>
                                <button 
                                    type="button"
                                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                        view === 'week' 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setView('week')}
                                >
                                    Week
                                </button>
                                <button 
                                    type="button"
                                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                                        view === 'month' 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setView('month')}
                                >
                                    Month
                                </button>
                            </div>
                            <SalesChart data={salesData || []} view={view} />
                        </>
                    )}
                </div>
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
                    onReorder={() =>
                        queryClient.invalidateQueries({ queryKey: ["/api/products"] })
                    }
                />
                <RecentActivityTable
                    activities={activities || []}
                    queryClient={queryClient}
                />
            </div>
        </div>
    );
};

export default Dashboard;