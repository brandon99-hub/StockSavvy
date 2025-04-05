import React, { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Product, Category } from '../../types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '../ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Define the product schema with validation
const productFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  description: z.string().optional(),
  categoryId: z.number().nullable(),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  minStockLevel: z.number().min(0, "Min stock level must be 0 or greater"),
  buyPrice: z.number().min(0.01, "Buy price must be greater than 0"),
  sellPrice: z.number().min(0.01, "Sell price must be greater than 0"),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface AddProductFormProps {
  categories: Category[];
  editProduct: Product | null;
  onSuccess: () => void;
}

const AddProductForm = ({ categories, editProduct, onSuccess }: AddProductFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const isEditing = !!editProduct;
  
  // Initialize form with defaults or edit values
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: editProduct?.name || '',
      sku: editProduct?.sku || '',
      description: editProduct?.description || '',
      categoryId: editProduct?.category?.id || null,
      quantity: editProduct?.quantity || 0,
      minStockLevel: editProduct?.min_stock_level || 10,
      buyPrice: editProduct ? parseFloat(editProduct.buy_price) : 0.01,
      sellPrice: editProduct ? parseFloat(editProduct.sell_price) : 0.01,
    },
  });

  // Reset form when editProduct changes
  useEffect(() => {
    if (editProduct) {
      form.reset({
        name: editProduct.name,
        sku: editProduct.sku,
        description: editProduct.description || '',
        categoryId: editProduct.category?.id || null,
        quantity: editProduct.quantity,
        minStockLevel: editProduct.min_stock_level,
        buyPrice: parseFloat(editProduct.buy_price),
        sellPrice: parseFloat(editProduct.sell_price),
      });
    }
  }, [editProduct, form]);

  // Submit handler
  const onSubmit = async (data: ProductFormValues) => {
    try {
      setIsLoading(true);
      
      // Format the data for API
      const productData = {
        name: data.name,
        sku: data.sku,
        description: data.description,
        category_id: data.categoryId,
        quantity: data.quantity,
        min_stock_level: data.minStockLevel,
        buy_price: data.buyPrice.toFixed(2),
        sell_price: data.sellPrice.toFixed(2),
      };
      
      if (isEditing && editProduct) {
        await apiRequest(`/api/products/${editProduct.id}/`, {
          method: "PATCH",
          body: JSON.stringify(productData),
        });
        toast({
          title: "Product updated",
          description: "Product has been updated successfully",
        });
      } else {
        await apiRequest("/api/products/", {
          method: "POST",
          body: JSON.stringify(productData),
        });
        toast({
          title: "Product created",
          description: "New product has been added successfully",
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/low-stock'] });
      
      // Call success callback
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} product`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Stock keeping unit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Product description" 
                      className="resize-none h-20" 
                      {...field} 
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === '0' ? null : parseInt(value));
                    }}
                    value={field.value === null ? '0' : field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Uncategorized</SelectItem>
                      {categories && categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value.toString()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Level</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value.toString()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buy Price (KSh)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0.01" 
                        step="0.01" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.01)}
                        value={field.value.toString()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sellPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price (KSh)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0.01" 
                        step="0.01" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.01)}
                        value={field.value.toString()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onSuccess}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AddProductForm;
