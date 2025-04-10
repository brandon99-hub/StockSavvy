import React from 'react';
import {useState, useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
    format,
    subMonths,
    subWeeks,
    subYears,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    startOfYear,
    endOfYear,
    isSameDay,
    addDays,
    differenceInDays,
    differenceInMonths
} from 'date-fns';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter
} from '../ui/card';
import {Button} from '../ui/button';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../ui/tabs';
import {Separator} from '../ui/separator';
import {Calendar} from '../ui/calendar';
import {Label} from '../ui/label';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '../ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../ui/popover';
import {Alert, AlertDescription, AlertTitle} from '../ui/alert';
import {AlertCircle, Calendar as CalendarIcon, DownloadIcon, TrendingDown, TrendingUp, Info} from 'lucide-react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';
import {exportInventoryToPDF, exportSalesToPDF, exportProfitToPDF, exportToCSV} from '../../lib/exportUtils';
import {Product, Sale, Category, Activity} from '../../types';
import { apiRequest } from '../../lib/queryClient';

// Custom type definitions for analytics data
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

interface ProfitData {
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    discount: number;
}

interface ComparisonData {
    period: string;
    current: number;
    previous: number;
    change: number;
}

interface StockMovementData {
    date: string;
    additions: number;
    removals: number;
    net: number;
}

interface TopProductData {
    id: number;
    name: string;
    sales: number;
    revenue: number;
    profit: number;
}

