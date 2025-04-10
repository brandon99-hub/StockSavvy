// Add ImportMeta interface declaration
declare global {
  interface ImportMeta {
    env: {
      VITE_API_BASE?: string;
    };
  }
}

import { QueryClient } from "@tanstack/react-query";

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Helper function to handle unauthorized responses
const handleUnauthorized = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

// API request function
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    handleUnauthorized();
    throw new Error('No authentication token found');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      // Ensure we're returning an array if the response is expected to be an array
      if (Array.isArray(data)) {
        return data;
      }
      // If it's an object with a 'results' property (common in Django REST Framework)
      if (data && typeof data === 'object' && 'results' in data) {
        return data.results;
      }
      return data;
    } else {
      const text = await response.text();
      return text;
    }
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Create a query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

export default queryClient;
