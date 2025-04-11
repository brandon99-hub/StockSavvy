import React from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Activity } from '../../types';
import { apiRequest } from '../../lib/queryClient';
import { Loader2 } from 'lucide-react';
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

interface RecentActivityTableProps {
  activities: Activity[];
  queryClient: QueryClient;
}

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  activities,
  queryClient,
}) => {
  const { data: recentActivities, isLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activities/'],
    queryFn: async () => {
      const data = await apiRequest('/api/activities/');
      // Ensure activities are sorted by created_at in descending order
      return Array.isArray(data) ? data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) : [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { toast } = useToast();
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'product_added':
        return '📦';
      case 'product_updated':
        return '🔄';
      case 'product_deleted':
        return '🗑️';
      case 'sale_created':
        return '💰';
      case 'stock_updated':
        return '📊';
      default:
        return '📝';
    }
  };

  const getActivityMessage = (activity: Activity) => {
    if (activity.message) return activity.message;
    
    switch (activity.type) {
      case 'product_added':
        return `Added new product: ${activity.product?.name || 'Unknown product'}`;
      case 'product_updated':
        return `Updated product: ${activity.product?.name || 'Unknown product'}`;
      case 'product_deleted':
        return `Deleted product: ${activity.details?.product_name || 'Unknown product'}`;
      case 'sale_created':
        return `New sale: ${activity.details?.amount || 0} KES`;
      case 'stock_updated':
        return `Stock updated for: ${activity.product?.name || 'Unknown product'}`;
      default:
        return activity.description;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        <div className="h-96 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

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
            {recentActivities?.map((activity) => (
              <TableRow key={activity.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center">
                    <div className="text-2xl">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{getActivityMessage(activity)}</p>
                    </div>
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
            ))}
            {(!recentActivities || recentActivities.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No recent activity
                </TableCell>
              </TableRow>
            )}
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
          }}
        >
          View all activity
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RecentActivityTable;
