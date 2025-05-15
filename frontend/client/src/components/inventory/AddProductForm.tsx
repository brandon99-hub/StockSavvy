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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import axios from 'axios';
import { Switch } from '../ui/switch';
import { AlertTriangle } from 'lucide-react';

// Extend the product schema with validation
const productFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters").optional(),
  description: z.string().optional(),
  categoryId: z.number().nullable(),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  minStockLevel: z.number().min(0, "Min stock level must be 0 or greater"),
  buyPrice: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val as number),
    z.number().min(0.01, "Buy price must be a number greater than 0")
  ),
  sellPrice: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val as number),
    z.number().min(0.01, "Sell price must be a number greater than 0")
  ),
});

type ProductFormValues = z.infer<typeof productFormSchema> & { force?: boolean };

interface AddProductFormProps {
  categories: Category[];
  editProduct: Product | null;
  onCancel: () => void;
}

const AddProductForm = ({ categories, editProduct, onCancel }: AddProductFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editProduct;
  const [nextSku, setNextSku] = useState<string>('');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [autoSku, setAutoSku] = useState(true);
  const [warningModal, setWarningModal] = useState<{ message: string, data: ProductFormValues } | null>(null);

  // Initialize form with default values or edit values
  const form = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: editProduct?.name || '',
      sku: editProduct?.sku || nextSku,
      description: editProduct?.description || '',
      categoryId: editProduct?.category_id || null,
      quantity: editProduct?.quantity || 0,
      minStockLevel: editProduct?.min_stock_level || 10,
      buyPrice: editProduct ? Number(editProduct.buy_price) : 0.01,
      sellPrice: editProduct ? Number(editProduct.sell_price) : 0.01,
    },
  });

  useEffect(() => {
    if (!editProduct && autoSku) {
      axios.get('/api/products/next_sku/').then(res => {
        setNextSku(res.data.next_sku);
        form.setValue('sku', res.data.next_sku);
      });
    }
    if (editProduct) {
      form.setValue('sku', editProduct.sku);
    }
  }, [editProduct, form, autoSku]);

  // Reset form when editProduct changes
  useEffect(() => {
    if (editProduct) {
      form.reset({
        name: editProduct.name,
        sku: editProduct.sku,
        description: editProduct.description || '',
        categoryId: editProduct.category_id,
        quantity: editProduct.quantity,
        minStockLevel: editProduct.min_stock_level,
        buyPrice: parseFloat(String(editProduct.buy_price)),
        sellPrice: parseFloat(String(editProduct.sell_price)),
      });
    } else {
      form.reset({
        name: '',
        sku: nextSku,
        description: '',
        categoryId: null,
        quantity: 0,
        minStockLevel: 10,
        buyPrice: 0.01,
        sellPrice: 0.01,
      });
    }
  }, [editProduct, form, nextSku]);

  // Create or update product mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        name: data.name,
        sku: data.sku,
        description: data.description,
        category_id: data.categoryId,
        quantity: data.quantity,
        min_stock_level: data.minStockLevel,
        buy_price: typeof data.buyPrice === 'number' ? data.buyPrice.toString() : data.buyPrice,
        sell_price: typeof data.sellPrice === 'number' ? data.sellPrice.toString() : data.sellPrice,
      };
      // Add force flag if present
      if (data.force) payload.force = true;
      if (isEditing && editProduct) {
        return await apiRequest(`/api/products/${editProduct.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } else {
        return await apiRequest('/api/products/', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    },
    onSuccess: () => {
      // Invalidate and refetch product queries
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/category-chart'] });
      
      toast({
        title: isEditing ? 'Product updated' : 'Product created',
        description: isEditing ? 'Product has been updated successfully.' : 'New product has been added successfully.',
      });
      
      // Reset form and close
      form.reset();
      onCancel();
    },
    onError: (error: any, variables: any) => {
      // Debug log the error object
      console.error('Product form error:', error);
      let detail = 'An unknown error occurred';
      let warning = null;
      // Try to extract outlier warning from various possible error formats
      if (error && typeof error === 'object') {
        // DRF ValidationError: { sell_price: [ ... ] }
        if (error.response && error.response.data) {
          const data = error.response.data;
          if (data.sell_price && Array.isArray(data.sell_price)) {
            // If it's an array of ErrorDetail or strings
            const msg = data.sell_price.find((m: any) => typeof m === 'string' || (m && m.string));
            if (msg) warning = typeof msg === 'string' ? msg : msg.string;
          } else if (typeof data.detail === 'string') {
            detail = data.detail;
          }
        } else if ('message' in error) {
          detail = error.message;
        }
      }
      if (warning) {
        setWarningModal({ message: warning, data: variables });
      } else {
        setErrorModal(detail);
        toast({
          title: 'Error',
          description: detail,
          variant: 'destructive',
        });
      }
    },
  });

  // Form submission handler
  const onSubmit = (data: ProductFormValues) => {
    // Ensure form data types are correct
    const formData = {
      ...data,
      categoryId: data.categoryId === 0 ? null : data.categoryId,
      quantity: Number(data.quantity),
      minStockLevel: Number(data.minStockLevel),
      buyPrice: Number(data.buyPrice),
      sellPrice: Number(data.sellPrice)
    };
    
    // Log the data being sent
    console.log('Submitting product data:', formData);
    
    // Validate prices before submission
    if (formData.buyPrice <= 0) {
      toast({
        title: 'Error',
        description: 'Buy price must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    if (formData.sellPrice <= 0) {
      toast({
        title: 'Error',
        description: 'Sell price must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    mutation.mutate(formData);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit as SubmitHandler<ProductFormValues>)} className="space-y-4">
            <div className="flex items-center mb-2">
              <Switch checked={autoSku} onCheckedChange={setAutoSku} id="auto-sku-switch" />
              <label htmlFor="auto-sku-switch" className="ml-2 text-sm text-gray-700">Auto-generate SKU</label>
            </div>
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
                      <Input placeholder="Stock keeping unit" {...field} readOnly={autoSku} />
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
                      if (value === '0') {
                        field.onChange(null);
                      } else {
                        field.onChange(parseInt(value));
                      }
                    }}
                    value={field.value === null ? '0' : field.value?.toString() || '0'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper" className="max-h-[300px]">
                      <SelectItem value="0">Uncategorized</SelectItem>
                      {categories.map((category) => (
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
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : 0;
                          field.onChange(value);
                        }}
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
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : 0;
                          field.onChange(value);
                        }}
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
                        value={field.value as string | number}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0.01;
                          field.onChange(value);
                        }}
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
                        value={field.value as string | number}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : 0.01;
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      {/* Error Modal */}
      <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
        <DialogContent>
          <DialogTitle>Error</DialogTitle>
          <DialogDescription>{errorModal}</DialogDescription>
          <button onClick={() => setErrorModal(null)}>Close</button>
        </DialogContent>
      </Dialog>
      {/* Warning Modal for outlier price */}
      <Dialog open={!!warningModal} onOpenChange={() => setWarningModal(null)}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="w-10 h-10 text-orange-500 mb-2" aria-hidden="true" />
            <DialogTitle className="text-red-700 font-bold text-lg mb-1">Product Not Added: Unusual Selling Price</DialogTitle>
            <DialogDescription className="mb-2 text-gray-700">
              The selling price you entered (<b>KSh {warningModal?.data.sellPrice}</b>) is much higher or lower than what is typical for similar products in this category.<br />
              <span className="block mt-2 font-semibold">Typical price range: {(() => {
                // Try to extract the range from the warning message
                const match = warningModal?.message.match(/Typical range: ([\d.]+) - ([\d.]+)/);
                if (match) {
                  return `KSh ${parseFloat(match[1]).toLocaleString()} – KSh ${parseFloat(match[2]).toLocaleString()}`;
                }
                return 'Unavailable';
              })()}</span>
              <br />
              Please double-check the price. If you are sure, you can add the product anyway.
            </DialogDescription>
            <div className="flex gap-2 w-full justify-center">
              <Button
                variant="destructive"
                className="w-32"
                onClick={() => {
                  // Resubmit with force flag
                  if (warningModal) {
                    mutation.mutate({ ...warningModal.data, force: true } as any);
                    setWarningModal(null);
                  }
                }}
              >
                Add Anyway
              </Button>
              <Button variant="outline" className="w-32" onClick={() => setWarningModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AddProductForm;
