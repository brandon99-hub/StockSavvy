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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Layers,
  ArrowLeftRight,
  Clock
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
  totalCount: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
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
  totalCount,
  totalPages,
  currentPage,
  onPageChange
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Session-based UOM toggle state
  const [uomView, setUomView] = useState<Record<number, 'PCS' | 'CARTON'>>({});

  const toggleUOM = (productId: number) => {
    setUomView(prev => ({
      ...prev,
      [productId]: prev[productId] === 'CARTON' ? 'PCS' : 'CARTON'
    }));
  };

  const getCurrentUOM = (productId: number) => uomView[productId] || 'PCS';

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

  const paginatedProducts = products;

  const handleDelete = async (product: Product) => {
    setProductToDelete(product);
  };


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
    } catch (error: any) {
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

  const getStockStatus = (product: Product) => {
    const quantity = product.master_quantity || 0;
    const minStockLevel = product.min_stock_level || 0;

    // Only 'Pending' if there's no master stock AND no shop has recorded anything
    if (quantity === 0 && !product.has_shop_inventory) {
      return { status: 'Pending', color: 'bg-gray-100 text-gray-600' };
    }

    if (quantity === 0) return { status: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (quantity <= minStockLevel) return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { status: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const getStockIcon = (product: Product) => {
    const quantity = product.master_quantity || 0;
    const minStockLevel = product.min_stock_level || 0;

    if (quantity === 0 && !product.has_shop_inventory) {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }

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
              <TableHead
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('barcode')}
              >
                Barcode {sortField === 'barcode' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('master_quantity')}
              >
                Master Qty {sortField === 'master_quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-center">UOM</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('buy_price')}
              >
                Unit Cost {sortField === 'buy_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('sell_price')}
              >
                Unit Price {sortField === 'sell_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No products found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const category = categories.find(c => c.id === product.category_id);

                return (
                  <TableRow key={product.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell className="font-mono text-xs">{product.barcode || '-'}</TableCell>
                    <TableCell>{category?.name || 'Uncategorized'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-medium">{product.master_quantity || 0}</span>
                        {product.has_mismatch && product.has_shop_inventory && (
                          <Badge variant="destructive" className="text-[10px] h-4 py-0">
                            Mismatch: {(product.quantity_diff ?? 0) > 0 ? '+' : ''}{product.quantity_diff ?? 0}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.carton_buy_price || (product.pieces_per_carton > 1) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUOM(product.id)}
                          className="h-7 px-2 text-[10px] font-bold"
                        >
                          {getCurrentUOM(product.id)}
                          <ArrowLeftRight className="ml-1 h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-gray-400 text-xs">PCS</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(
                        getCurrentUOM(product.id) === 'CARTON'
                          ? product.carton_buy_price || (product.buy_price * product.pieces_per_carton)
                          : product.buy_price
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-600">
                      {formatCurrency(
                        getCurrentUOM(product.id) === 'CARTON'
                          ? product.carton_sell_price || (product.sell_price * product.pieces_per_carton)
                          : product.sell_price
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStockIcon(product)}
                        <Badge variant="outline" className={`${getStockStatus(product).color} border-none`}>
                          {getStockStatus(product).status}
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
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                isActive={currentPage > 1}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} (Total: {totalCount})
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                isActive={currentPage < totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
};

export default InventoryList;
