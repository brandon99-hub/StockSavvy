import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/use-toast';
import { Product, RestockRule } from '../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Button, Table, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { AlertCircle, Edit, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

const API_BASE_URL = 'http://localhost:8000';

// Form schema for restock rules
const restockRuleSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  reorderQuantity: z.number().min(1, "Reorder quantity must be at least 1"),
  isAutoReorderEnabled: z.boolean(),
  supplierName: z.string().min(1, "Supplier name is required"),
  supplierEmail: z.string().email().optional(),
  supplierPhone: z.string().optional(),
});

type RestockRuleFormData = z.infer<typeof restockRuleSchema>;

interface RestockRulesManagerProps {
  products: Product[];
  lowStockProducts: Product[];
  onSuccess: () => void;
}

const RestockRulesManager: React.FC<RestockRulesManagerProps> = ({ products, lowStockProducts, onSuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RestockRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restockRules, setRestockRules] = useState<RestockRule[]>([]);
  const queryClient = useQueryClient();
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Helper to get CSRF token
  function getCsrfToken(): string | null {
    const name = 'csrftoken=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let i = 0; i < cookieArray.length; i++) {
      let cookie = cookieArray[i].trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return null;
  }

  // Fetch restock rules
  const fetchRestockRules = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await apiRequest('/api/restock-rules/');
    return response;
  };

  // Fetch rules on component mount
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      fetchRestockRules();
    }
  }, [user]);

  // Form setup
  const form = useForm<RestockRuleFormData>({
    resolver: zodResolver(restockRuleSchema),
    defaultValues: {
      productId: "",
      reorderQuantity: 1,
      isAutoReorderEnabled: false,
      supplierName: "",
      supplierEmail: "",
      supplierPhone: "",
    },
  });

  useEffect(() => {
    if (editingRule) {
      form.reset({
        productId: editingRule.product.id.toString(),
        reorderQuantity: editingRule.reorder_quantity,
        isAutoReorderEnabled: editingRule.is_auto_reorder_enabled,
        supplierName: editingRule.supplier_name,
        supplierEmail: editingRule.supplier_email || "",
        supplierPhone: editingRule.supplier_phone || "",
      });
    }
  }, [editingRule, form]);

  // Reset form with initial values or edited rule values
  const resetForm = (rule: RestockRule | null = null) => {
    if (rule) {
      form.reset({
        productId: rule.product.id.toString(),
        reorderQuantity: rule.reorder_quantity,
        isAutoReorderEnabled: rule.is_auto_reorder_enabled,
        supplierName: rule.supplier_name,
        supplierEmail: rule.supplier_email || "",
        supplierPhone: rule.supplier_phone || "",
      });
      setEditingRule(rule);
    } else {
      form.reset({
        productId: "",
        reorderQuantity: 1,
        isAutoReorderEnabled: false,
        supplierName: "",
        supplierEmail: "",
        supplierPhone: "",
      });
      setEditingRule(null);
    }
  };

  // Create restock rule function
  const createRestockRule = async (ruleData: Omit<RestockRule, 'id' | 'created_at' | 'updated_at'>) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await apiRequest('/api/restock-rules/', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    });
    return response;
  };

  // Update restock rule function
  const updateRestockRule = async (ruleData: RestockRule) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await apiRequest(`/api/restock-rules/${ruleData.id}/`, {
      method: 'PUT',
      body: JSON.stringify(ruleData),
    });
    return response;
  };

  // Delete restock rule function
  const deleteRestockRule = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    await apiRequest(`/api/restock-rules/${id}/`, {
      method: 'DELETE',
    });
  };

  // Form submission handler
  const onSubmit = (data: RestockRuleFormData) => {
    if (editingRule) {
      updateRestockRule({ ...editingRule, ...data });
    } else {
      createRestockRule(data);
    }
  };

  // Open dialog for creating or editing rule
  const openDialog = (rule: RestockRule | null = null) => {
    resetForm(rule);
    setOpen(true);
  };

  // Get product name by ID
  const getProductName = (productId: string): string => {
    const product = products.find(p => p.id.toString() === productId);
    return product ? product.name : 'Unknown Product';
  };

  // Get products for edit
  const getProductsForEdit = (): Product[] => {
    if (editingRule) {
      return [...products];
    }
    // For new rules, prioritize low stock products that don't already have rules
    const existingRuleProductIds = new Set(restockRules.map(r => r.product.id));
    return products.sort((a, b) => {
      const aIsLowStock = lowStockProducts.some(p => p.id === a.id) && !existingRuleProductIds.has(a.id);
      const bIsLowStock = lowStockProducts.some(p => p.id === b.id) && !existingRuleProductIds.has(b.id);
      if (aIsLowStock && !bIsLowStock) return -1;
      if (!aIsLowStock && bIsLowStock) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const { data: rules = [], isLoading: queryLoading, error: queryError } = useQuery<RestockRule[]>({
    queryKey: ['/api/restock-rules/'],
    queryFn: fetchRestockRules,
  });

  const createMutation = useMutation({
    mutationFn: createRestockRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/restock-rules/'] });
      message.success('Restock rule created successfully');
      setOpen(false);
      form.resetFields();
    },
    onError: (error: Error) => {
      const detail = error?.response?.data?.detail || error?.message || 'An unknown error occurred';
      setErrorModal(detail);
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateRestockRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/restock-rules/'] });
      message.success('Restock rule updated successfully');
      setOpen(false);
      form.resetFields();
    },
    onError: (error: Error) => {
      const detail = error?.response?.data?.detail || error?.message || 'An unknown error occurred';
      setErrorModal(detail);
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRestockRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/restock-rules/'] });
      message.success('Restock rule deleted successfully');
    },
    onError: (error: Error) => {
      const detail = error?.response?.data?.detail || error?.message || 'An unknown error occurred';
      setErrorModal(detail);
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    setEditingRule(null);
    openDialog();
  };

  const handleEdit = (rule: RestockRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    openDialog(rule);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Restricted</AlertTitle>
        <AlertDescription>
          You do not have permission to manage restock rules.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl flex justify-between items-center">
          <span>Restock Rules</span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} icon={<PlusOutlined />}>
                Add Restock Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit' : 'Add'} Restock Rule</DialogTitle>
                <DialogDescription>
                  Set up reordering parameters for products
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <FormControl>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2"
                            disabled={!!editingRule}
                            {...field}
                          >
                            <option value="">Select a product</option>
                            {getProductsForEdit().map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} {lowStockProducts.some(p => p.id === product.id) && !editingRule && "- Low Stock"}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>
                          Select a product to set up restock rules for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reorderQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reorder Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isAutoReorderEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Auto Reorder</FormLabel>
                            <FormDescription className="text-xs">
                              Enable automatic ordering
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="supplierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter supplier name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="supplierEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter supplier email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplierPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter supplier phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>
          Configure automatic reordering for products that are running low
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queryError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{queryError.message}</AlertDescription>
          </Alert>
        )}

        {queryLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No restock rules configured yet</p>
            <Button className="mt-4" onClick={handleCreate} icon={<PlusOutlined />}>
              Create Your First Rule
            </Button>
          </div>
        ) : (
          <Table
            dataSource={rules}
            loading={isLoading}
            rowKey="id"
            columns={[
              { title: 'Product', dataIndex: 'product.name' },
              { title: 'Reorder Quantity', dataIndex: 'reorder_quantity' },
              { title: 'Auto Reorder', dataIndex: 'is_auto_reorder_enabled', render: (_, record) => (
                <Badge variant={record.is_auto_reorder_enabled ? "default" : "outline"}>
                  {record.is_auto_reorder_enabled ? "Enabled" : "Manual"}
                </Badge>
              ) },
              { title: 'Supplier', dataIndex: 'supplier_name' },
              {
                title: 'Actions',
                render: (_, record) => (
                  <div className="flex space-x-2">
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    />
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(record.id)}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default RestockRulesManager;