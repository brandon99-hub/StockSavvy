// @ts-ignore
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "../ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { Button } from '../ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Product, Category } from '../../types';
import { useToast } from '../../hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useAuth } from '../../lib/auth';
import { Skeleton } from '../ui/skeleton';
import {
  TableContainer,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface InventoryListProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  isLoading?: boolean;
  onEdit: (product: Product) => void;
}

const ITEMS_PER_PAGE = 10;

const InventoryList: React.FC<InventoryListProps> = ({
  products,
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearch,
  isLoading = false,
  onEdit,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredProducts = products
    .filter(product => {
      const matchesCategory = !selectedCategory || product.category_id?.toString() === selectedCategory;
      const matchesSearch = !searchQuery || (
        (product.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (product.sku?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  
  // Paginate products
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  
  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      return await apiRequest('DELETE', `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/category-chart'] });
      
      toast({
        title: 'Product deleted',
        description: 'The product has been successfully deleted.',
      });
    },
    onError: (_error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete the product. Please try again.',
        variant: 'destructive',
      });
    }
  });
  
  const getCategoryName = (categoryId: number | undefined) => {
    return categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-800">Inventory Items</h3>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead 
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sku')}
              >
                SKU {sortField === 'sku' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('quantity')}
              >
                Quantity {sortField === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('sell_price')}
              >
                Price {sortField === 'sell_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => (
              <TableRow key={product.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-gray-600">{product.sku}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono">{product.quantity}</span>
                    {product.quantity <= (product.min_stock_level || 0) && (
                      <Badge variant={product.quantity === 0 ? "destructive" : "secondary"} className="text-xs">
                        {product.quantity === 0 ? "Out of Stock" : "Low Stock"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${product.sell_price?.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(product.category_id)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      product.quantity === 0 ? "destructive" : 
                      product.quantity <= (product.min_stock_level || 0) ? "secondary" : "default"
                    }
                    className="text-xs"
                  >
                    {product.quantity === 0 ? "Out of Stock" : 
                     product.quantity <= (product.min_stock_level || 0) ? "Low Stock" : "In Stock"}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(product.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {paginatedProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-gray-500 py-8">
                  No products found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="p-4 border-t border-gray-200">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(Math.max(1, page - 1))}
                isActive={page > 1}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                isActive={page < totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
};

export default InventoryList;
