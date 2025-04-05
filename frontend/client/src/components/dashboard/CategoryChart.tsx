import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface CategoryChartProps {
  data: {
    id: number;
    name: string;
    percentage: number;
  }[];
}

const CategoryChart = ({ data }: CategoryChartProps) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  
  // Array of colors for the chart
  const chartColors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(245, 158, 11, 0.8)',   // yellow
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(236, 72, 153, 0.8)',   // pink
  ];
  
  useEffect(() => {
    if (chartRef.current) {
      // Destroy existing chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.map(item => item.name),
            datasets: [{
              data: data.map(item => item.percentage),
              backgroundColor: data.map((_, index) => chartColors[index % chartColors.length]),
              borderWidth: 0
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
            cutout: '70%'
          }
        });
      }
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Stock by Category</h3>
      </div>
      <div className="h-64 flex items-center justify-center">
        <canvas ref={chartRef} />
      </div>
      <div className="mt-4 space-y-2">
        {data.map((category, index) => (
          <div key={category.id} className="flex items-center justify-between">
            <div className="flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              ></div>
              <span className="text-sm text-gray-600">{category.name}</span>
            </div>
            <span className="text-sm font-medium">{category.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryChart;
