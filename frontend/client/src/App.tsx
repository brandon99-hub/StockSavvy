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
import ShopsPage from "./pages/ShopsPage";
import CustomersPage from "./pages/CustomersPage";
import POSPage from "./pages/POSPage";


// Create a simple protected route handler
function ProtectedRoute({
  children,
  requiredRoles
}: {
  children: React.ReactNode,
  requiredRoles?: string[]
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('ProtectedRoute: Not authenticated, redirecting to login...');
      navigate('/login');
    } else if (!isLoading && isAuthenticated && requiredRoles && user) {
      const hasPermission = requiredRoles.includes(user.role);
      if (!hasPermission) {
        console.log('ProtectedRoute: Permission denied for role:', user.role);
        navigate('/');
      }
    }
  }, [isAuthenticated, isLoading, navigate, requiredRoles, user]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) return null;

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
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
        <ProtectedRoute>
          <AuthLayout>
            <DashboardPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <AuthLayout>
            <DashboardPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/inventory">
        <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
          <AuthLayout>
            <InventoryPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/sales">
        <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
          <AuthLayout>
            <SalesPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/pos">
        <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
          <AuthLayout>
            <POSPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
          <AuthLayout>
            <ReportsPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/users">
        <ProtectedRoute requiredRoles={['admin']}>
          <AuthLayout>
            <UsersPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/analytics">
        <ProtectedRoute requiredRoles={['admin', 'manager']}>
          <AuthLayout>
            <AdvancedAnalyticsPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/manage-categories">
        <ProtectedRoute requiredRoles={['admin']}>
          <AuthLayout>
            <CategoryManager />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/shops">
        <ProtectedRoute requiredRoles={['admin']}>
          <AuthLayout>
            <ShopsPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/customers">
        <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
          <AuthLayout>
            <CustomersPage />
          </AuthLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/forecasts">
        <ProtectedRoute requiredRoles={['admin', 'manager']}>
          <AuthLayout>
            <ForecastsPage />
          </AuthLayout>
        </ProtectedRoute>
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
