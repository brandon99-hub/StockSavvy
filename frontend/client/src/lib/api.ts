import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuth } from './auth';
import { APIResponse, ErrorResponse } from '../types';

// Add type declaration for ImportMeta
declare global {
  interface ImportMeta {
    env: {
      VITE_API_URL: string;
      [key: string]: string | undefined;
    };
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class APIError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export const createApiClient = (): AxiosInstance => {
const api = axios.create({
        baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
        },
});

    // Request interceptor
api.interceptors.request.use(
  (config) => {
            const { getToken } = useAuth();
            const token = getToken();
    if (token) {
                config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

    // Response interceptor
api.interceptors.response.use(
  (response) => response,
        (error: AxiosError<ErrorResponse>) => {
            if (error.response) {
                const { status, data } = error.response;
                
                // Handle token expiration
                if (status === 401) {
                    const { logout } = useAuth();
                    logout();
      window.location.href = '/login';
                    return Promise.reject(new APIError('Session expired', status));
                }

                // Handle validation errors
                if (status === 400 && data.detail) {
                    return Promise.reject(new APIError(data.detail, status));
                }

                // Handle server errors
                if (status >= 500) {
                    return Promise.reject(new APIError('Server error occurred', status));
                }

                return Promise.reject(new APIError(data.detail || 'An error occurred', status));
            }

            if (error.request) {
                return Promise.reject(new APIError('No response received from server'));
            }

            return Promise.reject(new APIError('Error setting up request'));
        }
    );

    return api;
};

export const apiRequest = async <T>(
    endpoint: string,
    config: AxiosRequestConfig = {}
): Promise<APIResponse<T>> => {
    try {
        const api = createApiClient();
        const response: AxiosResponse<T> = await api({
            url: endpoint,
            ...config,
        });

        return {
            data: response.data,
            status: response.status,
        };
    } catch (error) {
        if (error instanceof APIError) {
            return {
                error: {
                    message: error.message,
                    code: error.code,
                },
                status: error.status || 500,
            };
        }

        return {
            error: {
                message: 'An unexpected error occurred',
            },
            status: 500,
        };
    }
};

// Helper function to handle paginated responses
export const handlePaginatedResponse = <T>(response: APIResponse<{
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}>): APIResponse<{
    data: T[];
    total: number;
    hasMore: boolean;
}> => {
    if (response.error) {
        return {
            error: response.error,
            status: response.status,
        };
    }

    if (!response.data) {
        return {
            error: {
                message: 'No data received',
            },
            status: 404,
        };
    }

    return {
        data: {
            data: response.data.results,
            total: response.data.count,
            hasMore: !!response.data.next,
        },
        status: response.status,
    };
};

// Helper to get CSRF token from cookies
function getCsrfToken(): string | null {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  return cookieValue || null;
}

// API request methods
export const apiClient = {
  // Login request
  async login(username: string, password: string) {
    const response = await apiClient.post('/api/users/login/', { username, password });
    const { token, ...userData } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    return response.data;
  },

  // Logout request
  async logout() {
    try {
      await apiClient.post('/api/users/logout/');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  // Generic request methods
  async get<T>(url: string, params = {}) {
    const response = await apiClient.get<T>(url, { params });
    return response.data;
  },

  async post<T>(url: string, data = {}) {
    const response = await apiClient.post<T>(url, data);
    return response.data;
  },

  async put<T>(url: string, data = {}) {
    const response = await apiClient.put<T>(url, data);
    return response.data;
  },

  async delete<T>(url: string) {
    const response = await apiClient.delete<T>(url);
    return response.data;
  }
};

export default apiClient;