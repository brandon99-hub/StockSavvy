import axios from 'axios';

// Add type declaration for ImportMeta
declare global {
  interface ImportMeta {
    env: {
      VITE_API_URL: string;
      [key: string]: string | undefined;
    };
  }
}

// Create base axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Add token with Bearer prefix
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear user data and redirect to login
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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
    const response = await api.post('/api/users/login/', { username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  },

  // Logout request
  async logout() {
    try {
      await api.post('/api/users/logout/');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  // Generic request methods
  async get<T>(url: string, params = {}) {
    const response = await api.get<T>(url, { params });
    return response.data;
  },

  async post<T>(url: string, data = {}) {
    const response = await api.post<T>(url, data);
    return response.data;
  },

  async put<T>(url: string, data = {}) {
    const response = await api.put<T>(url, data);
    return response.data;
  },

  async delete<T>(url: string) {
    const response = await api.delete<T>(url);
    return response.data;
  }
};

export default apiClient;