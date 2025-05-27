import React, { useState, FC } from "react";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";
import { Product } from "../../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";

interface LowStockTableProps {
  products: Product[];
  onReorder: (productId: number) => Promise<void>;
  categories: Array<{ id: number; name: string }>;
}

// Extend the Product type to include category_name
interface ExtendedProduct extends Omit<Product, 'category'> {
  category_name?: string;
  category: number | { id: number; name: string };
}

const LowStockTable: FC<LowStockTableProps> = ({ products, onReorder, categories }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reorderingProduct, setReorderingProduct] = useState<number | null>(null);
  const [sendingNotification, setSendingNotification] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Get category name helper
  const getCategoryName = (product: ExtendedProduct): string => {
    // First check if we have category_name directly
    if (product.category_name) {
      return product.category_name;
    }
    // Then check if we have a category object
    if (typeof product.category === 'object' && product.category !== null) {
      return product.category.name;
    }
    // Then check if we have a category ID
    if (typeof product.category === 'number') {
      const category = categories.find(c => c.id === product.category);
      return category ? category.name : "Uncategorized";
    }
    return "Uncategorized";
  };

  const handleReorder = async (productId: number) => {
    try {
      setIsLoading(true);
      setReorderingProduct(productId);

      await apiRequest(`/api/products/${productId}/reorder/`, {
        method: "POST",
      });

      toast({
        title: "Success",
        description: "Product reordered successfully",
      });

      onReorder(productId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder product",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setReorderingProduct(null);
    }
  };

  const handleSendNotification = async (productId: number) => {
    try {
      setSendingNotification(productId);

      await apiRequest(`/api/products/${productId}/send_notification/`, {
        method: "POST",
      });

      toast({
        title: "Success",
        description: "Notification sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setSendingNotification(null);
    }
  };

  // Filter and sort low stock products
  const lowStockProducts = products
    .filter(product => 
      product.quantity <= product.min_stock_level
    )
    .sort((a, b) => {
      // Sort by status (out of stock first, then low stock)
      if (a.quantity === 0 && b.quantity !== 0) return -1;
      if (a.quantity !== 0 && b.quantity === 0) return 1;
      // Then sort by how far below min_stock_level they are
      const aDiff = a.quantity - a.min_stock_level;
      const bDiff = b.quantity - b.min_stock_level;
      return aDiff - bDiff;
    });

  // Calculate pagination
  const totalPages = Math.ceil(lowStockProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = lowStockProducts.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Card className="p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Low Stock Inventory</h3>
        <p className="text-sm text-muted-foreground">
          {lowStockProducts.length} items needing attention
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Minimum</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                All products are well stocked
              </TableCell>
            </TableRow>
          ) : (
            paginatedProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(product)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-mono ${
                    product.quantity === 0 ? 'text-red-600' : 
                    product.quantity <= product.min_stock_level / 2 ? 'text-amber-600' : 
                    'text-yellow-600'
                  }`}>{product.quantity}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono">{product.min_stock_level}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={product.quantity === 0 ? "destructive" : "secondary"}
                    className={`capitalize ${
                      product.quantity === 0 ? 'bg-red-100 text-red-800' : 
                      product.quantity <= product.min_stock_level / 2 ? 'bg-amber-100 text-amber-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {product.quantity === 0 ? "Out of Stock" : 
                     product.quantity <= product.min_stock_level / 2 ? "Critical" : 
                     "Low Stock"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendNotification(product.id)}
                    disabled={sendingNotification === product.id}
                    className="w-32"
                  >
                    {sendingNotification === product.id ? (
                      <>
                        <span className="animate-pulse">Sending...</span>
                      </>
                    ) : (
                      "Send Notification"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReorder(product.id)}
                    disabled={isLoading && reorderingProduct === product.id}
                    className="w-24"
                  >
                    {isLoading && reorderingProduct === product.id ? (
                      <>
                        <span className="animate-pulse">Processing...</span>
                      </>
                    ) : (
                      "Reorder Now"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="px-4">
                  Page {currentPage} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
};

export default LowStockTable;