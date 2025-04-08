import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  login: (credentials: { username: string; password: string }) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user data from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
        // Ensure token is stored in localStorage
        if (userData.token) {
          localStorage.setItem('token', userData.token);
        }
        console.log('User loaded from localStorage:', userData.username);
      }
    } catch (err) {
      console.error('Error loading user data from localStorage:', err);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login function
  const login = async (credentials: { username: string; password: string }): Promise<User> => {
    try {
      console.log('Logging in with:', credentials.username);
      
      const response = await fetch(`${API_BASE_URL}/api/users/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Login failed");
      }

      const userData = await response.json();
      
      if (!userData.id) {
        throw new Error("Invalid user data received");
      }

      // Get token from response data
      const token = userData.token;
      
      if (!token) {
        throw new Error("No authentication token received");
      }

      // Create user object with token
      const userWithToken = {
        ...userData,
        token
      };
      
      console.log('Login successful for user:', userData.username);
      
      // Store both user data and token
      setUser(userWithToken);
      setIsAuthenticated(true);
      localStorage.setItem("user", JSON.stringify(userWithToken));
      localStorage.setItem("token", token);
      
      return userWithToken;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    try {
      // Clear localStorage and state
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUser(null);
      setIsAuthenticated(false);
      
      // Attempt to call logout endpoint but don't wait for it
      fetch(`${API_BASE_URL}/api/users/logout/`, {
        method: "POST",
      }).catch(err => console.error("Logout error:", err));
      
    } catch (err) {
      console.error("Error during logout:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
