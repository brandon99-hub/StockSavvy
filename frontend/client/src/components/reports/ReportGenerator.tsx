import React from 'react';
import {useState} from 'react';
import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {format, subDays, startOfDay, endOfDay} from 'date-fns';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter
} from '../ui/card';
import {Button} from '../ui/button';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../ui/tabs';
import {Separator} from '../ui/separator';
import {Calendar} from '../ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../ui/popover';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    TooltipProps
} from 'recharts';
import {exportInventoryToPDF, exportSalesToPDF, exportProfitToPDF, exportToCSV} from '../../lib/exportUtils';
import axios from 'axios';

// Define types
interface Product {
    id: number;
    name: string;
    sku: string;
    categoryId: number;
    quantity: number;
    minStockLevel: number;
    buyPrice: string;
    sellPrice: string;
}

interface Category {
    id: number;
    name: string;
}

interface Sale {
    id: number;
    userId: number;
    saleDate: string;
    totalAmount: string;
}

type NameType = string | number;
type ValueType = string | number | Array<string | number>;
type CustomTooltipFormatter = (value: ValueType, name: NameType) => [string | number, string];

// Custom hook for fetching reports data
const useReportsData = (reportType: string, dateRange: { start: Date; end: Date }) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Products query
    const productsQuery = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const response = await axios.get('/api/products/', { headers });
            return response.data;
        },
        enabled: reportType === 'inventory',
    });

    // Categories query
    const categoriesQuery = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const response = await axios.get('/api/categories/', { headers });
            return response.data;
        },
        enabled: reportType === 'inventory',
    });

    // Inventory report query
    const inventoryQuery = useQuery({
        queryKey: ['inventory-report', reportType],
        queryFn: async () => {
            const response = await axios.get('/api/reports/inventory/', { headers });
            return response.data;
        },
        enabled: reportType === 'inventory',
    });

    // Sales query with date range
    const salesQuery = useQuery({
        queryKey: ['sales', dateRange],
        queryFn: async () => {
            const response = await axios.get('/api/sales-items/', {
                headers,
                params: {
                    start: format(dateRange.start, 'yyyy-MM-dd'),
                    end: format(dateRange.end, 'yyyy-MM-dd')
                }
            });
            return response.data;
        },
        enabled: reportType === 'sales',
    });

    // Sale items query
    const saleItemsQuery = useQuery({
        queryKey: ['saleItems'],
        queryFn: async () => {
            const response = await axios.get('/api/sales-items/', { headers });
            return response.data;
        },
        enabled: reportType === 'sales',
    });

    // Profit query with date range
    const profitQuery = useQuery({
        queryKey: ['profit', dateRange],
        queryFn: async () => {
            const response = await axios.get('/api/reports/profit/', {
                headers,
                params: {
                    start: format(dateRange.start, 'yyyy-MM-dd'),
                    end: format(dateRange.end, 'yyyy-MM-dd')
                }
            });
            return response.data;
        },
        enabled: reportType === 'profit',
    });

    return {
        products: productsQuery.data || [],
        categories: categoriesQuery.data || [],
        inventoryReport: inventoryQuery.data || { summary: {}, categories: [], products: [] },
        sales: salesQuery.data || { summary: {}, sales: [] },
        saleItems: saleItemsQuery.data || {},
        profitData: profitQuery.data || { summary: {}, monthly: [] },
        isLoading: {
            products: productsQuery.isLoading,
            categories: categoriesQuery.isLoading,
            inventory: inventoryQuery.isLoading,
            sales: salesQuery.isLoading,
            saleItems: saleItemsQuery.isLoading,
            profit: profitQuery.isLoading
        },
        isError: {
            products: productsQuery.isError,
            categories: categoriesQuery.isError,
            inventory: inventoryQuery.isError,
            sales: salesQuery.isError,
            saleItems: saleItemsQuery.isError,
            profit: profitQuery.isError
        },
        errors: {
            products: productsQuery.error,
            categories: categoriesQuery.error,
            inventory: inventoryQuery.error,
            sales: salesQuery.error,
            saleItems: saleItemsQuery.error,
            profit: profitQuery.error
        }
    };
};

