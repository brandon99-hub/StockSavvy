// @ts-ignore
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../lib/auth';
import { apiRequest } from '../../lib/queryClient';
import { z } from 'zod';
import { Product, Customer } from '../../types';
import { DollarSign, User as UserIcon, X } from 'lucide-react';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '../ui/form';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import {
    Label
} from '../ui/label';
import {
    Separator
} from '../ui/separator';
import { AxiosResponse } from 'axios';
import ReceiptDialog from './ReceiptDialog';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

const STORE_NAME = "Working Wave";

type SaleItem = {
    productId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productName: string;
};

interface CreateSaleFormProps {
    products: Product[];
    customers: Customer[];
    onClose?: () => void;
}

const saleItemSchema = z.object({
    productId: z.number().min(1, 'Please select a product'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
});

const saleFormSchema = z.object({
    customerName: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'MPESA', 'BANK', 'CREDIT']).default('CASH'),
});

type SaleItemFormValues = z.infer<typeof saleItemSchema>;
type SaleFormValues = z.infer<typeof saleFormSchema>;

export default function CreateSaleForm({ products, customers, onClose }: CreateSaleFormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [repaymentAmount, setRepaymentAmount] = useState(0);
    const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA' | 'BANK' | 'CREDIT'>('CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);
    const [currentSale, setCurrentSale] = useState<any>(null);
    const [saleResponse, setSaleResponse] = useState<any>(null);
    const [open, setOpen] = useState(false);
    const [errorModal, setErrorModal] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');

    // Fetch products dynamically based on search query
    const { data: searchResults, isLoading: isSearching } = useQuery<any>({
        queryKey: ['/api/products/', productSearch],
        queryFn: () => apiRequest(`/api/products/${productSearch ? `?search=${productSearch}` : ''}`),
        enabled: open, // Only fetch when dropdown is open
    });

    // Extract products array from search results or use passed products as fallback
    const searchProductsArray = Array.isArray(searchResults) ? searchResults : (searchResults?.results || []);
    const productsArray = open && productSearch ? searchProductsArray : (Array.isArray(products) ? products : ((products as any)?.results || []));

    // Clear search when popover closes
    useEffect(() => {
        if (!open) {
            setProductSearch('');
        }
    }, [open]);

    const calculateSubtotal = () => {
        return selectedItems.reduce((total, item) =>
            total + (item.quantity * item.unitPrice), 0
        );
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        return Math.max(0, subtotal - discountAmount);
    };

    const handleDiscountChange = (value: number) => {
        const subtotal = calculateSubtotal();
        // Ensure discount doesn't exceed subtotal
        const validDiscount = Math.min(value, subtotal);
        setDiscountAmount(validDiscount);
        setDiscountPercent(subtotal > 0 ? (validDiscount / subtotal) * 100 : 0);
    };

    const handleDiscountPercentChange = (percent: number) => {
        const subtotal = calculateSubtotal();
        // Ensure percent is between 0 and 100, and format to have max 7 digits before decimal
        const validPercent = Math.min(Math.max(0, Number(percent.toFixed(2))), 100);
        const discountValue = (validPercent / 100) * subtotal;
        setDiscountAmount(discountValue);
        setDiscountPercent(validPercent);
    };

    const handleAddItem = (product: Product) => {
        if (!product) return;
        // Check if product is out of stock
        if ((product.stock ?? 0) <= 0) {
            toast({
                title: '❌ Out of Stock',
                description: `Sorry, ${product.name} is currently out of stock. Please check back later.`,
                variant: 'destructive',
            });
            return;
        }
        const existingItem = selectedItems.find(item => item.productId === product.id);
        const priceToUse = product.sell_price;
        if (existingItem) {
            // Check if adding one more would exceed available stock
            if (existingItem.quantity + 1 > (product.stock ?? 0)) {
                toast({
                    title: '⚠️ Limited Stock',
                    description: `Only ${product.stock} units of ${product.name} available.`,
                    variant: 'destructive',
                });
                return;
            }
            setSelectedItems(selectedItems.map(item =>
                item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setSelectedItems([...selectedItems, {
                productId: product.id,
                quantity: 1,
                unitPrice: priceToUse,
                totalPrice: priceToUse,
                productName: product.name
            }]);
        }
    };

    const handleRemoveItem = (productId: number) => {
        setSelectedItems(selectedItems.filter(item => item.productId !== productId));
    };

    const handleQuantityChange = (productId: number, quantity: number) => {
        if (quantity < 1) return;

        const product = productsArray.find((p: Product) => p.id === productId);
        if (!product) return;

        // Check if requested quantity exceeds available stock
        if (quantity > (product.stock ?? 0)) {
            toast({
                title: '⚠️ Limited Stock',
                description: `Only ${product.stock} units of ${product.name} available.`,
                variant: 'destructive',
            });
            return;
        }

        setSelectedItems(selectedItems.map(item =>
            item.productId === productId
                ? { ...item, quantity }
                : item
        ));
    };

    const handleCreateSale = async () => {
        if (!user) {
            toast({
                title: 'Error',
                description: 'You must be logged in to create a sale',
                variant: 'destructive'
            });
            return;
        }

        if (selectedItems.length === 0) {
            toast({
                title: 'Error',
                description: 'Please add at least one item to the sale',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const subtotal = calculateSubtotal();
            const finalAmount = calculateTotal();

            const saleData = {
                sale_date: new Date().toISOString(),
                total_amount: finalAmount,
                original_amount: subtotal,
                discount: discountAmount,
                discount_percentage: Number(discountPercent.toFixed(2)),
                customer: selectedCustomer?.id || null,
                repayment_amount: repaymentAmount,
                payment_status: paymentMethod === 'CREDIT' ? 'credit' : 'paid',
                amount_paid: paymentMethod === 'CREDIT' ? 0 : finalAmount,
                amount_credit: paymentMethod === 'CREDIT' ? finalAmount : 0,
                user_id: user?.id,
                sale_items: selectedItems.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: item.quantity * item.unitPrice
                }))
            };

            const response = await apiRequest('/api/sales/', {
                method: 'POST',
                body: JSON.stringify(saleData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response) {
                const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
                const itemSummary = selectedItems.map(item =>
                    `${item.quantity}x ${item.productName}`
                ).join(', ');

                // Show success toast
                toast({
                    title: '✅ Sale Created Successfully',
                    description: [
                        `Items: ${itemSummary}`,
                        `Subtotal: KSh ${subtotal.toFixed(2)}`,
                        `Discount: -KSh ${discountAmount.toFixed(2)} (${discountPercent.toFixed(1)}%)`,
                        `Final Amount: KSh ${finalAmount.toFixed(2)}`
                    ].join('\n'),
                    variant: 'default',
                });

                // Set the sale ID and show the receipt dialog
                const saleId = response.id;
                if (saleId) {
                    setCurrentSale(saleId);
                    setShowReceiptDialog(true);
                } else {
                    throw new Error('Invalid sale ID received from server');
                }

                // Reset form
                setSelectedCustomer(null);
                setRepaymentAmount(0);
                setSelectedItems([]);
                setDiscountAmount(0);
                setDiscountPercent(0);
                setPaymentMethod('CASH');

                // Log activity and invalidate queries after successful sale creation
                try {
                    await apiRequest('/api/activities/', {
                        method: 'POST',
                        body: JSON.stringify({
                            type: 'sale_created',
                            description: `Sale #${saleId} created`,
                            status: 'completed',
                            user_id: user?.id,
                            created_at: new Date().toISOString()
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['/api/sales'] }),
                        queryClient.invalidateQueries({ queryKey: ['/api/products'] }),
                        queryClient.invalidateQueries({ queryKey: ['/api/activities'] }),
                        queryClient.invalidateQueries({ queryKey: ['dashboard', 'activities'] })
                    ]);
                } catch (error) {
                    console.error('Error logging activity:', error);
                    // Don't show error toast for activity logging failure
                }
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error: any) {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to create sale. Please try again.';
            setErrorModal(detail);
            toast({
                title: 'Error',
                description: detail,
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Form */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <UserIcon className="h-4 w-4 text-slate-500" />
                                Customer Selection
                            </Label>
                            <Select
                                value={selectedCustomer?.id.toString() || "none"}
                                onValueChange={(value) => {
                                    if (value === "none") {
                                        setSelectedCustomer(null);
                                    } else {
                                        const customer = customers.find(c => c.id === Number(value));
                                        setSelectedCustomer(customer || null);
                                    }
                                }}
                            >
                                <SelectTrigger className="bg-slate-50/50 border-slate-200">
                                    <SelectValue placeholder="Walk-in Customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Walk-in Customer</SelectItem>
                                    {customers.map(customer => (
                                        <SelectItem key={customer.id} value={customer.id.toString()}>
                                            {customer.name} - {customer.phone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedCustomer && (
                                <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 flex justify-between items-center animate-in fade-in slide-in-from-top-1">
                                    <div className="text-xs space-y-0.5">
                                        <p className="text-blue-600 font-medium">Outstanding Debt</p>
                                        <p className="text-blue-900 font-bold text-sm">KES {selectedCustomer.current_balance.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right text-xs space-y-0.5">
                                        <p className="text-blue-600 font-medium">Available Credit</p>
                                        <p className="text-blue-900 font-bold text-sm">KES {(selectedCustomer.credit_limit - selectedCustomer.current_balance).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedCustomer && (
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3 animate-in fade-in zoom-in-95">
                                <Label className="text-primary flex items-center gap-2 text-sm font-semibold">
                                    <DollarSign className="h-4 w-4" />
                                    Record Debt Repayment
                                </Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Enter amount customer is paying now..."
                                        value={repaymentAmount || ""}
                                        onChange={(e) => setRepaymentAmount(parseFloat(e.target.value) || 0)}
                                        className="pl-9 bg-white border-primary/20 focus:border-primary focus:ring-primary/20"
                                    />
                                    <span className="absolute left-3 top-2.5 text-primary/40 font-medium text-sm">KSh</span>
                                </div>
                                <p className="text-[10px] text-slate-500 italic">
                                    This payment will be applied to the customer's outstanding balance, separate from this sale's payment.
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Payment Method</Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={(value: 'CASH' | 'MPESA' | 'BANK' | 'CREDIT') => {
                                if (value === 'CREDIT' && !selectedCustomer) {
                                    toast({
                                        title: 'Customer Required',
                                        description: 'Please select a customer before choosing Credit payment.',
                                        variant: 'destructive'
                                    });
                                    return;
                                }
                                setPaymentMethod(value);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASH">Cash</SelectItem>
                                <SelectItem value="MPESA">M-PESA</SelectItem>
                                <SelectItem value="BANK">Bank Transfer</SelectItem>
                                <SelectItem value="CREDIT">Credit Sale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Product</Label>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                >
                                    Select a product...
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder="Search products by name, SKU, or barcode..."
                                        value={productSearch}
                                        onValueChange={setProductSearch}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                            {isSearching ? 'Searching...' : 'No products found.'}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {productsArray.map((product: Product) => (
                                                <CommandItem
                                                    key={product.id}
                                                    value={`${product.name} ${product.description || ''}`}
                                                    onSelect={() => {
                                                        handleAddItem(product);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <div className="flex flex-col w-full">
                                                        <div className="flex justify-between">
                                                            <span className="font-medium">{product.name}</span>
                                                            <span className="text-muted-foreground">
                                                                KSh {product.sell_price.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {product.description && (
                                                            <span className="text-sm text-muted-foreground">
                                                                {product.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleCreateSale}
                        disabled={isSubmitting || selectedItems.length === 0}
                    >
                        {isSubmitting ? 'Creating Sale...' : 'Complete Sale'}
                    </Button>
                </div>

                {/* Right Column - Summary */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Sale Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedItems.map((item) => (
                                <div key={item.productId} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-sm text-gray-500">
                                            KSh {item.unitPrice.toFixed(2)} × {item.quantity}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value))}
                                            className="w-20"
                                            min="1"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => handleRemoveItem(item.productId)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <Separator />

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>KSh {calculateSubtotal().toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Discount:</span>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={discountAmount}
                                            onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                                            className="w-24"
                                            min="0"
                                            max={calculateSubtotal()}
                                        />
                                        <div className="flex items-center">
                                            <Input
                                                type="number"
                                                value={discountPercent}
                                                onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value) || 0)}
                                                className="w-16"
                                                min="0"
                                                max="100"
                                            />
                                            <span className="ml-1">%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Total:</span>
                                    <span>KSh {calculateTotal().toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {currentSale && showReceiptDialog && (
                <ReceiptDialog
                    isOpen={showReceiptDialog}
                    saleId={currentSale}
                    onClose={() => {
                        setShowReceiptDialog(false);
                        setCurrentSale(null);
                    }}
                    storeName={STORE_NAME}
                />
            )}
            <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
                <DialogContent>
                    <DialogTitle>Error</DialogTitle>
                    <DialogDescription>{errorModal}</DialogDescription>
                    <button onClick={() => setErrorModal(null)}>Close</button>
                </DialogContent>
            </Dialog>
        </>
    );
}