import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

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
  categories: Category[];
  products: Product[];
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

  const formatDate = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  // Inventory query
  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await axios.get('/api/reports/inventory/');
      return response.data as InventoryData;
    },
  });

  // Profit query
  const profitQuery = useQuery({
    queryKey: ['profit', startDate, endDate],
    queryFn: async () => {
      const response = await axios.get('/api/reports/profit/', {
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
      const response = await axios.get('/api/sales-items/');
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

  const renderInventorySummary = () => {
    if (!inventoryQuery.data?.summary) return null;

    const { totalProducts, lowStock, outOfStock, totalValue } = inventoryQuery.data.summary;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Products</Typography>
              <Typography variant="h4">{totalProducts}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Low Stock Items</Typography>
              <Typography variant="h4" color="warning.main">{lowStock}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Out of Stock</Typography>
              <Typography variant="h4" color="error.main">{outOfStock}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Value</Typography>
              <Typography variant="h4">{formatCurrency(totalValue)}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderInventoryCharts = () => {
    if (!inventoryQuery.data?.categories) return null;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Inventory Value by Category</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryQuery.data.categories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="value" name="Value" fill="#4CAF50" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Products by Category</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryQuery.data.categories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="product_count" name="Products" fill="#2196F3" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderProfitSummary = () => {
    if (!profitQuery.data?.summary) return null;

    const { totalRevenue, totalCost, totalProfit, totalTransactions, profitMargin } = profitQuery.data.summary;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Revenue</Typography>
              <Typography variant="h4">{formatCurrency(totalRevenue)}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Cost</Typography>
              <Typography variant="h4">{formatCurrency(totalCost)}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Profit</Typography>
              <Typography variant="h4" color="success.main">{formatCurrency(totalProfit)}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Transactions</Typography>
              <Typography variant="h4">{totalTransactions}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Profit Margin</Typography>
              <Typography variant="h4">{formatPercent(profitMargin)}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderProfitCharts = () => {
    if (!profitQuery.data?.monthly) return null;

    const chartData = profitQuery.data.monthly.map(item => ({
      ...item,
      revenue: parseFloat(item.revenue),
      cost: parseFloat(item.cost),
      profit: parseFloat(item.profit),
      profit_margin: parseFloat(item.profit_margin),
    }));

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Revenue vs Cost</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#4CAF50" />
                  <Bar dataKey="cost" name="Cost" fill="#F44336" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Profit Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Area type="monotone" dataKey="profit" name="Profit" fill="#2196F3" stroke="#1976D2" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 100%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Profit Margin Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPercent(value as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="profit_margin" name="Profit Margin" stroke="#9C27B0" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderSalesSummary = () => {
    if (!salesQuery.data?.summary) return null;

    const { totalItems, totalValue } = salesQuery.data.summary;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Items Sold</Typography>
              <Typography variant="h4">{totalItems}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 30%', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Sales Value</Typography>
              <Typography variant="h4">{formatCurrency(totalValue)}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderSalesCharts = () => {
    if (!salesQuery.data?.items) return null;

    // Group sales by category
    const categoryData = salesQuery.data.items.reduce((acc, item) => {
      const category = item.category_name || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = {
          name: category,
          value: 0,
          items: 0
        };
      }
      acc[category].value += parseFloat(item.total_price);
      acc[category].items += item.quantity;
      return acc;
    }, {} as Record<string, { name: string; value: number; items: number }>);

    const categoryChartData = Object.values(categoryData);

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

    const dateChartData = Object.values(dateData).sort((a, b) => a.date.localeCompare(b.date));

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sales by Category</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="value" name="Sales Value" fill="#4CAF50" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sales Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" name="Sales Amount" stroke="#2196F3" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
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
        <Typography variant="h4" gutterBottom>Reports</Typography>
        
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
            <Typography variant="h5" gutterBottom>Sales Report</Typography>
            {renderSalesSummary()}
            {renderSalesCharts()}

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>Inventory Report</Typography>
            {renderInventorySummary()}
            {renderInventoryCharts()}

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>Profit Report</Typography>
            {renderProfitSummary()}
            {renderProfitCharts()}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ReportGenerator;
