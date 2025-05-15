// @ts-ignore
import React, { useEffect } from "react";
import { Switch, Route, useLocation, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider, useAuth } from "./lib/auth";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import SalesPage from "./pages/SalesPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import AdvancedAnalyticsPage from "./pages/AdvancedAnalyticsPage";
import AuthLayout from "./components/layout/AuthLayout";
import NotFound from "./pages/not-found";
import CategoryManager from './components/dashboard/CategoryManager';
import ForecastsPage from "./pages/ForecastsPage";

// Create a simple protected route handler
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('ProtectedRoute: Not authenticated, redirecting to login...');
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}

// Handle login redirect if already authenticated
function LoginRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('LoginRedirect: Already authenticated, redirecting to dashboard...');
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return isAuthenticated ? null : <LoginPage />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <LoginRedirect />
      </Route>

      <Route path="/">
        <AuthLayout>
          <DashboardPage />
        </AuthLayout>
      </Route>

      <Route path="/dashboard">
        <AuthLayout>
          <DashboardPage />
        </AuthLayout>
      </Route>

      <Route path="/inventory">
        <AuthLayout>
          <InventoryPage />
        </AuthLayout>
      </Route>

      <Route path="/sales">
        <AuthLayout>
          <SalesPage />
        </AuthLayout>
      </Route>

      <Route path="/reports">
        <AuthLayout>
          <ReportsPage />
        </AuthLayout>
      </Route>

      <Route path="/users">
        <AuthLayout>
          <UsersPage />
        </AuthLayout>
      </Route>

      <Route path="/analytics">
        <AuthLayout>
          <AdvancedAnalyticsPage />
        </AuthLayout>
      </Route>
      
      <Route path="/manage-categories">
        <AuthLayout>
          <CategoryManager />
        </AuthLayout>
      </Route>
      
      <Route path="/forecasts">
        <AuthLayout>
          <ForecastsPage />
        </AuthLayout>
      </Route>
      
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
