// @ts-ignore
import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { apiRequest } from "./queryClient";

interface AuthContextType {
  user: User | null;
  login: (credentials: { username: string; password: string }) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL
// @ts-ignore
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    try {
      console.log('Attempting login with credentials:', credentials.username);
      
      const response = await apiRequest('/api/users/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // This is important for cookies
      });

      if (!response || typeof response !== 'object') {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response from server');
      }

      // Extract token and user data
      const { token, ...userData } = response;
      
      // Ensure token is a string
      if (typeof token !== 'string') {
        console.error('Token is not a string:', token);
        throw new Error('Invalid token format received from server');
      }
      
      // Store user data and token
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      
      console.log('Login successful');
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      // Clear any stale data
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      throw error;
    }
  };

  const logout = () => {
    try {
      // Clear user data and token
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Call the logout endpoint
      apiRequest('/api/users/logout/', {
        method: 'POST',
        credentials: 'include',
      }).catch(console.error); // Don't wait for the response
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
