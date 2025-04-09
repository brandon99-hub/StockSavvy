import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Button } from '../ui/button';
import { Download, FileDown, FileText } from 'lucide-react';

// Define interfaces for the data
interface Product {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  quantity: number;
  minStockLevel: number;
  buyPrice: string;
  sellPrice: string;
  category_name?: string;
  status?: string;
}

interface Category {
  id: number;
  name: string;
  product_count: number;
  total_quantity: number;
  value: number;
}

interface InventoryData {
  summary: {
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    totalValue: string;
  };
  categories: Array<{
    name: string;
    product_count: number;
    total_quantity: number;
    value: string;
  }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    min_stock_level: number;
    buy_price: string;
    sell_price: string;
    category_name: string;
    status: string;
  }>;
}

interface ProfitData {
  summary: {
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    totalTransactions: number;
    profitMargin: number;
  };
  monthly: Array<{
    month: string;
    revenue: string;
    cost: string;
    profit: string;
    transaction_count: number;
    unique_products: number;
    profit_margin: string;
  }>;
}

interface SalesData {
  items: Array<{
    id: number;
    sale_id: number;
    product_id: number;
    quantity: number;
    unit_price: string;
    total_price: string;
    product_name: string;
    product_sku: string;
    category_name: string;
    sale_date: string;
    sale_total: string;
    sold_by: string;
  }>;
  summary: {
    totalItems: number;
    totalValue: string;
  };
}

const ReportGenerator: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const [activeTab, setActiveTab] = useState(0);

  const formatDate = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  // Inventory query
  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports/inventory/', {
        headers: {
          Authorization: token
        }
      });
      return response.data as InventoryData;
    },
  });

  // Profit query
  const profitQuery = useQuery({
    queryKey: ['profit', startDate, endDate],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports/profit/', {
        headers: {
          Authorization: token
        },
        params: {
          start: startDate ? formatDate(startDate) : undefined,
          end: endDate ? formatDate(endDate) : undefined,
        },
      });
      return response.data as ProfitData;
    },
    enabled: !!startDate && !!endDate,
  });

  // Sales query
  const salesQuery = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/sales-items/', {
        headers: {
          Authorization: token
        }
      });
      return response.data as SalesData;
    },
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(numValue);
  };

  const formatPercent = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(2)}%`;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExportPDF = () => {
    // ... existing PDF export logic ...
  };

  const handleExportCSV = () => {
    // ... existing CSV export logic ...
  };

  const renderInventorySummary = () => {
    if (!inventoryQuery.data?.summary) return null;

    const { totalProducts, lowStock, outOfStock, totalValue } = inventoryQuery.data.summary;

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Products</Typography>
            <Typography variant="h4">{totalProducts}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Low Stock Items</Typography>
            <Typography variant="h4" color="warning.main">{lowStock}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Out of Stock</Typography>
            <Typography variant="h4" color="error.main">{outOfStock}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Value</Typography>
            <Typography variant="h4">{formatCurrency(totalValue)}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderInventoryCharts = () => {
    if (!inventoryQuery.data?.categories) return null;

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Stock by Category</Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryQuery.data.categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_quantity" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderProfitSummary = () => {
    if (!profitQuery.data?.summary) return null;

    const { totalRevenue, totalCost, totalProfit, profitMargin } = profitQuery.data.summary;

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Revenue</Typography>
            <Typography variant="h4">{formatCurrency(totalRevenue)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Cost</Typography>
            <Typography variant="h4">{formatCurrency(totalCost)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Profit</Typography>
            <Typography variant="h4" color="success.main">{formatCurrency(totalProfit)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Profit Margin</Typography>
            <Typography variant="h4" color="success.main">{formatPercent(profitMargin)}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderProfitCharts = () => {
    if (!profitQuery.data?.monthly) return null;

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Monthly Profit Trend</Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitQuery.data.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderSalesSummary = () => {
    if (!salesQuery.data?.summary) return null;

    const { totalItems, totalValue } = salesQuery.data.summary;

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Items Sold</Typography>
            <Typography variant="h4">{totalItems}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Total Sales Value</Typography>
            <Typography variant="h4">{formatCurrency(totalValue)}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderSalesCharts = () => {
    if (!salesQuery.data?.items) return null;

    // Group sales by date
    const dateData = salesQuery.data.items.reduce((acc, item) => {
      const date = item.sale_date.split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          amount: 0,
          items: 0
        };
      }
      acc[date].amount += parseFloat(item.total_price);
      acc[date].items += item.quantity;
      return acc;
    }, {} as Record<string, { date: string; amount: number; items: number }>);

    const chartData = Object.values(dateData).sort((a, b) => a.date.localeCompare(b.date));

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Sales Trend</Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (inventoryQuery.error || profitQuery.error || salesQuery.error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading reports: {(inventoryQuery.error || profitQuery.error || salesQuery.error)?.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>Reports</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </Box>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateRangePicker
            value={dateRange}
            onChange={(newValue) => setDateRange(newValue)}
            sx={{ mb: 3 }}
          />
        </LocalizationProvider>

        {(inventoryQuery.isLoading || profitQuery.isLoading || salesQuery.isLoading) ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Sales Report" />
              <Tab label="Inventory Report" />
              <Tab label="Profit Report" />
            </Tabs>

            <Box sx={{ mt: 2 }}>
              {activeTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderSalesSummary()}
                  {renderSalesCharts()}
                </Box>
              )}

              {activeTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderInventorySummary()}
                  {renderInventoryCharts()}
                </Box>
              )}

              {activeTab === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderProfitSummary()}
                  {renderProfitCharts()}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ReportGenerator;
