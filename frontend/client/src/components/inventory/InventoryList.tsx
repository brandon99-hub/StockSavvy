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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Product, Category } from '../../types';
import { useToast } from '../../hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
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
import {
    Edit, 
    Trash2, 
    Plus, 
    Search, 
    AlertTriangle, 
    CheckCircle, 
    XCircle,
    Layers
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface InventoryListProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  isLoading?: boolean;
  onEdit: (product: Product) => void;
  onViewBatches: (product: Product) => void;
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
  onViewBatches,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

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

  const handleDelete = async (product: Product) => {
    setProductToDelete(product);
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setDeleteError(null);
      // The delete method might return undefined for 204 No Content responses
      await apiClient.delete(`/api/products/${productToDelete.id}/`);

      // If we get here, the deletion was successful (no error was thrown)
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'activities'] });
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      setProductToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);

      // Extract the error message from the response
      const errorMessage = error.response?.data?.detail || 'Failed to delete product. Please try again.';
      const isSalesError = errorMessage.includes('existing sales');

      // Set the error message to display in the dialog
      setDeleteError(errorMessage);

      // Only show toast for non-sales errors (sales errors will be shown in the dialog)
      if (!isSalesError) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setProductToDelete(null);
      }
    }
  };

  const getCategoryName = (categoryId: number | undefined) => {
    return categories.find(c => c.id === categoryId)?.name || 'Uncategorized';
  };

  const getStockStatus = (quantity: number, minStockLevel: number) => {
    if (quantity === 0) return { status: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (quantity <= minStockLevel) return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { status: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const getStockIcon = (quantity: number, minStockLevel: number) => {
    if (quantity === 0) return <XCircle className="w-4 h-4 text-red-500" />;
    if (quantity <= minStockLevel) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Inventory Items</h3>
          <div className="relative w-64">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
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
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('quantity')}
              >
                Quantity {sortField === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('buy_price')}
              >
                Buy Price {sortField === 'buy_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('sell_price')}
              >
                Sell Price {sortField === 'sell_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const stockStatus = getStockStatus(product.quantity, product.min_stock_level);
                const category = categories.find(c => c.id === product.category_id);

                return (
                  <TableRow key={product.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.description || '-'}</TableCell>
                    <TableCell>{category?.name || 'Uncategorized'}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">KSH {formatCurrency(product.buy_price)}</TableCell>
                    <TableCell className="text-right">KSH {formatCurrency(product.sell_price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStockIcon(product.quantity, product.min_stock_level)}
                        <Badge className={stockStatus.color}>
                          {stockStatus.status}
                        </Badge>
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(product)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewBatches(product)}
                            className="text-green-600 hover:text-green-700"
                            title="View Batches"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={!!productToDelete} 
          onOpenChange={(open) => {
            if (!open) {
              setProductToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteError ? 'Cannot Delete Product' : 'Delete Product'}
              </AlertDialogTitle>
              {deleteError ? (
                <div>
                  <AlertDialogDescription className="text-red-500 font-medium mb-2">
                    {deleteError}
                  </AlertDialogDescription>
                  <AlertDialogDescription>
                    Products that have been sold cannot be deleted to maintain sales history integrity.
                    Consider archiving the product or marking it as inactive instead.
                  </AlertDialogDescription>
                </div>
              ) : (
                <AlertDialogDescription>
                  Are you sure you want to delete the product "{productToDelete?.name}"? 
                  This action cannot be undone and will permanently remove the product from your inventory.
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {deleteError ? 'Close' : 'Cancel'}
              </AlertDialogCancel>
              {!deleteError && (
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
