import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "../ui/card";
import Chart from 'chart.js/auto';

interface SalesChartProps {
  data: {
    date: string;
    amount: number;
  }[];
}

const SalesChart = ({ data }: SalesChartProps) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  
  useEffect(() => {
    if (chartRef.current) {
      // Destroy existing chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      // Ensure data is an array
      const safeData = Array.isArray(data) ? data : [];
      
      // Filter data based on selected view
      let filteredData = safeData;
      if (view === 'day') {
        filteredData = safeData.slice(-7); // Last 7 days
      } else if (view === 'week') {
        filteredData = safeData.slice(-4); // Last 4 weeks
      } else if (view === 'month') {
        filteredData = safeData.slice(-12); // Last 12 months
      }
      
      // Format labels based on view
      const labels = filteredData.map(item => {
        const date = new Date(item.date);
        if (view === 'day') {
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (view === 'week') {
          return `Week ${date.getDate()}-${date.getDate() + 6}`;
        } else {
          return date.toLocaleDateString('en-US', { month: 'short' });
        }
      });
      
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Sales',
              data: filteredData.map(item => item.amount),
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  display: true,
                  color: 'rgba(0, 0, 0, 0.05)'
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, view]);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Sales Overview</h3>
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1.5 text-sm rounded ${view === 'day' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button 
            className={`px-3 py-1.5 text-sm rounded ${view === 'week' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button 
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
