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
import { formatInTimeZone } from 'date-fns-tz';

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

const ReportGenerator: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  const formatDate = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  const profitQuery = useQuery({
    queryKey: ['profit', startDate, endDate],
    queryFn: async () => {
      const response = await axios.get('/api/reports/profit/', {
        params: {
          start: startDate ? formatDate(startDate) : undefined,
          end: endDate ? formatDate(endDate) : undefined,
        },
      });
      return response.data;
    },
    enabled: !!startDate && !!endDate,
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const formatPercent = (value: string) => {
    return `${parseFloat(value).toFixed(2)}%`;
  };

  const renderSummary = () => {
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
              <Typography variant="h4">{formatCurrency(totalProfit)}</Typography>
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
              <Typography variant="h4">{formatPercent(profitMargin.toString())}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderCharts = () => {
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
                  <Tooltip formatter={(value) => formatCurrency(value.toString())} />
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
                  <Tooltip formatter={(value) => formatCurrency(value.toString())} />
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
                  <Tooltip formatter={(value) => formatPercent(value.toString())} />
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

  if (profitQuery.error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading profit report: {(profitQuery.error as Error).message}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h4" gutterBottom>Profit Report</Typography>
        
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateRangePicker
            value={dateRange}
            onChange={(newValue) => setDateRange(newValue)}
            sx={{ mb: 3 }}
          />
        </LocalizationProvider>

        {profitQuery.isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {renderSummary()}
            {renderCharts()}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ReportGenerator;