interface DashboardStats {
    totalSales: number;
    totalRevenue: number;
    totalProducts: number;
    lowStockCount: number;
    profit: number;
    averageOrderValue: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

// Time period options for the dashboard
const TIME_PERIODS = [
    {label: 'Last 7 days', value: 'week'},
    {label: 'Last 30 days', value: 'month'},
    {label: 'Last 90 days', value: 'quarter'},
    {label: 'Last 12 months', value: 'year'},
    {label: 'Custom range', value: 'custom'}
];

const AdvancedAnalytics = () => {
    // UI state
    const [activeTab, setActiveTab] = useState<string>('sales');
    const [timePeriod, setTimePeriod] = useState<string>('month');
    const [dateRange, setDateRange] = useState({
        start: startOfDay(subMonths(new Date(), 1)),
        end: endOfDay(new Date())
    });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [comparisonType, setComparisonType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');

    // Update date range based on selected time period
    useEffect(() => {
        const now = new Date();
        let start;
        let end = endOfDay(now);

        switch (timePeriod) {
            case 'week':
                start = startOfDay(subWeeks(now, 1));
                break;
            case 'month':
                start = startOfDay(subMonths(now, 1));
                break;
            case 'quarter':
                start = startOfDay(subMonths(now, 3));
                break;
            case 'year':
                start = startOfDay(subYears(now, 1));
                break;
            case 'custom':
                // Keep existing custom date range
                return;
            default:
                start = startOfDay(subMonths(now, 1));
        }

        setDateRange({start, end});
    }, [timePeriod]);

    // Format date range for display
    const formattedDateRange = `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;

    // Fetch dashboard data
    const { data: stats = {}, isLoading: isStatsLoading } = useQuery({
        queryKey: ['/api/dashboard/stats/'],
        queryFn: () => apiRequest('/api/dashboard/stats/')
    });

    const { data: salesChartData = [], isLoading: isSalesDataLoading } = useQuery({
        queryKey: ['/api/dashboard/sales-chart/'],
        queryFn: () => apiRequest('/api/dashboard/sales-chart/')
    });

    const { data: categoryChartData = [], isLoading: isCategoryDataLoading } = useQuery({
        queryKey: ['/api/dashboard/category-chart/'],
        queryFn: () => apiRequest('/api/dashboard/category-chart/')
    });

    const { data: lowStockData = { items: [], summary: { total: 0, outOfStock: 0, lowStock: 0 } }, isLoading: isLowStockLoading } = useQuery({
        queryKey: ['/api/products/low-stock/'],
        queryFn: () => apiRequest('/api/products/low-stock/')
    });

    const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
        queryKey: ['/api/products/'],
        queryFn: () => apiRequest('/api/products/')
    });

    const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
        queryKey: ['/api/categories/'],
        queryFn: () => apiRequest('/api/categories/')
    });

    const { data: sales = [], isLoading: isSalesLoading } = useQuery<Sale[]>({
        queryKey: ['/api/sales/'],
        queryFn: () => apiRequest('/api/sales/')
    });

    const { data: activities = [], isLoading: isActivitiesLoading } = useQuery<Activity[]>({
        queryKey: ['/api/activities/'],
        queryFn: () => apiRequest('/api/activities/')
    });

    // Calculate loading state
    const isLoading = isProductsLoading ||
        isCategoriesLoading ||
        isSalesLoading ||
        isActivitiesLoading ||
        isStatsLoading ||
        isSalesDataLoading ||
        isCategoryDataLoading ||
        isLowStockLoading;

    // Create a map of products by ID for quick lookup
    const productsById = useMemo(() => {
        const map = new Map<number, Product>();
        products.forEach(product => {
            map.set(product.id, product);
        });
        return map;
    }, [products]);

    // Filter sales by date range
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });
    }, [sales, dateRange]);

    // Filter activities by date range
    const filteredActivities = useMemo(() => {
        return activities.filter(activity => {
            const activityDate = new Date(activity.created_at);
            return activityDate >= dateRange.start && activityDate <= dateRange.end;
        });
    }, [activities, dateRange]);

    // Format currency values
    const formatCurrency = (value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(value)) return 'KSh 0.00';
        return `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format percentage values
    const formatPercentage = (value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(value)) return '0.00%';
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    // Calculate total revenue from sales
    const calculateTotalRevenue = (sales: Sale[]): number => {
        if (!Array.isArray(sales)) return 0;
        return sales.reduce((total, sale) => {
            return total + Number(sale.total_amount || '0');
        }, 0);
    };

    // Export data to various formats
    const exportData = () => {
        switch (activeTab) {
            case 'sales':
                exportSalesToPDF(sales, {}, {});
                break;
            case 'inventory':
                exportInventoryToPDF(products, {});
                break;
            case 'profit':
                // Use category chart data for profit report
                exportProfitToPDF(categoryChartData, dateRange);
                break;
            default:
                exportToCSV(categoryChartData, `${activeTab}_report_${format(new Date(), 'yyyy-MM-dd')}`);
        }
    };

    // Custom tooltip formatter for charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-4 border border-gray-200 shadow-md rounded-md">
                    <p className="font-semibold">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.name === 'Discount' ? `-${formatCurrency(entry.value)}` :
                                typeof entry.value === 'number' ?
                                    (entry.name.includes('Revenue') || entry.name.includes('Profit') || entry.name.includes('Cost') ?
                                        formatCurrency(entry.value) : entry.value.toLocaleString()) :
                                    entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Transform data for analytics with safety checks
    const salesData = useMemo(() => {
        if (!salesChartData || !Array.isArray(salesChartData)) return [];
        return salesChartData.map(item => ({
            date: format(new Date(item.date || new Date()), 'yyyy-MM-dd'),
            amount: Number(item.amount || 0),
            count: Number(item.count || 0)
        }));
    }, [salesChartData]);

    const categoryData = useMemo(() => {
        if (!categoryChartData || !Array.isArray(categoryChartData)) return [];
        return categoryChartData.map(item => ({
            id: Number(item.id || 0),
            name: String(item.name || 'Unknown'),
            value: Number(item.value || 0),
            percentage: Number(item.percentage || 0)
        }));
    }, [categoryChartData]);

    // Create profit data with safety checks
    const profitData = useMemo(() => {
        if (!stats || typeof stats !== 'object') return [];
        
        const today = new Date();
        const data = {
            date: format(today, 'yyyy-MM-dd'),
            revenue: Number(stats.totalRevenue || 0),
            cost: Number(stats.totalCost || 0),
            profit: Number(stats.profit || 0)
        };
        
        return [data];
    }, [stats]);

    // Calculate metrics with safety checks
    const metrics = useMemo(() => {
        if (!stats || typeof stats !== 'object') {
            return {
                totalRevenue: 0,
                totalSales: 0,
                averageOrderValue: 0
            };
        }

        const totalRevenue = Number(stats.totalRevenue || 0);
        const totalSales = Number(stats.totalSales || 0);
        const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

        return {
            totalRevenue,
            totalSales,
            averageOrderValue
        };
    }, [stats]);

    // Calculate year-over-year comparison data
    const yearOverYearData = useMemo((): ComparisonData[] => {
        if (!Array.isArray(sales)) return [];
        
        // Get current period data
        const currentPeriodSales = sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });

        // Calculate previous period date range (1 year before)
        const previousStart = subYears(dateRange.start, 1);
        const previousEnd = subYears(dateRange.end, 1);

        // Filter sales for previous period
        const previousPeriodSales = sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= previousStart && saleDate <= previousEnd;
        });

