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
  selectedShop: number | 'all';
}

const ITEMS_PER_PAGE = 6;

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  activities,
  queryClient,
  selectedShop
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'product_added': return '📦';
      case 'product_updated': return '🔄';
      case 'product_deleted': return '🗑️';
      case 'sale_created': return '💰';
      case 'stock_updated': return '📊';
      case 'restock': return '📥';
      case 'low_stock': return '⚠️';
      default: return '📝';
    }
  };

  const getActivityMessage = (activity: Activity) => {
    if (activity.type === 'sale_created') {
      return activity.description; // Description already contains "Transaction #... - KSh ..."
    }
    return activity.description;
  };

  // Calculate pagination
  const totalPages = Math.ceil((activities?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedActivities = activities?.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <Card className="lg:col-span-2 shadow-sm border-gray-200 overflow-hidden">
      <CardHeader className="border-b border-gray-100 px-6 py-4 flex flex-row justify-between items-center bg-gray-50/30">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
          <p className="text-xs text-gray-500">Latest events {selectedShop === 'all' ? 'across all locations' : 'for this shop'}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
          onClick={() => {
            if (queryClient) {
              queryClient.invalidateQueries({ queryKey: ["dashboard", "activities"] });
              toast({
                title: "Refreshing",
                description: "Updating activity list...",
              });
            }
          }}
        >
          <i className="fas fa-sync-alt text-gray-400"></i>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-[45%]">Activity</TableHead>
              {selectedShop === 'all' && <TableHead>Shop</TableHead>}
              <TableHead>User</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedActivities?.map((activity) => (
              <TableRow key={activity.id} className="hover:bg-gray-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-gray-100 shadow-sm text-lg">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getActivityMessage(activity)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{activity.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                </TableCell>
                {selectedShop === 'all' && (
                  <TableCell>
                    <Badge variant="outline" className="font-normal border-gray-100 bg-gray-50">
                      {activity.shop_name || 'N/A'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-sm text-gray-600 font-medium">
                  {activity.user_name || 'System'}
                </TableCell>
                <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={activity.status === 'completed' ? 'success' : 'outline'}
                    className={`px-2 text-[10px] uppercase tracking-wider font-bold rounded-md`}
                  >
                    {activity.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!paginatedActivities || paginatedActivities.length === 0) && (
              <TableRow>
                <TableCell colSpan={selectedShop === 'all' ? 5 : 4} className="text-center text-gray-500 py-12">
                  <div className="flex flex-col items-center gap-2">
                    <i className="fas fa-history text-3xl text-gray-200"></i>
                    <p>No recent activity recorded</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/30">
        <p className="text-xs text-gray-500">
          Showing {startIndex + 1}-{Math.min(endIndex, activities?.length || 0)} of {activities?.length || 0}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 shadow-sm bg-white"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 shadow-sm bg-white"
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default RecentActivityTable;
