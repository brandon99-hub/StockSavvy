import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "../../hooks/use-toast";
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardFooter 
} from '../ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { Button } from '../ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { Badge } from '../ui/badge';
import { Activity } from '../../types';

interface RecentActivityTableProps {
  activities: Activity[];
  queryClient?: any; // Optional QueryClient for refetching
}

const RecentActivityTable = ({ activities, queryClient }: RecentActivityTableProps) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 4;
  const { toast } = useToast();
  
  // Sort activities by created_at in descending order
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const totalPages = Math.ceil(sortedActivities.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const displayActivities = sortedActivities.slice(startIndex, startIndex + itemsPerPage);
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stock_added':
        return { icon: 'fas fa-plus', bg: 'bg-blue-100', color: 'text-blue-500' };
      case 'stock_removed':
        return { icon: 'fas fa-minus', bg: 'bg-red-100', color: 'text-red-500' };
      case 'sale':
        return { icon: 'fas fa-shopping-cart', bg: 'bg-green-100', color: 'text-green-500' };
      case 'order':
        return { icon: 'fas fa-truck', bg: 'bg-purple-100', color: 'text-purple-500' };
      default:
        return { icon: 'fas fa-info-circle', bg: 'bg-gray-100', color: 'text-gray-500' };
    }
  };
  
  const getActivityTitle = (type: string) => {
    switch (type) {
      case 'stock_added':
        return 'Stock Added';
      case 'stock_removed':
        return 'Stock Removed';
      case 'sale':
        return 'Sale Completed';
      case 'order':
        return 'Order Placed';
      default:
        return 'Activity';
    }
  };
  
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };
  
  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };
  
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={() => {
            // If we have queryClient, use it for data refetching; otherwise fallback to page reload
            if (queryClient) {
              // Invalidate all the relevant queries
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
              queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/dashboard/sales-chart'] });
              queryClient.invalidateQueries({ queryKey: ['/api/dashboard/category-chart'] });
              queryClient.invalidateQueries({ queryKey: ['/api/products'] });
              queryClient.invalidateQueries({ queryKey: ['/api/products/low-stock'] });
              
              toast({
                title: "Refreshing Activities",
                description: "Updating the recent activity list...",
              });
            } else {
              // Fallback to page reload
              window.location.reload();
              toast({
                title: "Refreshing Activities",
                description: "Updating the recent activity list...",
              });
            }
          }}
        >
          <i className="fas fa-sync-alt"></i>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Event</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayActivities.map((activity) => {
              const { icon, bg, color } = getActivityIcon(activity.type);
              
              return (
                <TableRow key={activity.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center">
                      <div className={`rounded-full h-8 w-8 flex items-center justify-center ${bg} ${color} mr-3`}>
                        <i className={icon}></i>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {getActivityTitle(activity.type)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {activity.description}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {activity.user.name}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`px-2 text-xs leading-5 font-semibold rounded-full 
                        ${activity.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}`}
                    >
                      {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="p-4 border-t border-gray-200 flex justify-between items-center">
        <Button 
          variant="link" 
          className="text-sm text-blue-600 hover:text-blue-800 font-medium p-0"
          onClick={() => {
            // For demo purposes, we'll show a more elegant modal or dropdown in the future
            // For now, just scroll to top of current activities with animation
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Show a toast notification that's more professional for demos
            toast({
              title: "Viewing Recent Activities",
              description: "Displaying the most recent system activities.",
              variant: "default",
            });
            
            // Refresh the current page data
            setPage(1);
          }}
        >
          View all activity
        </Button>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={handlePreviousPage} 
                className={page === 1 ? 'opacity-50 cursor-not-allowed' : ''} 
              />
            </PaginationItem>
            {Array.from({ length: Math.min(totalPages, 3) }).map((_, index) => (
              <PaginationItem key={index}>
                <Button 
                  variant={page === index + 1 ? 'outline' : 'ghost'}
                  size="sm" 
                  className={`px-3 py-1 text-sm rounded ${page === index + 1 ? 'bg-blue-50 text-blue-600 border-gray-300' : ''}`}
                  onClick={() => setPage(index + 1)}
                >
                  {index + 1}
                </Button>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext 
                onClick={handleNextPage} 
                className={page === totalPages ? 'opacity-50 cursor-not-allowed' : ''} 
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
};

export default RecentActivityTable;
