// @ts-ignore
import React from "react";
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

    // Dashboard stats query
    const {data: stats, isLoading: isStatsLoading} = useQuery<DashboardStats>({
        queryKey: ["/api/dashboard/stats/"],
        queryFn: () => apiRequest('/api/dashboard/stats/'),
        refetchInterval: 60000,
    });

    // Low stock products query
    const {data: lowStockData, isLoading: isLowStockLoading} =
        useQuery<LowStockResponse>({
            queryKey: ["/api/products/low-stock/"],
            queryFn: () => apiRequest('/api/products/low-stock/')
        });

    // Sales chart data query
    const {data: salesData = [], isLoading: isSalesDataLoading} = useQuery<SalesChartData[]>({
        queryKey: ["/api/dashboard/sales-chart/"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/dashboard/sales-chart/');
                // Check if response is an object with a data/results property
                const salesArray = response?.data || response?.results || response;
                
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
        refetchInterval: 60000
    });

    // Category chart data query
    const {data: categoryData = [], isLoading: isCategoryDataLoading} = useQuery<CategoryChartData[]>({
        queryKey: ["/api/dashboard/category-chart/"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/dashboard/category-chart/');
                // Check if response is an object with a data/results property
                const categoryArray = response?.data || response?.results || response;
                
                if (!Array.isArray(categoryArray)) {
                    console.error('Category data structure:', response);
                    return [];
                }
                
                const total = categoryArray.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
                
                return categoryArray.map(item => {
                    const value = parseFloat(item.value) || 0;
                    return {
                        id: item.id,
                        name: item.name,
                        value: value,
                        percentage: total > 0 ? (value / total) * 100 : 0
                    };
                });
            } catch (error) {
                console.error('Error fetching category data:', error);
                return [];
            }
        },
        refetchInterval: 60000
    });

    // Recent activities query
    const {data: activities = [], isLoading: isActivitiesLoading} = useQuery<Activity[]>({
        queryKey: ["/api/activities/"],
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
        refetchInterval: 30000
    });

    const {data: categories = []} = useQuery<Category[]>({
        queryKey: ['/api/categories/'],
        queryFn: () => apiRequest('/api/categories/')
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
                        <SalesChart data={salesData || []}/>
                    )}
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    {isCategoryDataLoading ? (
                        <div className="h-80 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <CategoryChart data={categoryData || []}/>
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