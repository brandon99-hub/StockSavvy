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

interface InventoryListProps {
  products: Product[];
  categories: Category[];
  onEdit?: (product: Product) => void;
  isLoading?: boolean;
}

const InventoryList = ({ products, categories, onEdit, isLoading }: InventoryListProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  
  const itemsPerPage = 10;
  
  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = categoryFilter === null || product.category?.id === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  // Paginate products
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  
  // Delete product mutation
  const handleDelete = async (product: Product) => {
    try {
      await apiRequest(`/products/${product.id}/`, { method: "DELETE" });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/products'] });
      queryClient.invalidateQueries({ queryKey: ['/products/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/dashboard/category-chart'] });
      
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      
      setShowDeleteDialog(false);
      setProductToDelete(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };
  
  const confirmDelete = () => {
    if (productToDelete) {
      handleDelete(productToDelete);
    }
  };
  
  const getCategoryName = (category: Category | null | undefined) => {
    return category?.name || 'Uncategorized';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-xl font-semibold">Inventory Items</h2>
            <div className="flex space-x-2">
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // Reset to first page when searching
                }}
                className="w-full max-w-xs"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {categoryFilter !== null 
                      ? `Category: ${getCategoryName(categories.find(c => c.id === categoryFilter))}` 
                      : 'All Categories'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
                    All Categories
                  </DropdownMenuItem>
                  {categories.map(category => (
                    <DropdownMenuItem 
                      key={category.id} 
                      onClick={() => setCategoryFilter(category.id)}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{getCategoryName(product.category)}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell>KSh {product.buy_price}</TableCell>
                  <TableCell>KSh {product.sell_price}</TableCell>
                  <TableCell>
                    {product.quantity <= 0 ? (
                      <Badge variant="destructive">Out of Stock</Badge>
                    ) : product.quantity <= product.min_stock_level ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800">Low Stock</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                          <i className="fas fa-edit text-blue-500"></i>
                        </Button>
                      )}
                      {product.quantity <= product.min_stock_level && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                          <i className="fas fa-restock text-amber-500"></i>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product)}>
                        <i className="fas fa-trash text-red-500"></i>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No products found. Try a different search or add a new product.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {Math.min(filteredProducts.length, 1 + startIndex)}-{Math.min(filteredProducts.length, startIndex + itemsPerPage)} of {filteredProducts.length} items
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 3) }).map((_, index) => (
                <PaginationItem key={index}>
                  <Button 
                    variant={page === index + 1 ? 'outline' : 'ghost'}
                    size="icon"
                    onClick={() => setPage(index + 1)}
                  >
                    {index + 1}
                  </Button>
                </PaginationItem>
              ))}
              {totalPages > 3 && (
                <PaginationItem>
                  <span className="px-2">...</span>
                </PaginationItem>
              )}
              {totalPages > 3 && (
                <PaginationItem>
                  <Button 
                    variant={page === totalPages ? 'outline' : 'ghost'}
                    size="icon"
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </Button>
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {productToDelete?.name}? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InventoryList;
