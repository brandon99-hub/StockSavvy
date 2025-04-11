import React, { useState } from 'react';
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

const ITEMS_PER_PAGE = 6;

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  activities,
  queryClient,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { data: recentActivities, isLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activities/'],
    queryFn: async () => {
      const data = await apiRequest('/api/activities/');
      return Array.isArray(data) ? data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) : [];
    },
    refetchInterval: 30000,
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
    switch (activity.type) {
      case 'product_added':
        return `Added new product: ${activity.description}`;
      case 'product_updated':
        return `Updated product: ${activity.description}`;
      case 'product_deleted':
        return `Deleted product: ${activity.description}`;
      case 'sale_created':
        return `New sale: ${activity.description}`;
      case 'stock_updated':
        return `Stock updated: ${activity.description}`;
      default:
        return activity.description;
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil((recentActivities?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedActivities = recentActivities?.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
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
            if (queryClient) {
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
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
              <TableHead>Description</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedActivities?.map((activity) => (
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
                  {activity.user_name}
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
            {(!paginatedActivities || paginatedActivities.length === 0) && (
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
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
};

export default RecentActivityTable;
