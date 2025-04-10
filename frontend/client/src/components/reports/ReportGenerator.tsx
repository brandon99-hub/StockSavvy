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

  // Fetch data based on report type
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
    queryKey: ['/api/products'],
    queryFn: async () => {
      const response = await apiRequest('/api/products/');
      return Array.isArray(response) ? response : [];
    }
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const response = await apiRequest('/api/categories/');
      return Array.isArray(response) ? response : [];
    }
  });

  const { data: sales = [], isLoading: isSalesLoading } = useQuery<Sale[]>({
    queryKey: ['/api/sales'],
    queryFn: async () => {
      const response = await apiRequest('/api/sales/');
      return Array.isArray(response) ? response : [];
    }
  });

  const { data: saleItems = {}, isLoading: isSaleItemsLoading } = useQuery<Record<number, SaleItem[]>>({
    queryKey: ['/api/sales/items'],
    queryFn: async () => {
      const response = await apiRequest('/api/sales/items/');
      return typeof response === 'object' && response !== null ? response : {};
    }
  });

  const { data: profitData = [], isLoading: isProfitLoading } = useQuery<ProfitData[]>({
    queryKey: ['/api/reports/profit', dateRange],
    queryFn: async () => {
      const response = await apiRequest('/api/reports/profit/', {
        method: 'GET',
        params: {
          start_date: format(dateRange.start, 'yyyy-MM-dd'),
          end_date: format(dateRange.end, 'yyyy-MM-dd')
        }
      });
      return Array.isArray(response) ? response : [];
    }
  });

  // Calculate loading state
  const isLoading = isStatsLoading || isSalesDataLoading || isCategoryDataLoading || isLowStockLoading || isProductsLoading || isCategoriesLoading || isSalesLoading || isSaleItemsLoading || isProfitLoading;

  // Transform data for reports
  const inventoryReportData = lowStockData.items.map(product => ({
    name: product.name,
    category: categories.find(cat => cat.id === product.category_id)?.name || 'Unknown',
    quantity: product.quantity,
    reorderLevel: product.reorder_level,
    status: product.quantity <= 0 ? 'Out of Stock' : product.quantity <= product.reorder_level ? 'Low Stock' : 'In Stock'
  }));

  const salesReportData = salesChartData.map(item => ({
    date: format(new Date(item.date), 'MMM dd, yyyy'),
    amount: item.amount
  }));

  const profitReportData = categoryChartData.map(item => ({
    category: item.name,
    percentage: item.percentage
  }));

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
  const inventoryData = products.map(product => ({
    ...product,
    categoryName: product.category_id ? categoryMap[product.category_id] : 'Uncategorized',
    status: product.quantity <= 0 ? 'Out of Stock' :
            product.quantity <= product.reorder_level ? 'Low Stock' : 'In Stock',
    value: Number(product.price) * product.quantity
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
        exportInventoryToPDF(products, categoryMap);
        break;
      case 'sales':
        exportSalesToPDF(sales, saleItems, productMap);
        break;
      case 'profit':
        exportProfitToPDF(profitData, dateRange);
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
          SKU: item.id,
          Name: item.name,
          Category: item.categoryName,
          Quantity: item.quantity,
          'Min Stock': item.reorder_level,
          'Buy Price': Number(item.price).toFixed(2),
          'Sell Price': Number(item.price).toFixed(2),
          Status: item.status,
          Value: (Number(item.price) * item.quantity).toFixed(2)
        }));
        filename = 'inventory_report';
        break;
      case 'sales':
        data = filteredSales.map(sale => {
          const saleDate = new Date(sale.date);
          const itemCount = saleItems[sale.id]?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          return {
            'Sale ID': sale.id,
            Date: format(saleDate, 'yyyy-MM-dd HH:mm:ss'),
            'Total Amount': Number(sale.total_amount).toFixed(2),
            'Items Sold': itemCount,
            'User ID': sale.id
          };
        });
        filename = 'sales_report';
        break;
      case 'profit':
        data = profitData.map(item => ({
          Date: item.date,
          Revenue: item.revenue.toFixed(2),
          Cost: item.cost.toFixed(2),
          Profit: (item.revenue - item.cost).toFixed(2),
          'Profit Margin (%)': ((item.revenue - item.cost) / item.revenue * 100).toFixed(2)
        }));
        filename = 'profit_report';
        break;
    }

    exportToCSV(data, filename);
  };

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
                    {products.filter(p => p.quantity > 0 && p.quantity <= p.reorder_level).length}
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

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Inventory Value</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={categoryChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip formatter={(value) => [`KSh ${typeof value === 'number' ? value.toFixed(2) : value}`, 'Value']} />
                  <Bar dataKey="value" fill="#3b82f6" name="Value (KSh)" />
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
                    KSh {filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Number of Transactions</p>
                  <p className="text-xl font-bold">{filteredSales.length}</p>
                </div>
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Average Sale</p>
                  <p className="text-xl font-bold">
                    KSh {(filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0) /
                      (filteredSales.length || 1)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Sales Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={salesChartDataForChart}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [
                    name === 'revenue' && typeof value === 'number' ? `KSh ${value.toFixed(2)}` : value,
                    name === 'revenue' ? 'Revenue' : 'Transactions'
                  ]} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    name="Revenue (KSh)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="transactions"
                    stroke="#10b981"
                    name="Transactions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Profit Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold">
                    KSh {profitData.reduce((sum, day) => sum + day.revenue, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="text-xl font-bold">
                    KSh {profitData.reduce((sum, day) => sum + day.cost, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Total Profit</p>
                  <p className="text-xl font-bold text-green-600">
                    KSh {profitData.reduce((sum, day) => sum + (day.revenue - day.cost), 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-md shadow-sm">
                  <p className="text-sm text-gray-500">Profit Margin</p>
                  <p className="text-xl font-bold">
                    {(profitData.reduce((sum, day) => sum + (day.revenue - day.cost), 0) /
                      profitData.reduce((sum, day) => sum + day.revenue, 0) * 100 || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Profit Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={profitData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip formatter={(value) => [`KSh ${(typeof value === 'number' ? value.toFixed(2) : value)}`, 'Amount']} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="cost" fill="#ef4444" name="Cost" />
                  <Bar dataKey="profit" fill="#10b981" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={isLoading}
        >
          <i className="fas fa-file-csv mr-2"></i> Export CSV
        </Button>
        <Button
          onClick={handleExportPDF}
          disabled={isLoading}
        >
          <i className="fas fa-file-pdf mr-2"></i> Export PDF
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ReportGenerator;
