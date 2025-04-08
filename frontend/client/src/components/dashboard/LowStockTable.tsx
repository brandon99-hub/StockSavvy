import React, { useState } from "react";
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

interface LowStockTableProps {
  products: Product[];
  onReorder: () => void;
  categories: Array<{ id: number; name: string }>; // Add categories prop
}

const LowStockTable = ({ products, onReorder, categories }: LowStockTableProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reorderingProduct, setReorderingProduct] = useState<number | null>(null);

  // Get category name helper
  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.name || "Uncategorized";
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

      onReorder();
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

  const lowStockProducts = products.filter(
    (product) => product.quantity <= product.min_stock_level
  );

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
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lowStockProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                All products are well stocked
              </TableCell>
            </TableRow>
          ) : (
            lowStockProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(product.category_id)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono">{product.quantity}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono">{product.min_stock_level}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={product.quantity === 0 ? "destructive" : "warning"}
                    className="capitalize"
                  >
                    {product.quantity === 0 ? "Out of Stock" : "Low Stock"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
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
    </Card>
  );
};

export default LowStockTable;