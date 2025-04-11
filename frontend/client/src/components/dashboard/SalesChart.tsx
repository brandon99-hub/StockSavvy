import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesDataPoint {
    date: string;
    amount: number;
}

interface SalesChartProps {
    data: SalesDataPoint[];
    view: 'day' | 'week' | 'month';
}

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const SalesChart: React.FC<SalesChartProps> = ({ data = [], view }) => {
    const getFilteredData = () => {
        if (!Array.isArray(data)) {
            console.error('Invalid data format:', data);
            return [];
        }

        const now = new Date();
        const filteredData = [...data].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        switch (view) {
            case 'day':
                return filteredData.slice(-24);
            case 'week':
                return filteredData.slice(-7);
            case 'month':
            default:
                return filteredData.slice(-30);
        }
    };

    const chartData = getFilteredData();
  
  return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Sales']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
    </div>
  );
};

export default SalesChart;
