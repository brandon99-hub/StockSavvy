import { QueryClient } from "@tanstack/react-query";

// Base URL for API requests
// @ts-ignore
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || response.statusText;
    
    if (response.status === 401) {
      // Clear token and redirect to login on authentication error
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
    
    if (response.status === 403) {
      throw new Error('Permission denied');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

// API request function
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    // The backend expects the token directly, not as a Bearer token
    headers['Authorization'] = token;
  }
  
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
      queryFn: async ({ queryKey }) => {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          // Use the same token format as apiRequest
          headers['Authorization'] = token;
        }
        
        const response = await fetch(`${API_BASE_URL}${queryKey[0]}`, {
          headers,
        });
        
        return handleResponse(response);
      },
      retry: (failureCount, error) => {
        // Don't retry on authentication or permission errors
        if (error instanceof Error && 
            (error.message === 'Authentication required' || 
             error.message === 'Permission denied')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

export default queryClient;
