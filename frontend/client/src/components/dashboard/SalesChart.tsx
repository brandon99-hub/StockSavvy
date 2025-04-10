import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "../ui/card";
import Chart from 'chart.js/auto';

interface SalesChartProps {
  data: {
    date: string;
    amount: number;
  }[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  
  useEffect(() => {
    if (!chartRef.current || !data) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter and format data based on view
    const now = new Date();
    const filteredData = sortedData.filter(item => {
      const itemDate = new Date(item.date);
      switch (view) {
        case 'day':
          return itemDate.getDate() === now.getDate() &&
                 itemDate.getMonth() === now.getMonth() &&
                 itemDate.getFullYear() === now.getFullYear();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return itemDate >= weekAgo;
        case 'month':
          return itemDate.getMonth() === now.getMonth() &&
                 itemDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });

    // Format dates based on view
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      switch (view) {
        case 'day':
          return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
        case 'week':
          return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' });
        case 'month':
          return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
        default:
          return date.toLocaleDateString('en-KE');
      }
    };

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filteredData.map(item => formatDate(item.date)),
        datasets: [{
          label: 'Sales',
          data: filteredData.map(item => item.amount),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                return `Sales: ${formatCurrency(value)}`;
              }
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value as number)
            }
          }
        }
      }
    });
  }, [data, view]);
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Sales Overview</h3>
        <div className="flex space-x-2">
          <button 
            type="button"
            className={`px-3 py-1.5 text-sm rounded ${view === 'day' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button 
            type="button"
            className={`px-3 py-1.5 text-sm rounded ${view === 'week' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button 
            type="button"
            className={`px-3 py-1.5 text-sm rounded ${view === 'month' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
        </div>
      </div>
      <div className="h-64">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};

export default SalesChart;
