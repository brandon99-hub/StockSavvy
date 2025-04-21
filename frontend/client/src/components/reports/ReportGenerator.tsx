import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter
} from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Calendar } from '../ui/calendar';
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
    ResponsiveContainer
} from 'recharts';
import { exportInventoryToPDF, exportSalesToPDF, exportProfitToPDF, exportToCSV } from '../../lib/exportUtils';
import { apiRequest } from '../../lib/queryClient';

// Define types for our data
interface Product {
  id: number;
  name: string;
  category_id: number;
  price: number;
  cost: number;
  quantity: number;
  reorder_level: number;
  category_name?: string;
  min_stock_level?: number;
  buy_price?: number;
  sell_price?: number;
  status?: string;
  sku?: string;
  description?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Sale {
  id: number;
  date: string;
  total_amount: number;
  items: SaleItem[];
}

interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  price: number;
  cost: number;
}

interface ProfitData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

const ReportGenerator = () => {
    const [reportType, setReportType] = useState<'inventory' | 'sales' | 'profit'>('inventory');
    const [dateRange, setDateRange] = useState({
        start: startOfDay(subDays(new Date(), 30)),
        end: endOfDay(new Date())
    });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch data based on report type and pagination
    const { data: inventoryData, isLoading: isInventoryLoading } = useQuery({
        queryKey: ["reports", "inventory", currentPage],
        queryFn: async () => {
            const response = await apiRequest(`/api/reports/inventory/?page=${currentPage}`);
            if (!response?.products || !Array.isArray(response.products)) {
                console.error('Invalid inventory data format:', response);
                return { products: [], pagination: { currentPage: 1, totalPages: 1 } };
            }
            return response;
        },
        staleTime: 60000
    });

    // Fetch data based on report type
    const { data: stats = {}, isLoading: isStatsLoading } = useQuery({
        queryKey: ["reports", "stats"],
        queryFn: () => apiRequest('/api/dashboard/stats/'),
        staleTime: 60000
    });

    const { data: salesChartData = [], isLoading: isSalesDataLoading } = useQuery({
        queryKey: ["reports", "sales-chart"],
        queryFn: async () => {
            const response = await apiRequest('/api/dashboard/sales-chart/');
            if (!response?.items || !Array.isArray(response.items)) {
                console.error('Invalid sales data format:', response);
                return [];
            }
            return response.items;
        },
        staleTime: 60000
    });

    const { data: categoryChartData = [], isLoading: isCategoryDataLoading } = useQuery({
        queryKey: ["reports", "category-chart"],
        queryFn: async () => {
            const response = await apiRequest('/api/dashboard/category-chart/');
            if (!Array.isArray(response)) {
                console.error('Invalid category data format:', response);
                return [];
            }
            return response;
        },
        staleTime: 60000
    });

    const { data: lowStockData = { items: [], summary: { total: 0, outOfStock: 0, lowStock: 0 } }, isLoading: isLowStockLoading } = useQuery({
        queryKey: ["reports", "low-stock"],
        queryFn: () => apiRequest('/api/products/low-stock/'),
        staleTime: 60000
    });

    const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
        queryKey: ["reports", "products"],
        queryFn: async () => {
            const response = await apiRequest('/api/reports/inventory/');
            if (!response?.products || !Array.isArray(response.products)) {
                console.error('Invalid inventory data format:', response);
                return [];
            }
            return response.products;
        },
        staleTime: 60000
    });

    const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
        queryKey: ["reports", "categories"],
        queryFn: async () => {
            const response = await apiRequest('/api/categories/');
            return Array.isArray(response) ? response : [];
        },
        staleTime: 300000 // Categories don't change often
    });

    const { data: sales = [], isLoading: isSalesLoading } = useQuery<Sale[]>({
        queryKey: ["reports", "sales"],
        queryFn: async () => {
            const response = await apiRequest('/api/sales/');
            return Array.isArray(response) ? response : [];
        },
        staleTime: 60000
    });

    // Calculate loading state
    const isLoading = isStatsLoading || isSalesDataLoading || isCategoryDataLoading || isLowStockLoading || isProductsLoading || isCategoriesLoading || isSalesLoading;

    // Transform data for reports with safety checks
    const inventoryReportData = React.useMemo(() => {
        if (!Array.isArray(products)) return [];
        
        return products.map(product => {
            return {
                name: String(product.name || ''),
                category: String(product.category_name || 'Unknown'),
                quantity: Number(product.quantity || 0),
                reorderLevel: Number(product.min_stock_level || 0),
                value: Number(product.sell_price || 0) * Number(product.quantity || 0),
                status: product.status || 'Unknown',
                sku: product.sku || '',
                buyPrice: Number(product.buy_price || 0),
                sellPrice: Number(product.sell_price || 0)
            };
        });
    }, [products]);

    const salesReportData = React.useMemo(() => {
        if (!Array.isArray(salesChartData)) return [];
        
        return salesChartData.map(item => ({
            date: format(new Date(item.date), 'MMM dd, yyyy'),
            amount: parseFloat(item.amount),
            count: item.transaction_count || 0
        }));
    }, [salesChartData]);

    const profitReportData = React.useMemo(() => {
        if (!Array.isArray(categoryChartData)) return [];
        
        return categoryChartData.map(item => ({
            category: String(item.name || 'Unknown'),
            revenue: parseFloat(item.total_value || '0'),
            percentage: Number(item.percentage || 0)
        }));
    }, [categoryChartData]);

    // Format currency values
    const formatCurrency = (value: number): string => {
        return `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Transform categories array to an object for easier lookup
    const categoryMap = categories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
    }, {} as Record<number, string>);

    // Transform products array to an object for easier lookup
    const productMap = products.reduce((acc, product) => {
        acc[product.id] = product;
        return acc;
    }, {} as Record<number, Product>);

    // Generate inventory report data
    const inventoryDataForReport = inventoryData?.products.map(product => ({
        ...product,
        categoryName: product.category_name || 'Uncategorized',
        status: product.status || 'Unknown',
        value: Number(product.sell_price || 0) * Number(product.quantity || 0)
    }));

    // Generate sales report data for chart
    const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.date);
        return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });

    // Group sales by date for chart
    const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateStr = format(new Date(sale.date), 'yyyy-MM-dd');
        if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, revenue: 0, transactions: 0 };
        }
    acc[dateStr].revenue += Number(sale.total_amount);
        acc[dateStr].transactions += 1;
        return acc;
    }, {} as Record<string, { date: string, revenue: number, transactions: number }>);

  const salesChartDataForChart = Object.values(salesByDate).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Handle export to PDF
    const handleExportPDF = () => {
        switch (reportType) {
            case 'inventory':
                exportInventoryToPDF(inventoryDataForReport, categoryMap);
                break;
            case 'sales':
        exportSalesToPDF(sales, {}, productMap);
                break;
            case 'profit':
        // Use category chart data for profit report
        exportProfitToPDF(profitReportData, dateRange);
                break;
        }
    };

    // Handle export to CSV
    const handleExportCSV = () => {
        let data: any[] = [];
        let filename = '';

        switch (reportType) {
            case 'inventory':
                data = inventoryDataForReport.map(item => ({
                    SKU: item.sku || '',
                    Name: item.name,
                    Category: item.category_name || 'Uncategorized',
                    Quantity: item.quantity,
                    'Min Stock': item.min_stock_level,
                    'Buy Price': Number(item.buy_price || 0).toFixed(2),
                    'Sell Price': Number(item.sell_price || 0).toFixed(2),
                    Status: item.status,
                    Value: (Number(item.sell_price || 0) * Number(item.quantity || 0)).toFixed(2)
                }));
                filename = 'inventory_report';
                break;
            case 'sales':
                data = filteredSales.map(sale => {
          const saleDate = new Date(sale.date);
                    return {
                        'Sale ID': sale.id,
                        Date: format(saleDate, 'yyyy-MM-dd HH:mm:ss'),
            'Total Amount': Number(sale.total_amount).toFixed(2),
            'Items Sold': sale.items?.length || 0,
            'User ID': sale.id
                    };
                });
                filename = 'sales_report';
                break;
            case 'profit':
        data = profitReportData.map(item => ({
          Category: item.category,
          'Percentage': item.percentage.toFixed(2) + '%'
                }));
                filename = 'profit_report';
                break;
        }

        exportToCSV(data, filename);
    };

    // Handle page change
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    // Render pagination controls
    const renderPagination = () => {
        if (!inventoryData?.pagination) return null;
        const { currentPage, totalPages } = inventoryData.pagination;

        return (
            <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                >
                    Previous
                </Button>
                <span className="text-sm">
                    Page {currentPage} of {totalPages}
                </span>
                <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next
                </Button>
            </div>
        );
    };

    return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Generate Reports</h2>
          <p className="text-gray-600">Select a report type and date range to generate your report.</p>
        </div>
        <div className="space-x-2">
          <Button onClick={handleExportPDF}>Export PDF</Button>
          <Button onClick={handleExportCSV}>Export CSV</Button>
        </div>
      </div>

      <Tabs 
        value={reportType} 
        onValueChange={value => {
            if (value === 'inventory' || value === 'sales' || value === 'profit') {
                setReportType(value);
                setCurrentPage(1); // Reset page when changing report type
            }
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="profit">Profit Report</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isInventoryLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inventoryData?.products.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.category_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.description || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.min_stock_level}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${item.status === 'In Stock' ? 'bg-green-100 text-green-800' : 
                                  item.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-red-100 text-red-800'}`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                </div>
              ) : (
                <div className="space-y-8">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesReportData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="amount" name="Sales Amount" stroke="#8884d8" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesReportData.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">{item.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.amount)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                                </div>
                            </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit">
          <Card>
            <CardHeader>
              <CardTitle>Profit Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
              ) : (
                <div className="space-y-8">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profitReportData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="#8884d8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {profitReportData.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">{item.category}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.revenue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.percentage.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </div>
    );
};

export default ReportGenerator;