        // Calculate metrics for comparison
        const calculateMetrics = (salesData: Sale[]) => {
            const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.total_amount || '0'), 0);
            const totalItems = salesData.length;
            const avgOrderValue = totalItems > 0 ? totalRevenue / totalItems : 0;

            return {
                revenue: totalRevenue,
                orders: totalItems,
                avgValue: avgOrderValue
            };
        };

        const currentMetrics = calculateMetrics(currentPeriodSales);
        const previousMetrics = calculateMetrics(previousPeriodSales);

        // Create comparison data
        return [
            {
                period: 'Revenue',
                current: currentMetrics.revenue,
                previous: previousMetrics.revenue,
                change: previousMetrics.revenue > 0
                    ? ((currentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100
                    : 0
            },
            {
                period: 'Orders',
                current: currentMetrics.orders,
                previous: previousMetrics.orders,
                change: previousMetrics.orders > 0
                    ? ((currentMetrics.orders - previousMetrics.orders) / previousMetrics.orders) * 100
                    : 0
            },
            {
                period: 'Average Order',
                current: currentMetrics.avgValue,
                previous: previousMetrics.avgValue,
                change: previousMetrics.avgValue > 0
                    ? ((currentMetrics.avgValue - previousMetrics.avgValue) / previousMetrics.avgValue) * 100
                    : 0
            }
        ];
    }, [sales, dateRange]);

    // Calculate stock movement data with safety checks
    const stockMovementData = useMemo(() => {
        if (!Array.isArray(activities)) return [];
        
        const movementMap = new Map<string, { additions: number, removals: number }>();

        // Initialize with the date range
        const daysInRange = differenceInDays(dateRange.end, dateRange.start) + 1;
        for (let i = 0; i < daysInRange; i++) {
            const date = addDays(dateRange.start, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            movementMap.set(dateStr, { additions: 0, removals: 0 });
        }

        // Process activities
        filteredActivities.forEach(activity => {
            if (!activity || !activity.created_at) return;
            
            const activityDate = format(new Date(activity.created_at), 'yyyy-MM-dd');
            const current = movementMap.get(activityDate) || { additions: 0, removals: 0 };

            if (activity.type === 'stock_added') {
                movementMap.set(activityDate, {
                    ...current,
                    additions: current.additions + 1
                });
            } else if (activity.type === 'stock_removed') {
                movementMap.set(activityDate, {
                    ...current,
                    removals: current.removals + 1
                });
            }
        });

        return Array.from(movementMap.entries())
            .map(([date, data]) => ({
                date,
                additions: data.additions,
                removals: data.removals,
                net: data.additions - data.removals
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredActivities, dateRange]);

    // Calculate top products with safety checks
    const topProducts = useMemo(() => {
        if (!Array.isArray(products) || !Array.isArray(sales)) return [];
        
        const productSalesMap = new Map<number, {
            sales: number,
            revenue: number,
            profit: number
        }>();

        // Process sales data
        sales.forEach(sale => {
            if (!sale || !Array.isArray(sale.items)) return;
            
            sale.items.forEach(item => {
                if (!item || !item.product_id) return;
                
                const product = productsById.get(item.product_id);
                if (!product) return;

                const quantity = Number(item.quantity || 0);
                const itemPrice = Number(item.unit_price || product.sell_price || 0);
                const revenue = itemPrice * quantity;
                const cost = Number(product.buy_price || 0) * quantity;
                const profit = revenue - cost;

                const existing = productSalesMap.get(item.product_id) || {
                    sales: 0,
                    revenue: 0,
                    profit: 0
                };

                productSalesMap.set(item.product_id, {
                    sales: existing.sales + quantity,
                    revenue: existing.revenue + revenue,
                    profit: existing.profit + profit
                });
            });
        });

        return Array.from(productSalesMap.entries())
            .map(([productId, data]) => {
                const product = productsById.get(productId);
                if (!product) return null;
                
                return {
                    id: productId,
                    name: product.name || 'Unknown Product',
                    sales: data.sales,
                    revenue: data.revenue,
                    profit: data.profit
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5);
    }, [sales, productsById, products]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Advanced Analytics Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Comprehensive analytics and insights for your inventory management system
                    </p>
                </div>
                <div className="flex space-x-4">
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4"/>
                                <span>{formattedDateRange}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="range"
                                selected={{
                                    from: dateRange.start,
                                    to: dateRange.end
                                }}
                                onSelect={(range) => {
                                    if (range?.from && range?.to) {
                                        setDateRange({
                                            start: startOfDay(range.from),
                                            end: endOfDay(range.to)
                                        });
                                        setTimePeriod('custom');
                                    }
                                    setCalendarOpen(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select time period"/>
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_PERIODS.map(period => (
                                <SelectItem key={period.value} value={period.value}>
                                    {period.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={exportData} className="flex items-center gap-2">
                        <DownloadIcon className="h-4 w-4"/>
                        Export
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div
                            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-2"></div>
                        <p>Loading dashboard data...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Key Performance Indicators */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Revenue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Sales</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metrics.totalSales}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Average Order Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(metrics.averageOrderValue)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
                            <TabsTrigger value="sales">Sales Analytics</TabsTrigger>
                            <TabsTrigger value="inventory">Inventory Analytics</TabsTrigger>
                            <TabsTrigger value="profit">Profit Analysis</TabsTrigger>
                            <TabsTrigger value="comparison">YoY Comparison</TabsTrigger>
                        </TabsList>

                        {/* Sales Analytics Tab */}
                        <TabsContent value="sales" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Sales Trend</CardTitle>
                                        <CardDescription>
                                            Sales performance over time
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={salesData}
                                                margin={{top: 10, right: 30, left: 0, bottom: 0}}
                                            >
                                                <defs>
                                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="date"/>
                                                <YAxis tickFormatter={(value) => `KSh ${value}`}/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Area
                                                    type="monotone"
                                                    dataKey="amount"
                                                    name="Revenue"
                                                    stroke="#8884d8"
                                                    fillOpacity={1}
                                                    fill="url(#colorAmount)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Top Selling Products</CardTitle>
                                        <CardDescription>
                                            Products with highest sales volume
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={topProducts}
                                                layout="vertical"
                                                margin={{top: 5, right: 30, left: 20, bottom: 5}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis type="number"/>
                                                <YAxis type="category" dataKey="name" width={100}/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                                <Bar
                                                    dataKey="sales"
                                                    name="Units Sold"
                                                    fill="#8884d8"
                                                    radius={[0, 4, 4, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Sales by Category</CardTitle>
                                    <CardDescription>
                                        Revenue distribution across product categories
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col md:flex-row">
                                    <div className="w-full md:w-1/2 h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={categoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    nameKey="name"
                                                    label={({
                                                                name,
                                                                percent
                                                            }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {categoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`}
                                                              fill={COLORS[index % COLORS.length]}/>
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="w-full md:w-1/2 mt-6 md:mt-0">
                                        <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>
                                        <div className="space-y-4">
                                            {categoryData.map((category, index) => {
                                                const categoryTotal = categoryRevenue.get(category.id) || 0;
                                                return (
                                                    <div key={category.id} className="flex items-center gap-2">
                                                        <div className="w-4 h-4"
                                                             style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between">
                                                                <span>{category.name}</span>
                                                                <span>{formatCurrency(categoryTotal)}</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                                <div className="h-2 rounded-full"
                                                                     style={{
                                                                         width: `${category.percentage}%`,
                                                                         backgroundColor: COLORS[index % COLORS.length]
                                                                     }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Inventory Analytics Tab */}
                        <TabsContent value="inventory" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Stock Movement</CardTitle>
                                        <CardDescription>
                                            Stock additions and removals over time
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={stockMovementData}
                                                margin={{top: 5, right: 30, left: 20, bottom: 5}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="date"/>
                                                <YAxis/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                                <Line
                                                    type="monotone"
                                                    dataKey="additions"
                                                    name="Stock Added"
                                                    stroke="#4ade80"
                                                    activeDot={{r: 8}}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="removals"
                                                    name="Stock Removed"
                                                    stroke="#f87171"
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="net"
                                                    name="Net Change"
                                                    stroke="#60a5fa"
                                                    strokeDasharray="5 5"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Inventory Status</CardTitle>
                                        <CardDescription>
                                            Current inventory levels by category
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%"
                                                        data={categories.map(category => {
                                                            const categoryProducts = products.filter(p => {
                                                                if (!p.category || typeof p.category !== 'number') return false;
                                                                return p.category === category.id;
                                                            });
                                                            const totalQuantity = categoryProducts.reduce((sum, product) => sum + product.quantity, 0);
                                                            const avgPrice = categoryProducts.length > 0
                                                                ? categoryProducts.reduce((sum, product) => sum + Number(product.sell_price), 0) / categoryProducts.length
                                                                : 0;
                                                            const lowStock = categoryProducts.filter(p => p.quantity <= p.min_stock_level).length;

                                                            return {
                                                                category: category.name,
                                                                products: categoryProducts.length,
                                                                quantity: totalQuantity,
                                                                avgPrice: avgPrice,
                                                                lowStock: lowStock
                                                            };
                                                        })}>
                                                <PolarGrid/>
                                                <PolarAngleAxis dataKey="category"/>
                                                <PolarRadiusAxis angle={30} domain={[0, 'auto']}/>
                                                <Radar name="Product Count" dataKey="products" stroke="#8884d8"
                                                       fill="#8884d8" fillOpacity={0.6}/>
                                                <Radar name="Total Quantity" dataKey="quantity" stroke="#82ca9d"
                                                       fill="#82ca9d" fillOpacity={0.6}/>
                                                <Radar name="Low Stock Items" dataKey="lowStock" stroke="#ff8042"
                                                       fill="#ff8042" fillOpacity={0.6}/>
                                                <Legend/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Low Stock Products</CardTitle>
                                    <CardDescription>
                                        Products that need reordering
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3">Product</th>
                                                <th className="px-6 py-3">SKU</th>
                                                <th className="px-6 py-3">Category</th>
                                                <th className="px-6 py-3">Current Stock</th>
                                                <th className="px-6 py-3">Min Stock Level</th>
                                                <th className="px-6 py-3">Status</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {products
                                                .filter(product => product.quantity <= product.min_stock_level)
                                                .map(product => {
                                                    const category = categories.find(c => {
                                                        if (!product.category || typeof product.category !== 'number') return false;
                                                        return c.id === product.category;
                                                    });
                                                    const stockDiff = product.quantity - product.min_stock_level;
                                                    let statusClass = "bg-green-100 text-green-800";

                                                    if (stockDiff < 0) {
                                                        statusClass = "bg-red-100 text-red-800";
                                                    } else if (stockDiff === 0) {
                                                        statusClass = "bg-yellow-100 text-yellow-800";
                                                    }

                                                    return (
                                                        <tr key={product.id}
                                                            className="bg-white border-b hover:bg-gray-50">
                                                            <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                                            <td className="px-6 py-4">{product.sku}</td>
                                                            <td className="px-6 py-4">{category?.name || 'Unknown'}</td>
                                                            <td className="px-6 py-4">{product.quantity}</td>
                                                            <td className="px-6 py-4">{product.min_stock_level}</td>
                                                            <td className="px-6 py-4">
                                  <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                                    {stockDiff < 0 ? 'Critically Low' : stockDiff === 0 ? 'At Threshold' : 'Low Stock'}
                                  </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            }
                                            {products.filter(product => product.quantity <= product.min_stock_level).length === 0 && (
                                                <tr className="bg-white border-b">
                                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                                        No low stock products found
                                                    </td>
                                                </tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Profit Analysis Tab */}
                        <TabsContent value="profit" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Revenue vs. Profit</CardTitle>
                                        <CardDescription>
                                            Comparison of revenue and profit over time
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={profitData}
                                                margin={{top: 5, right: 30, left: 20, bottom: 5}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="date"/>
                                                <YAxis tickFormatter={(value) => `KSh ${value}`}/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                                <Line
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    name="Revenue"
                                                    stroke="#8884d8"
                                                    activeDot={{r: 8}}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="cost"
                                                    name="Cost"
                                                    stroke="#ff8042"
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="profit"
                                                    name="Profit"
                                                    stroke="#82ca9d"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Top Products by Profit</CardTitle>
                                        <CardDescription>
                                            Products generating the most profit
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={topProducts.sort((a, b) => b.profit - a.profit)}
                                                layout="vertical"
                                                margin={{top: 5, right: 30, left: 20, bottom: 5}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis type="number" tickFormatter={(value) => `KSh ${value}`}/>
                                                <YAxis type="category" dataKey="name" width={100}/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                                <Bar
                                                    dataKey="profit"
                                                    name="Profit"
                                                    fill="#82ca9d"
                                                    radius={[0, 4, 4, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Profit Analysis by Product</CardTitle>
                                    <CardDescription>
                                        Detailed profit breakdown for each product
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3">Product</th>
                                                <th className="px-6 py-3">Category</th>
                                                <th className="px-6 py-3">Units Sold</th>
                                                <th className="px-6 py-3">Revenue</th>
                                                <th className="px-6 py-3">Cost</th>
                                                <th className="px-6 py-3">Profit</th>
                                                <th className="px-6 py-3">Margin %</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {topProducts.map(product => {
                                                const category = categories.find(c => {
                                                    const productCategory = productsById.get(product.id)?.category;
                                                    if (!productCategory || typeof productCategory !== 'number') return false;
                                                    return c.id === productCategory;
                                                });
                                                const margin = product.revenue > 0
                                                    ? (product.profit / product.revenue) * 100
                                                    : 0;

                                                return (
                                                    <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                                        <td className="px-6 py-4">{category?.name || 'Unknown'}</td>
                                                        <td className="px-6 py-4">{product.sales}</td>
                                                        <td className="px-6 py-4">{formatCurrency(product.revenue)}</td>
                                                        <td className="px-6 py-4">{formatCurrency(product.revenue - product.profit)}</td>
                                                        <td className="px-6 py-4">{formatCurrency(product.profit)}</td>
                                                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                margin >= 30 ? 'bg-green-100 text-green-800' :
                                    margin >= 15 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                            }`}>
                                {isFinite(margin) ? margin.toFixed(2) : '0.00'}%
                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Year-over-Year Comparison Tab */}
                        <TabsContent value="comparison" className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Year-over-Year Comparison</CardTitle>
                                        <CardDescription>
                                            Compare current period with the same period last year
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-80">
                                        <div className="mb-4">
                                            <Select value={comparisonType}
                                                    onValueChange={(value: any) => setComparisonType(value)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select comparison type"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                    <SelectItem value="yearly">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={yearOverYearData}
                                                margin={{top: 20, right: 30, left: 20, bottom: 5}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="period"/>
                                                <YAxis/>
                                                <RechartsTooltip content={<CustomTooltip/>}/>
                                                <Legend/>
                                                <Bar dataKey="current" name="Current Period" fill="#8884d8"/>
                                                <Bar dataKey="previous" name="Previous Period" fill="#82ca9d"/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Performance Changes</CardTitle>
                                        <CardDescription>
                                            Detailed metrics comparison with previous period
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3">Metric</th>
                                                    <th className="px-6 py-3">Current Period</th>
                                                    <th className="px-6 py-3">Previous Period</th>
                                                    <th className="px-6 py-3">Change</th>
                                                    <th className="px-6 py-3">% Change</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {yearOverYearData.map((item) => {
                                                    const isRevenue = item.period === 'Revenue';
                                                    const isAvgOrder = item.period === 'Average Order';
                                                    const formatValue = (value: number) => {
                                                        return isRevenue || isAvgOrder ? formatCurrency(value) : value.toLocaleString();
                                                    };

                                                    const absoluteChange = item.current - item.previous;

                                                    return (
                                                        <tr key={item.period}
                                                            className="bg-white border-b hover:bg-gray-50">
                                                            <td className="px-6 py-4 font-medium text-gray-900">{item.period}</td>
                                                            <td className="px-6 py-4">{formatValue(item.current)}</td>
                                                            <td className="px-6 py-4">{formatValue(item.previous)}</td>
                                                            <td className="px-6 py-4">
                                                                <div
                                                                    className={`flex items-center ${absoluteChange > 0 ? 'text-green-600' : absoluteChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                                    {absoluteChange > 0 ? <TrendingUp
                                                                        className="h-4 w-4 mr-1"/> : absoluteChange < 0 ?
                                                                        <TrendingDown className="h-4 w-4 mr-1"/> : null}
                                                                    {isRevenue || isAvgOrder ? formatCurrency(Math.abs(absoluteChange)) : Math.abs(absoluteChange).toLocaleString()}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                  <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          item.change > 0 ? 'bg-green-100 text-green-800' :
                                              item.change < 0 ? 'bg-red-100 text-red-800' :
                                                  'bg-gray-100 text-gray-800'
                                      }`}>
                                    {formatPercentage(item.change)}
                                  </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Analytics Insights</CardTitle>
                                <CardDescription>
                                    Key insights based on your data
                                </CardDescription>
                            </div>
                            <Info className="h-4 w-4 text-gray-400"/>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats?.lowStockCount ? (
                                    <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                                        <AlertCircle className="h-4 w-4"/>
                                        <AlertTitle>Low Stock Alert</AlertTitle>
                                        <AlertDescription>
                                            {stats.lowStockCount} products are low on stock. Review the
                                            Inventory tab for details.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                {yearOverYearData && yearOverYearData[0]?.change && yearOverYearData[0].change < -10 ? (
                                    <Alert className="bg-red-50 text-red-800 border-red-200">
                                        <AlertCircle className="h-4 w-4"/>
                                        <AlertTitle>Revenue Decline</AlertTitle>
                                        <AlertDescription>
                                            Revenue has declined
                                            by {formatPercentage(Math.abs(yearOverYearData[0].change))} compared to the
                                            same period last year.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                {yearOverYearData && yearOverYearData[0]?.change && yearOverYearData[0].change > 10 ? (
                                    <Alert className="bg-green-50 text-green-800 border-green-200">
                                        <AlertCircle className="h-4 w-4"/>
                                        <AlertTitle>Revenue Growth</AlertTitle>
                                        <AlertDescription>
                                            Revenue has grown by {formatPercentage(yearOverYearData[0].change)} compared
                                            to the same period last year.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                {topProducts && topProducts.length > 0 ? (
                                    <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                                        <AlertCircle className="h-4 w-4"/>
                                        <AlertTitle>Top Performing Product</AlertTitle>
                                        <AlertDescription>
                                            {topProducts[0]?.name || 'Unknown'} is your best-selling product
                                            with {topProducts[0]?.sales || 0} units sold,
                                            generating {formatCurrency(topProducts[0]?.revenue || 0)} in revenue.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};

export default AdvancedAnalytics;