import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import { Card, CardContent, Typography, Grid, Box, CircularProgress, Alert } from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

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

  const { data: profitData, isLoading: profitLoading, error: profitError } = useQuery<ProfitData>({
    queryKey: ['profit', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return null;
      const response = await axios.get('/api/reports/profit/', {
        params: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
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
    if (!profitData?.summary) return null;

    const { totalRevenue, totalCost, totalProfit, totalTransactions, profitMargin } = profitData.summary;

    return (
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Revenue</Typography>
              <Typography variant="h6">{formatCurrency(totalRevenue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Cost</Typography>
              <Typography variant="h6">{formatCurrency(totalCost)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Profit</Typography>
              <Typography variant="h6">{formatCurrency(totalProfit)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Transactions</Typography>
              <Typography variant="h6">{totalTransactions}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Profit Margin</Typography>
              <Typography variant="h6">{profitMargin.toFixed(2)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderCharts = () => {
    if (!profitData?.monthly) return null;

    const chartData = profitData.monthly.map(item => ({
      ...item,
      revenue: parseFloat(item.revenue),
      cost: parseFloat(item.cost),
      profit: parseFloat(item.profit),
      profit_margin: parseFloat(item.profit_margin),
    }));

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
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
        </Grid>
        <Grid item xs={12} md={6}>
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
        </Grid>
        <Grid item xs={12}>
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
        </Grid>
      </Grid>
    );
  };

  if (profitError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading profit report: {(profitError as Error).message}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Profit Report</Typography>
      
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DateRangePicker
          value={dateRange}
          onChange={(newValue) => setDateRange(newValue)}
          sx={{ mb: 3 }}
        />
      </LocalizationProvider>

      {profitLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          {renderSummary()}
          {renderCharts()}
        </>
      )}
    </Box>
  );
};

export default ReportGenerator;
