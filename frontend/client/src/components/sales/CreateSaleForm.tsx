// @ts-ignore
import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useToast} from '../../hooks/use-toast';
import {useAuth} from '../../lib/auth';
import {apiRequest} from '../../lib/queryClient';
import {z} from 'zod';
import {Product} from '../../types';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '../ui/form';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Card, CardContent, CardHeader, CardTitle, CardFooter} from '../ui/card';
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
import {Badge} from '../ui/badge';
import {
    Label
} from '../ui/label';
import {
    Separator
} from '../ui/separator';
import {
    X
} from 'lucide-react';
import { AxiosResponse } from 'axios';
import ReceiptDialog from './ReceiptDialog';

type SaleItem = {
    productId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productName: string;
};

interface CreateSaleFormProps {
    products: Product[];
    onClose?: () => void;
}

const saleItemSchema = z.object({
    productId: z.number().min(1, 'Please select a product'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
});

const saleFormSchema = z.object({
    customerName: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']).default('CASH'),
});

type SaleItemFormValues = z.infer<typeof saleItemSchema>;
type SaleFormValues = z.infer<typeof saleFormSchema>;

export default function CreateSaleForm({ products, onClose }: CreateSaleFormProps) {
    const {toast} = useToast();
    const queryClient = useQueryClient();
    const {user} = useAuth();
    const [customerName, setCustomerName] = useState('');
    const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA' | 'BANK'>('CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);
    const [currentSale, setCurrentSale] = useState<any>(null);
    const [saleResponse, setSaleResponse] = useState<any>(null);
    const STORE_NAME = "Mahatma Clothing";

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
        const validPercent = Math.min(percent, 100);
        const discountValue = (validPercent / 100) * subtotal;
        setDiscountAmount(discountValue);
        setDiscountPercent(validPercent);
    };

    const handleAddItem = (product: Product) => {
        if (!product) return;
        
        const existingItem = selectedItems.find(item => item.productId === product.id);
        if (existingItem) {
            setSelectedItems(selectedItems.map(item =>
                item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setSelectedItems([...selectedItems, { productId: product.id, quantity: 1, unitPrice: product.sell_price, totalPrice: product.sell_price, productName: product.name }]);
        }
    };

    const handleRemoveItem = (productId: number) => {
        setSelectedItems(selectedItems.filter(item => item.productId !== productId));
    };

    const handleQuantityChange = (productId: number, quantity: number) => {
        if (quantity < 1) return;
        
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
                discount_percentage: discountPercent,
                customer_name: customerName.trim() || null,
                payment_method: paymentMethod,
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

                // Show the receipt dialog with the new sale ID
                setSaleResponse(response.data);
                setCurrentSale(response.data.id);
                setShowReceiptDialog(true);

                // Reset form
                setCustomerName('');
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
                            description: `Sale #${response.data.id} created`,
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
            }
        } catch (error: any) {
            console.error('Error creating sale:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create sale. Please try again.',
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
                    <div>
                        <Label>Customer Name (Optional)</Label>
                        <Input
                            placeholder="Enter customer name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label>Payment Method</Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={(value: 'CASH' | 'MPESA' | 'BANK') => setPaymentMethod(value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASH">Cash</SelectItem>
                                <SelectItem value="MPESA">M-PESA</SelectItem>
                                <SelectItem value="BANK">Bank Transfer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Product</Label>
                        <Select onValueChange={(value) => {
                            const product = products.find(p => p.id === parseInt(value));
                            if (product) {
                                handleAddItem(product);
                            }
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id.toString()}>
                                        {product.name} - KSh {product.sell_price.toFixed(2)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                    saleId={currentSale}
                    isOpen={showReceiptDialog}
                    onClose={() => setShowReceiptDialog(false)}
                    storeName={STORE_NAME}
                />
            )}
        </>
    );
}