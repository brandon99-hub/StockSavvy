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

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'An error occurred');
  }
  return response.json();
}

// API request function
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  // Ensure token is a string
  if (token && typeof token !== 'string') {
    console.error('Invalid token format:', token);
    localStorage.removeItem('token');
    throw new Error('Invalid token format');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  
  return handleResponse(response);
};

// Create a query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default queryClient;
