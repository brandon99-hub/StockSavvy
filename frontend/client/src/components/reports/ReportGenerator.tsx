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
    ResponsiveContainer
} from 'recharts';
import {exportInventoryToPDF, exportSalesToPDF, exportProfitToPDF, exportToCSV} from '../../lib/exportUtils';
import {Product, Sale, Category} from '../../../../shared/schema';
import { TooltipFormatter } from 'recharts/types/component/Tooltip';

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

    // Fetch data based on report type
    const {data: products = [], isLoading: isProductsLoading} = useQuery<Product[]>({
        queryKey: ['/api/products/'],
    });

    const {data: categories = [], isLoading: isCategoriesLoading} = useQuery<Category[]>({
        queryKey: ['/api/categories/'],
    });

    const {data: sales = [], isLoading: isSalesLoading} = useQuery<Sale[]>({
        queryKey: ['/api/reports/', { 
            type: 'sales',
            start: format(dateRange.start, 'yyyy-MM-dd'),
            end: format(dateRange.end, 'yyyy-MM-dd')
        }],
    });

    const {data: saleItems = {}, isLoading: isSaleItemsLoading} = useQuery<Record<number, any[]>>({
        queryKey: ['/api/sales-items/'],
        signal: controller.signal,
    });

    const {data: profitData = [], isLoading: isProfitLoading} = useQuery<any[]>({
        queryKey: ['/api/reports/profit/', {
            start: format(dateRange.start, 'yyyy-MM-dd'),
            end: format(dateRange.end, 'yyyy-MM-dd')
        }],
    });

    // Transform the data from the backend response
    const salesData = sales?.summary || {
        totalSales: '0.00',
        totalTransactions: 0,
        averageSale: '0.00',
        totalItems: 0
    };

    const profitSummary = profitData?.summary || {
        totalRevenue: '0.00',
        totalCost: '0.00',
        totalProfit: '0.00',
        profitMargin: 0
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
    const inventoryData = products.map(product => ({
        ...product,
        categoryName: product.categoryId ? categoryMap[product.categoryId] : 'Uncategorized',
        status: product.quantity <= 0 ? 'Out of Stock' :
            product.quantity <= product.minStockLevel ? 'Low Stock' : 'In Stock',
        value: Number(product.buyPrice) * product.quantity
    }));

    // Use the sales data from the backend directly
    const salesChartData = sales?.sales || [];

    // Use the profit data from the backend directly
    const profitChartData = profitData?.monthly || [];

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
                data = sales.map(sale => ({
                    'Sale ID': sale.id,
                    Date: format(new Date(sale.saleDate), 'yyyy-MM-dd HH:mm:ss'),
                    'Total Amount': Number(sale.totalAmount).toFixed(2),
                    'Items Sold': saleItems[sale.id]?.length || 0,
                    'User ID': sale.userId
                }));
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

    const renderSalesChart = () => {
        if (!sales.sales?.length) return null;

        const formatValue: TooltipFormatter = (value) => {
            const numValue = Number(value);
            return [!isNaN(numValue) ? numValue.toFixed(2) : String(value), 'Sales Amount'];
        };

        return (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={sales.sales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="created_at" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString()} 
                    />
                    <YAxis />
                    <Tooltip
                        labelFormatter={(date) => new Date(date).toLocaleString()}
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

        const formatValue: TooltipFormatter = (value, name) => {
            const numValue = Number(value);
            return [!isNaN(numValue) ? numValue.toFixed(2) : String(value), name];
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
                            <h3 className="font-semibold mb-2">Inventory Value</h3>
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
                                    <Tooltip formatter={(value) => [`KSh ${value.toFixed(2)}`, 'Value']}/>
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
                                        KSh {salesData.totalSales}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Number of Transactions</p>
                                    <p className="text-xl font-bold">{salesData.totalTransactions}</p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Average Sale</p>
                                    <p className="text-xl font-bold">
                                        KSh {salesData.averageSale}
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
                                        KSh {profitSummary.totalRevenue}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Cost</p>
                                    <p className="text-xl font-bold">
                                        KSh {profitSummary.totalCost}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Total Profit</p>
                                    <p className="text-xl font-bold text-green-600">
                                        KSh {profitSummary.totalProfit}
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm text-gray-500">Profit Margin</p>
                                    <p className="text-xl font-bold">
                                        {profitSummary.profitMargin.toFixed(2)}%
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
                    disabled={isProductsLoading || isCategoriesLoading || isSalesLoading || isSaleItemsLoading || isProfitLoading}
                >
                    <i className="fas fa-file-csv mr-2"></i> Export CSV
                </Button>
                <Button
                    onClick={handleExportPDF}
                    disabled={isProductsLoading || isCategoriesLoading || isSalesLoading || isSaleItemsLoading || isProfitLoading}
                >
                    <i className="fas fa-file-pdf mr-2"></i> Export PDF
                </Button>
            </CardFooter>
        </Card>
    );
};

export default ReportGenerator;
