// @ts-ignore
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

interface LowStockTableProps {
  products: Product[];
  onReorder: () => void;
}

const LowStockTable = ({ products, onReorder }: LowStockTableProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [reorderingProduct, setReorderingProduct] = useState<number | null>(null);

  const handleReorder = async (productId: number) => {
    try {
      setIsLoading(true);
      setReorderingProduct(productId);
      
      // To:
    await apiRequest(`/products/${productId}/restock/`, {
        method: "POST",
      });

      toast({
        title: "Success",
        description: "Product reorder initiated successfully",
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Current Stock</TableHead>
            <TableHead className="text-right">Min Stock</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lowStockProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                No products are low in stock
              </TableCell>
            </TableRow>
          ) : (
            lowStockProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.category?.name || "Uncategorized"}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={product.quantity === 0 ? "destructive" : "outline"}
                    className={
                      product.quantity === 0
                        ? ""
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {product.quantity}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {product.min_stock_level}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReorder(product.id)}
                    disabled={isLoading && reorderingProduct === product.id}
                  >
                    {isLoading && reorderingProduct === product.id
                      ? "Reordering..."
                      : "Reorder"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default LowStockTable;