const ReportGenerator = () => {
    const controller = new AbortController();

    useEffect(() => {
        return () => {
            controller.abort(); // Cancel pending requests on unmount
        };
    }, []);

    const [reportType, setReportType] = useState<'inventory' | 'sales' | 'profit'>('inventory');
    const [dateRange, setDateRange] = useState({
        start: startOfDay(subDays(new Date(), 30)),
        end: endOfDay(new Date())
    });
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Fetch data using custom hook
    const {
        products,
        categories,
        inventoryReport,
        sales,
        saleItems,
        profitData,
        isLoading,
        isError,
        errors
    } = useReportsData(reportType, dateRange);

    // Transform categories array to an object for easier lookup
    const categoryMap = categories.reduce((acc: Record<number, string>, category: Category) => {
        acc[category.id] = category.name;
        return acc;
    }, {});

    // Transform products array to an object for easier lookup
    const productMap = products.reduce((acc: Record<number, Product>, product: Product) => {
        acc[product.id] = product;
        return acc;
    }, {});

    // Generate inventory report data
    const inventoryData = products.map((product: Product) => ({
        ...product,
        categoryName: product.categoryId ? categoryMap[product.categoryId] : 'Uncategorized',
        status: product.quantity <= 0 ? 'Out of Stock' :
            product.quantity <= product.minStockLevel ? 'Low Stock' : 'In Stock',
        value: Number(product.buyPrice) * product.quantity
    }));

    // Handle export to PDF
    const handleExportPDF = () => {
        switch (reportType) {
            case 'inventory':
                exportInventoryToPDF(products, categoryMap);
                break;
            case 'sales':
                exportSalesToPDF(sales.sales, saleItems, productMap);
                break;
            case 'profit':
                exportProfitToPDF(profitData.monthly, dateRange);
                break;
        }
    };

    // Handle export to CSV
    const handleExportCSV = () => {
        let data: any[] = [];
        let filename = '';

        switch (reportType) {
            case 'inventory':
                data = inventoryData.map(item => ({
                    SKU: item.sku,
                    Name: item.name,
                    Category: item.categoryName,
                    Quantity: item.quantity,
                    'Min Stock': item.minStockLevel,
                    'Buy Price': Number(item.buyPrice).toFixed(2),
                    'Sell Price': Number(item.sellPrice).toFixed(2),
                    Status: item.status,
                    Value: (Number(item.buyPrice) * item.quantity).toFixed(2)
                }));
                filename = 'inventory_report';
                break;
            case 'sales':
                data = sales.sales.map((sale: Sale) => ({
                    'Sale ID': sale.id,
                    Date: format(new Date(sale.saleDate), 'yyyy-MM-dd HH:mm:ss'),
                    'Total Amount': Number(sale.totalAmount).toFixed(2),
                    'Items Sold': saleItems[sale.id]?.length || 0,
                    'User ID': sale.userId
                }));
                filename = 'sales_report';
                break;
            case 'profit':
                data = profitData.monthly.map((item: any) => ({
                    Month: item.month,
                    Revenue: Number(item.revenue).toFixed(2),
                    Cost: Number(item.cost).toFixed(2),
                    Profit: (Number(item.revenue) - Number(item.cost)).toFixed(2),
                    'Profit Margin (%)': ((Number(item.revenue) - Number(item.cost)) / Number(item.revenue) * 100).toFixed(2)
                }));
                filename = 'profit_report';
                break;
        }

        exportToCSV(data, filename);
    };

    const renderSalesChart = () => {
        if (!sales.sales?.length) return null;

        const formatValue: CustomTooltipFormatter = (value) => {
            const numValue = Number(value);
            return [!isNaN(numValue) ? `KSh ${numValue.toFixed(2)}` : String(value), 'Sales Amount'];
        };

        return (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={sales.sales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="created_at" 
                        tickFormatter={(date) => format(new Date(date), 'MMM d')} 
                    />
                    <YAxis />
                    <Tooltip
                        labelFormatter={(date) => format(new Date(date), 'PPP')}
                        formatter={formatValue}
                    />
                    <Legend />
                    <Bar dataKey="total_amount" fill="#8884d8" name="Sales Amount" />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    const renderProfitChart = () => {
        if (!profitData.monthly?.length) return null;

        const formatValue: CustomTooltipFormatter = (value, name) => {
            const numValue = Number(value);
            return [!isNaN(numValue) ? `KSh ${numValue.toFixed(2)}` : String(value), name];
        };

        return (
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={profitData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={formatValue} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
                    <Line type="monotone" dataKey="cost" stroke="#82ca9d" name="Cost" />
                    <Line type="monotone" dataKey="profit" stroke="#ffc658" name="Profit" />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    // Show loading state
    if (Object.values(isLoading).some(Boolean)) {
        return (
            <Card className="shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        <span>Loading reports...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show error state
    if (Object.values(isError).some(Boolean)) {
        return (
            <Card className="shadow-sm">
                <CardContent className="p-6">
                    <div className="text-red-500">
                        <h3 className="font-semibold">Error loading reports</h3>
                        <p>Please try again later or contact support if the problem persists.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Generate Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <Tabs value={reportType} onValueChange={(value) => setReportType(value as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
                        <TabsTrigger value="sales">Sales Report</TabsTrigger>
                        <TabsTrigger value="profit">Profit Report</TabsTrigger>
                    </TabsList>

                    <div className="mt-4">
                        {(reportType === 'sales' || reportType === 'profit') && (
                            <div className="mb-4">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">Date Range:</span>
                                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="justify-start text-left font-normal">
                                                <i className="fas fa-calendar-alt mr-2 text-gray-400"></i>
                                                {format(dateRange.start, 'PPP')} - {format(dateRange.end, 'PPP')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
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
                                                        setCalendarOpen(false);
                                                    }
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        )}
                    </div>

                    <TabsContent value="inventory" className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md">
                            <h3 className="font-semibold mb-2">Inventory Status Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Products</p>
                                    <p className="text-xl font-bold">{products.length}</p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Low Stock Items</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {products.filter(p => p.quantity > 0 && p.quantity <= p.minStockLevel).length}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Out of Stock</p>
                                    <p className="text-xl font-bold text-red-600">
                                        {products.filter(p => p.quantity <= 0).length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Separator/>

                        <div>
                            <h3 className="font-semibold mb-2">Inventory Value by Category</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={categories.map(cat => ({
                                        name: cat.name,
                                        value: products
                                            .filter(p => p.categoryId === cat.id)
                                            .reduce((sum, p) => sum + (Number(p.buyPrice) * p.quantity), 0)
                                    }))}
                                    margin={{top: 20, right: 30, left: 20, bottom: 50}}
                                >
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70}/>
                                    <YAxis/>
                                    <Tooltip formatter={(value) => [`KSh ${Number(value).toFixed(2)}`, 'Value']}/>
                                    <Bar dataKey="value" fill="#3b82f6" name="Value (KSh)"/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>

                    <TabsContent value="sales" className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md">
                            <h3 className="font-semibold mb-2">Sales Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Sales</p>
                                    <p className="text-xl font-bold">
                                        KSh {Number(sales.summary?.totalSales || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Number of Transactions</p>
                                    <p className="text-xl font-bold">{sales.summary?.totalTransactions || 0}</p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Average Sale</p>
                                    <p className="text-xl font-bold">
                                        KSh {Number(sales.summary?.averageSale || 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Separator/>

                        <div>
                            <h3 className="font-semibold mb-2">Sales Trend</h3>
                            {renderSalesChart()}
                        </div>
                    </TabsContent>

                    <TabsContent value="profit" className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md">
                            <h3 className="font-semibold mb-2">Profit Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Revenue</p>
                                    <p className="text-xl font-bold">
                                        KSh {Number(profitData.summary?.totalRevenue || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Cost</p>
                                    <p className="text-xl font-bold">
                                        KSh {Number(profitData.summary?.totalCost || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Profit</p>
                                    <p className="text-xl font-bold text-green-600">
                                        KSh {Number(profitData.summary?.totalProfit || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Profit Margin</p>
                                    <p className="text-xl font-bold">
                                        {Number(profitData.summary?.profitMargin || 0).toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Separator/>

                        <div>
                            <h3 className="font-semibold mb-2">Profit Trend</h3>
                            {renderProfitChart()}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
                <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={Object.values(isLoading).some(Boolean)}
                >
                    <i className="fas fa-file-csv mr-2"></i> Export CSV
                </Button>
                <Button
                    onClick={handleExportPDF}
                    disabled={Object.values(isLoading).some(Boolean)}
                >
                    <i className="fas fa-file-pdf mr-2"></i> Export PDF
                </Button>
            </CardFooter>
        </Card>
    );
};

export default ReportGenerator;
