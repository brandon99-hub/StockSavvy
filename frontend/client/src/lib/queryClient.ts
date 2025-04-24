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
  const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
  const token = localStorage.getItem('token');

  // Format token if it doesn't include user ID
  let formattedToken = token;
  if (token && !token.includes('_')) {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        formattedToken = `${token}_${userData.id}`;
        // Update the token in localStorage
        localStorage.setItem('token', formattedToken);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(formattedToken ? { 'Authorization': `Bearer ${formattedToken}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${baseURL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Clear stored data on authentication error
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        handleUnauthorized();
      }

      // Try to parse error response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (parseError) {
        // If we can't parse the error response, just use the default error message
        console.error('Error parsing error response:', parseError);
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
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
