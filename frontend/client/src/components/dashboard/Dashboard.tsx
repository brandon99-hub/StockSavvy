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
import { Button } from "../ui/button";

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
        useQuery<Product[]>({
            queryKey: ["dashboard", "low-stock"],
            queryFn: async () => {
                const response = await apiRequest('/api/products/low-stock/');
                return Array.isArray(response) ? response : [];
            }
        });

    // Categories query
    const {data: categories = [], isLoading: isCategoriesLoading} = useQuery<Category[]>({
        queryKey: ["dashboard", "categories"],
        queryFn: () => apiRequest('/api/categories/'),
        staleTime: 300000 // Categories don't change often
    });

    // Sales chart data query
    const {data: salesData = [], isLoading: isSalesDataLoading} = useQuery<SalesChartData[]>({
        queryKey: ["dashboard", "sales-chart"],
        queryFn: async () => {
            try {
                const response = await apiRequest('/api/dashboard/sales-chart/');
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
        staleTime: 55000
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
        staleTime: 25000
    });

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
                    icon="clock"
                    iconBg="bg-purple-100"
                    iconColor="text-purple-500"
                    change={stats?.compareLastMonth.orders || 0}
                    changePeriod="from yesterday"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    {isSalesDataLoading ? (
                        <div className="h-80 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">Sales Overview</h3>
                                    <p className="text-sm text-gray-600">Track your sales performance</p>
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
                    products={lowStockData || []}
                    categories={categories || []}
                    onReorder={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard", "low-stock"] });
                        queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
                    }}
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