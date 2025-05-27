import React, { useEffect, useState } from 'react';
import apiClient from '../lib/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';
import { getProductIcon, getIconColor } from '../utils/iconMapper';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler);

interface ForecastRow {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  category_id: number;
  category_name: string | null;
  description: string | null;
  forecast_date: string;
  forecast_quantity: number;
  created_at: string;
  model_info: string;
}

interface ForecastsResponse {
  results: ForecastRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const INITIAL_DAYS = 4;
const CARDS_PER_PAGE = 4;
const COLORS = [
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-purple-100',
  'bg-pink-100',
  'bg-indigo-100',
  'bg-teal-100',
];

const ForecastsPage = () => {
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [allDates, setAllDates] = useState<string[]>([]);
  const [chartWindow, setChartWindow] = useState(0); // 0 = first window
  const [cardDateWindows, setCardDateWindows] = useState<Record<number, number>>({});
  const [cardPage, setCardPage] = useState(1);

  useEffect(() => {
    fetchForecasts();
    // eslint-disable-next-line
  }, [search]);

  const fetchForecasts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', '1000');
      const res: ForecastsResponse = await apiClient.get(`/api/products/forecasts/?${params.toString()}`);
      // Get unique dates, sorted ascending
      const uniqueDates = Array.from(new Set(res.results.map(f => f.forecast_date))).sort();
      setAllDates(uniqueDates);
      setForecasts(res.results);
      setCardDateWindows({});
      setChartWindow(0);
      setCardPage(1);
    } catch (err: any) {
      setError('Failed to load forecasts.');
    } finally {
      setLoading(false);
    }
  };

  // Group forecasts by product
  const products = Array.from(
    forecasts.reduce((acc, f) => {
      if (!acc.has(f.product_id)) {
        acc.set(f.product_id, {
          product_id: f.product_id,
          product_name: f.product_name,
          sku: f.sku,
          category_name: f.category_name,
          description: f.description,
          forecasts: {},
        });
      }
      acc.get(f.product_id)!.forecasts[f.forecast_date] = f;
      return acc;
    }, new Map<number, any>()).values()
  );

  // Pagination for cards
  const totalCardPages = Math.ceil(products.length / CARDS_PER_PAGE);
  const paginatedProducts = products.slice((cardPage - 1) * CARDS_PER_PAGE, cardPage * CARDS_PER_PAGE);

  // Chart date window
  const chartDates = allDates.slice(chartWindow * INITIAL_DAYS, (chartWindow + 1) * INITIAL_DAYS);

  // Prepare chart data
  const chartData = {
    labels: chartDates,
    datasets: products.map((p, idx) => ({
      label: p.product_name,
      data: chartDates.map(date => p.forecasts[date]?.forecast_quantity ?? null),
      borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
      backgroundColor: (ctx: any) => {
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, `hsla(${(idx * 60) % 360}, 70%, 70%, 0.4)`);
        gradient.addColorStop(1, `hsla(${(idx * 60) % 360}, 70%, 90%, 0.1)`);
        return gradient;
      },
      fill: true,
      pointRadius: 5,
      pointHoverRadius: 8,
      spanGaps: true,
      tension: 0.4,
    })),
  };

  // Card date windows
  const getCardDates = (productId: number) => {
    const window = cardDateWindows[productId] || 0;
    return allDates.slice(window * INITIAL_DAYS, (window + 1) * INITIAL_DAYS);
  };

  const handleViewMoreDates = (productId: number) => {
    setCardDateWindows(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const handleChartPrev = () => setChartWindow(w => Math.max(0, w - 1));
  const handleChartNext = () => setChartWindow(w => (w + 1) * INITIAL_DAYS < allDates.length ? w + 1 : w);

  const handleCardPagePrev = () => setCardPage(p => Math.max(1, p - 1));
  const handleCardPageNext = () => setCardPage(p => Math.min(totalCardPages, p + 1));

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold mb-8 text-blue-900 tracking-tight">Forecasts</h1>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <input
          type="text"
          className="border-2 border-blue-200 rounded-lg px-4 py-2 w-full md:w-96 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          placeholder="Search by product, category, or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-gray-500">No forecasts available.</div>
      ) : (
        <>
          {/* Card Pagination Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-gray-600">
              Showing {((cardPage - 1) * CARDS_PER_PAGE) + 1} - {Math.min(cardPage * CARDS_PER_PAGE, products.length)} of {products.length} products
            </div>
            <div className="space-x-2">
              <button
                className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
                onClick={handleCardPagePrev}
                disabled={cardPage === 1}
              >
                Previous
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
                onClick={handleCardPageNext}
                disabled={cardPage === totalCardPages}
              >
                Next
              </button>
            </div>
          </div>
          {/* 2 cards per row on large screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-12">
            {paginatedProducts.map((p, idx) => {
              const cardDates = getCardDates(p.product_id);
              const color = COLORS[idx % COLORS.length];
              const Icon = getProductIcon(p.product_name, p.category_name);
              const iconColor = getIconColor(p.category_name);
              return (
                <div
                  key={p.product_id}
                  className={`relative group bg-white rounded-2xl shadow-lg flex flex-col h-full border-t-4 ${color} transition-transform hover:-translate-y-1 hover:shadow-2xl`}
                >
                  <div className="absolute -top-6 left-6 text-4xl select-none">
                    <Icon className="w-10 h-10" style={{ color: '#374151' }} />
                  </div>
                  <div className="p-6 pt-10 flex-1 flex flex-col">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-900 truncate" title={p.product_name}>{p.product_name}</span>
                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5 font-semibold">SKU: {p.sku}</span>
                    </div>
                    <div className="mb-1 text-sm text-blue-700 font-medium flex items-center gap-2">
                      <span className="inline-block bg-blue-50 rounded px-2 py-0.5">{p.category_name || 'No category'}</span>
                    </div>
                    <div className="mb-3 text-xs text-gray-500 italic line-clamp-2" title={p.description || undefined}>{p.description || <span className="text-gray-300">No description</span>}</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-auto border-collapse text-sm">
                        <thead>
                          <tr>
                            {cardDates.map(date => (
                              <th key={date} className="px-2 py-1 font-semibold border-b text-center bg-blue-50 text-blue-800">{date}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {cardDates.map(date => (
                              <td key={date} className="px-2 py-1 text-center font-bold text-blue-700">
                                {p.forecasts[date]?.forecast_quantity ?? '-'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {cardDates.length < allDates.length && (
                      <div className="flex justify-center mt-3">
                        <button
                          className="px-4 py-1 rounded bg-blue-100 text-blue-700 font-semibold shadow hover:bg-blue-200 transition"
                          onClick={() => handleViewMoreDates(p.product_id)}
                        >
                          View More Dates
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-blue-900">Forecast Trends</h2>
              <div className="space-x-2">
                <button
                  className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
                  onClick={handleChartPrev}
                  disabled={chartWindow === 0}
                >
                  Previous {INITIAL_DAYS} Days
                </button>
                <button
                  className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
                  onClick={handleChartNext}
                  disabled={(chartWindow + 1) * INITIAL_DAYS >= allDates.length}
                >
                  Next {INITIAL_DAYS} Days
                </button>
              </div>
            </div>
            <Line data={chartData} options={{
              responsive: true,
              animation: {
                duration: 1200,
                easing: 'easeInOutQuart',
              },
              plugins: {
                legend: { position: 'top', labels: { font: { size: 15 } } },
                tooltip: { mode: 'index', intersect: false },
              },
              scales: {
                x: { title: { display: true, text: 'Date' }, grid: { display: false } },
                y: { title: { display: true, text: 'Forecast Qty' }, beginAtZero: true, grid: { color: '#e5e7eb' } },
              },
            }} />
          </div>
        </>
      )}
    </div>
  );
};

export default ForecastsPage;
