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
      // Add Bearer prefix to the token
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add CSRF token for non-GET requests
    if (config.method?.toLowerCase() !== 'get') {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
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
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear user data and redirect to login
      localStorage.removeItem('user');
      window.location.href = '/login';

      return Promise.reject(error);
    }

    // Handle 403 Forbidden errors (likely CSRF issue)
    if (error.response && error.response.status === 403) {
      console.warn('403 Forbidden - Possible CSRF token issue or insufficient permissions');
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

// API request methods with URL normalization
export const apiClient = {
  // GET request
  async get<T>(url: string, params = {}): Promise<T> {
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await api.get<T>(normalizedUrl, { params });
    return response.data;
  },

  // POST request
  async post<T>(url: string, data = {}): Promise<T> {
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await api.post<T>(normalizedUrl, data);
    return response.data;
  },

  // PUT request
  async put<T>(url: string, data = {}): Promise<T> {
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await api.put<T>(normalizedUrl, data);
    return response.data;
  },

  // PATCH request
  async patch<T>(url: string, data = {}): Promise<T> {
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await api.patch<T>(normalizedUrl, data);
    return response.data;
  },

  // DELETE request
  async delete<T>(url: string): Promise<T> {
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await api.delete<T>(normalizedUrl);
    return response.data;
  },

  // Login request (returns user with token)
  async login(username: string, password: string) {
    const response = await api.post('/api/users/login/', { username, password });
    
    // Get token from response data
    const userData = response.data;
    
    // Store user in localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userData.token);
    
    return userData;
  },

  // Logout request
  async logout() {
    try {
      await api.post('/api/users/logout/');
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }
};

export default apiClient;