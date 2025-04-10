import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface CategoryChartProps {
  data: {
    id: number;
    name: string;
    percentage: number;
    value: number;
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

const CategoryChart: React.FC<CategoryChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Sort data by value in descending order
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Colors for the chart
    const colors = [
      'rgba(59, 130, 246, 0.8)',   // Blue
      'rgba(16, 185, 129, 0.8)',   // Green
      'rgba(245, 158, 11, 0.8)',   // Yellow
      'rgba(239, 68, 68, 0.8)',    // Red
      'rgba(139, 92, 246, 0.8)',   // Purple
    ];

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sortedData.map(item => item.name),
        datasets: [{
          data: sortedData.map(item => item.value),
          backgroundColor: sortedData.map((_, index) => colors[index % colors.length]),
          borderColor: 'white',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const percentage = sortedData[context.dataIndex].percentage;
                return `${context.label}: ${formatCurrency(value)} (${percentage.toFixed(1)}%)`;
              }
            }
          }
        },
        cutout: '60%',
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Category Distribution</h3>
      </div>
      <div className="h-64">
        <canvas ref={chartRef} />
      </div>
      {(!data || data.length === 0) && (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No category data available
        </div>
      )}
    </div>
  );
};

export default CategoryChart;
