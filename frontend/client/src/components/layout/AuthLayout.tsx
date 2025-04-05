import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../../lib/auth";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Skeleton } from "../ui/skeleton";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Only redirect if not loading and not authenticated
    if (!isLoading && !isAuthenticated && !redirecting) {
      console.log('Not authenticated, redirecting to login...');
      setRedirecting(true);
      
      // Use setTimeout to ensure redirect happens after state updates
      setTimeout(() => {
        navigate("/login");
      }, 100);
    }
  }, [isAuthenticated, isLoading, navigate, redirecting]);

  const toggleSidebar = () => {
    setMobileOpen(!mobileOpen);
  };

  // Show loading state while checking authentication
  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen bg-gray-100 flex">
        <Skeleton className="hidden md:block md:w-64 h-screen" />
        <div className="flex-1">
          <Skeleton className="h-16 w-full" />
          <div className="p-6">
            <Skeleton className="h-10 w-1/3 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64 mb-6" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar for desktop */}
      <div className="hidden md:block md:w-64 md:min-h-screen transition-all duration-300 ease-in-out">
        <Sidebar />
      </div>
      
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-900 bg-opacity-50" onClick={toggleSidebar}>
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            <Sidebar isMobile={true} setMobileOpen={setMobileOpen} />
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
