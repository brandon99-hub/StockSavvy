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
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    
    if (response.status === 403) {
      throw new Error('Forbidden: You do not have permission to access this resource');
    }
    
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Error: ${response.status} ${response.statusText}`);
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
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Invalid token format');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
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
