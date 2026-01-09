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
import { AlertTriangle, FileText, Package, DollarSign, BarChart3, Save, Plus, RotateCw, Loader2 } from 'lucide-react';

// Extend the product schema with validation
const productFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters").optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.number().nullable(),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  minStockLevel: z.number().min(0, "Min stock level must be 0 or greater"),
  buyPrice: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val as number),
    z.number().min(0, "Buy price must be a number 0 or greater")
  ),
  sellPrice: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val as number),
    z.number().min(0, "Sell price must be a number 0 or greater")
  ),
  uomType: z.enum(['PCS', 'CARTON']).default('PCS'),
  piecesPerCarton: z.number().min(1, "Pieces per carton must be at least 1").default(1),
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
      barcode: editProduct?.barcode || '',
      description: editProduct?.description || '',
      categoryId: editProduct?.category_id || null,
      quantity: editProduct?.master_quantity || 0,
      minStockLevel: editProduct?.min_stock_level || 10,
      buyPrice: editProduct ? Number(editProduct.buy_price) : 0,
      sellPrice: editProduct ? Number(editProduct.sell_price) : 0,
      uomType: editProduct?.uom_type || 'PCS',
      piecesPerCarton: editProduct?.pieces_per_carton || 1,
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
        barcode: editProduct.barcode || '',
        description: editProduct.description || '',
        categoryId: editProduct.category_id,
        quantity: editProduct.master_quantity || 0,
        minStockLevel: editProduct.min_stock_level,
        buyPrice: parseFloat(String(editProduct.buy_price)),
        sellPrice: parseFloat(String(editProduct.sell_price)),
        uomType: editProduct.uom_type || 'PCS',
        piecesPerCarton: editProduct.pieces_per_carton || 1,
      });
    } else {
      form.reset({
        name: '',
        sku: nextSku,
        barcode: '',
        description: '',
        categoryId: null,
        quantity: 0,
        minStockLevel: 10,
        buyPrice: 0,
        sellPrice: 0,
        uomType: 'PCS',
        piecesPerCarton: 1,
      });
    }
  }, [editProduct, form, nextSku]);

  // Create or update product mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || null,
        description: data.description,
        category_id: data.categoryId,
        quantity: data.quantity,
        min_stock_level: data.minStockLevel,
        buy_price: typeof data.buyPrice === 'number' ? data.buyPrice.toString() : data.buyPrice,
        sell_price: typeof data.sellPrice === 'number' ? data.sellPrice.toString() : data.sellPrice,
        uom_type: data.uomType,
        pieces_per_carton: data.piecesPerCarton,
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
      queryClient.invalidateQueries({ queryKey: ['/api/products/'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
    if (!autoSku && data.sku) {
      const skuError = validateHybridSku(data.sku);
      if (skuError) {
        setErrorModal(skuError);
        return;
      }
    }
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
    if (formData.buyPrice < 0) {
      toast({
        title: 'Error',
        description: 'Buy price must be 0 or greater',
        variant: 'destructive',
      });
      return;
    }

    if (formData.sellPrice < 0) {
      toast({
        title: 'Error',
        description: 'Sell price must be 0 or greater',
        variant: 'destructive',
      });
      return;
    }

    mutation.mutate(formData);
  };

  function validateHybridSku(sku: string): string | null {
    if (/^[A-Za-z]{1,3}[0-9]+$/.test(sku)) {
      return null;
    }
    if (/^[0-9]+$/.test(sku)) {
      return null;
    }
    if (/^[A-Za-z]{1,}$/.test(sku)) {
      return "SKU must end with a number for auto-generation. You can disable auto-generation or change the SKU.";
    }
    if (/[0-9].*[A-Za-z]/.test(sku) || /^[A-Za-z]{4,}/.test(sku)) {
      return "SKU must have up to 3 letters at the start, followed by numbers only. No numbers allowed between letters.";
    }
    return "Invalid SKU format. Use up to 3 letters followed by numbers (e.g., ABC001) or only numbers (e.g., 002).";
  }

  return (
    <>
      {errorModal && (
        <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
          <DialogContent>
            <DialogTitle>SKU Format Error</DialogTitle>
            <DialogDescription>{errorModal}</DialogDescription>
            <Button onClick={() => setErrorModal(null)}>OK</Button>
          </DialogContent>
        </Dialog>
      )}
      <Card className="shadow-lg border-gray-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {isEditing ? <Save className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as SubmitHandler<ProductFormValues>)} className="space-y-6">

              {/* SKU Auto-generate Toggle */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Switch checked={autoSku} onCheckedChange={setAutoSku} id="auto-sku-switch" />
                <RotateCw className="h-4 w-4 text-blue-600" />
                <label htmlFor="auto-sku-switch" className="text-sm font-medium text-blue-900 cursor-pointer">
                  Auto-generate SKU
                </label>
              </div>

              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Product Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Coca Cola 500ml" className="border-gray-300" {...field} />
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
                        <FormLabel className="text-gray-700 font-medium">SKU *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Stock keeping unit"
                            className="border-gray-300"
                            {...field}
                            readOnly={autoSku}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Barcode</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Product barcode"
                            className="border-gray-300"
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
                        <FormLabel className="text-gray-700 font-medium">Category</FormLabel>
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
                            <SelectTrigger className="border-gray-300">
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
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Product description"
                          className="resize-none h-20 border-gray-300"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Packaging Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Packaging
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="uomType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Packaging Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PCS">Pieces (PCS)</SelectItem>
                            <SelectItem value="CARTON">Carton</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="piecesPerCarton"
                    render={({ field }) => (
                      <FormItem className={form.watch('uomType') !== 'CARTON' ? 'opacity-50 pointer-events-none' : ''}>
                        <FormLabel className="text-gray-700 font-medium">Pieces per Carton</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            className="border-gray-300"
                            disabled={form.watch('uomType') !== 'CARTON'}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Inventory Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Inventory
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Initial Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="border-gray-300"
                            placeholder="0"
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
                        <FormLabel className="text-gray-700 font-medium">Min Stock Level</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="border-gray-300"
                            placeholder="10"
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
              </div>

              {/* Pricing Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  Pricing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="buyPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Unit Cost (KSh)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="border-gray-300"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : 0;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {form.watch('uomType') === 'CARTON' ? 'Cost per carton' : 'Cost per piece'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sellPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Unit Price (KSh)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="border-gray-300"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : 0;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {form.watch('uomType') === 'CARTON' ? 'Price per carton' : 'Price per piece'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="px-6 bg-blue-600 hover:bg-blue-700"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                      {isEditing ? 'Update Product' : 'Create Product'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

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
    </>
  );
};

export default AddProductForm;
