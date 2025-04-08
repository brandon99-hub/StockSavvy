import axios from 'axios';

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
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.token) {
          config.headers['Authorization'] = `Bearer ${userData.token}`;
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
      }
    }

    // Add CSRF token for non-GET requests
    if (config.method !== 'get') {
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

// API request methods
export const apiClient = {
  // GET request
  async get<T>(url: string, params = {}): Promise<T> {
    const response = await api.get<T>(url, { params });
    return response.data;
  },
  
  // POST request
  async post<T>(url: string, data = {}): Promise<T> {
    const response = await api.post<T>(url, data);
    return response.data;
  },
  
  // PUT request
  async put<T>(url: string, data = {}): Promise<T> {
    const response = await api.put<T>(url, data);
    return response.data;
  },
  
  // PATCH request
  async patch<T>(url: string, data = {}): Promise<T> {
    const response = await api.patch<T>(url, data);
    return response.data;
  },
  
  // DELETE request
  async delete<T>(url: string): Promise<T> {
    const response = await api.delete<T>(url);
    return response.data;
  },
  
  // Login request (returns user with token)
  async login(username: string, password: string) {
    const response = await api.post('/api/users/login/', { username, password });
    
    // Get token from response headers or body
    const token = response.headers.authorization || 
                 (response.data.token ? response.data.token : null);
    
    // Create user object with token
    const user = {
      ...response.data,
      token: token ? token.replace('Bearer ', '') : null
    };
    
    // Store user in localStorage
    localStorage.setItem('user', JSON.stringify(user));
    
    return user;
  },
  
  // Logout request
  async logout() {
    try {
      await api.post('/api/users/logout/');
    } finally {
      localStorage.removeItem('user');
    }
  }
};

export default apiClient; 