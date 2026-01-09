import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Customer, PaymentMethod, Product, Shop } from '../types';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Scan, User, CreditCard, DollarSign, Trash2, Plus, Minus, X, Receipt, RefreshCw, Search } from 'lucide-react';
import { Badge } from '../components/ui/badge';

interface CartItem {
    product: Product;
    quantity: number;
    unit_price: number;
    total_price: number;
}

export default function POSPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Intake Mode States
    const [isStockIntakeMode, setIsStockIntakeMode] = useState(false);
    const [isIntakeDialogOpen, setIsIntakeDialogOpen] = useState(false);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [selectedUom, setSelectedUom] = useState<string>('base');
    const [intakeQuantity, setIntakeQuantity] = useState('1');
    const [isSyncing, setIsSyncing] = useState(false);

    // Fetch payment methods
    const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
        queryKey: ['/api/payment-methods/'],
        queryFn: () => apiRequest('/api/payment-methods/'),
    });

    // Fetch customers for current shop
    const { data: customers = [] } = useQuery<Customer[]>({
        queryKey: ['/api/customers/'],
        queryFn: () => apiRequest('/api/customers/'),
    });

    // Fetch products
    const { data: products = [] } = useQuery<Product[]>({
        queryKey: ['/api/products/', searchQuery],
        queryFn: () => apiRequest(`/api/products/${searchQuery ? `?search=${searchQuery}` : ''}`),
    });

    // Create sale mutation
    const createSaleMutation = useMutation({
        mutationFn: (data: any) => apiRequest('/api/sales/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/sales/'] });
            queryClient.invalidateQueries({ queryKey: ['/api/customers/'] });
            setCart([]);
            setSelectedCustomer(null);
            setIsPaymentDialogOpen(false);
            toast({
                title: 'Success',
                description: 'Sale completed successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to complete sale',
                variant: 'destructive',
            });
        },
    });

    // Focus barcode input on mount
    useEffect(() => {
        barcodeInputRef.current?.focus();
    }, []);

    // Handle barcode scan
    const handleBarcodeScan = async (barcode: string) => {
        if (!barcode.trim()) return;

        // Find product locally first
        let product = products.find(p => p.barcode === barcode || p.sku === barcode);

        if (isStockIntakeMode) {
            if (!product) {
                setIsSyncing(true);
                try {
                    const syncedProduct = await apiRequest(`/api/shop-inventory/add_stock/`, {
                        method: 'POST',
                        body: JSON.stringify({ barcode, quantity: 0, sync_from_bc: true })
                    });
                    toast({ title: 'Product Synced', description: `${syncedProduct.product_name} synced from BC.` });
                    setBarcodeInput('');
                    queryClient.invalidateQueries({ queryKey: ['/api/products/'] });
                } catch (e: any) {
                    toast({ title: 'Not Found', description: e.message || 'Product not in local DB or BC', variant: 'destructive' });
                    setBarcodeInput('');
                } finally {
                    setIsSyncing(false);
                }
            } else {
                setScannedProduct(product);
                setIsIntakeDialogOpen(true);
                setBarcodeInput('');
            }
        } else {
            if (product) {
                addToCart(product);
                setBarcodeInput('');
                toast({
                    title: 'Product Added',
                    description: `${product.name} added to cart`,
                });
            } else {
                toast({
                    title: 'Product Not Found',
                    description: 'Invalid barcode or SKU',
                    variant: 'destructive',
                });
                setBarcodeInput('');
            }
        }
    };

    // Intake Submission Mutation
    const addStockMutation = useMutation({
        mutationFn: (data: any) => apiRequest('/api/shop-inventory/add_stock/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['/api/products/'] });
            toast({
                title: 'Stock Updated',
                description: `Added ${data.added_quantity} units of ${data.product_name}`,
            });
            setIsIntakeDialogOpen(false);
            setScannedProduct(null);
            setIntakeQuantity('1');
            barcodeInputRef.current?.focus();
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update stock',
                variant: 'destructive',
            });
        }
    });

    const handleIntakeSubmit = () => {
        if (!scannedProduct || !user?.shop) return;

        let multiplier = 1;
        if (selectedUom !== 'base' && scannedProduct.uom_data) {
            const uom = scannedProduct.uom_data.find(u => u.code === selectedUom);
            if (uom) multiplier = uom.packSize;
        }

        addStockMutation.mutate({
            shop_id: user.shop,
            product_id: scannedProduct.id,
            quantity: parseInt(intakeQuantity),
            multiplier: multiplier
        });
    };

    // Add product to cart
    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.product.id === product.id);

        if (existingItem) {
            updateQuantity(product.id, existingItem.quantity + 1);
        } else {
            const newItem: CartItem = {
                product,
                quantity: 1,
                unit_price: product.sell_price,
                total_price: product.sell_price,
            };
            setCart([...cart, newItem]);
        }
    };

    // Update quantity
    const updateQuantity = (productId: number, newQuantity: number) => {
        if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart(cart.map(item =>
            item.product.id === productId
                ? { ...item, quantity: newQuantity, total_price: item.unit_price * newQuantity }
                : item
        ));
    };

    // Remove from cart
    const removeFromCart = (productId: number) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const total = subtotal;

    // Handle payment
    const handlePayment = (paymentData: any) => {
        const saleData = {
            shop: user?.shop,
            customer: selectedCustomer?.id,
            sale_date: new Date().toISOString(),
            total_amount: total,
            original_amount: total,
            discount: 0,
            discount_percentage: 0,
            user_id: user?.id,
            payment_status: paymentData.payment_method === 'credit' ? 'credit' : 'paid',
            amount_paid: paymentData.payment_method === 'credit' ? 0 : total,
            amount_credit: paymentData.payment_method === 'credit' ? total : 0,
            items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
            })),
            payments: paymentData.payment_method !== 'credit' ? [{
                payment_method_id: paymentData.payment_method_id,
                amount: total,
                reference_number: paymentData.reference_number || '',
            }] : [],
            repayment_amount: paymentData.repayment_amount || 0,
        };
        createSaleMutation.mutate(saleData);
    };

    // Check if customer can use credit
    const canUseCredit = () => {
        if (!selectedCustomer) return false;
        const availableCredit = selectedCustomer.credit_limit - selectedCustomer.current_balance;
        return availableCredit >= total && selectedCustomer.status === 'active';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50/50">
            {/* Premium Header/Toolbar */}
            <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                        <Button
                            variant={isStockIntakeMode ? 'ghost' : 'default'}
                            size="sm"
                            className="rounded-md"
                            onClick={() => {
                                setIsStockIntakeMode(false);
                                setTimeout(() => barcodeInputRef.current?.focus(), 100);
                            }}
                        >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Sales
                        </Button>
                        <Button
                            variant={isStockIntakeMode ? 'default' : 'ghost'}
                            size="sm"
                            className="rounded-md"
                            onClick={() => {
                                setIsStockIntakeMode(true);
                                setTimeout(() => barcodeInputRef.current?.focus(), 100);
                            }}
                        >
                            <Scan className="w-4 h-4 mr-2" />
                            Stock Intake
                        </Button>
                    </div>
                </div>

                <div className="flex-1 max-w-xl mx-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Scan className={`h-5 w-5 ${isStockIntakeMode ? 'text-blue-500' : 'text-gray-400'}`} />
                        </div>
                        <Input
                            ref={barcodeInputRef}
                            type="text"
                            placeholder={isStockIntakeMode ? "SCAN BARCODE FOR STOCK INTAKE..." : "Quick scan or enter SKU..."}
                            className={`pl-10 h-12 text-lg border-2 focus-visible:ring-offset-0 transition-all ${isStockIntakeMode ? 'border-blue-200 focus:border-blue-500 bg-blue-50/30' : 'border-slate-200 focus:border-indigo-500'}`}
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleBarcodeScan(barcodeInput);
                                }
                            }}
                        />
                        {isSyncing && (
                            <div className="absolute inset-y-0 right-3 flex items-center">
                                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-9 px-4 text-sm bg-white border-slate-200 font-medium">
                        {user?.shop_name || 'Main Shop'}
                    </Badge>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Products with premium view */}
                <div className="flex-[2] overflow-y-auto p-6 border-r bg-white/40">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {products.map(product => (
                            <Card
                                key={product.id}
                                className="group hover:shadow-md transition-all cursor-pointer border-slate-200/60 overflow-hidden"
                                onClick={() => addToCart(product)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight">{product.name}</h3>
                                        <Badge variant="secondary" className="bg-slate-100 text-[10px] uppercase font-bold tracking-widest">{product.sku}</Badge>
                                    </div>
                                    <div className="flex justify-between items-end mt-4">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Price</p>
                                            <p className="text-lg font-bold text-slate-900">KES {Number(product.sell_price).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Stock</p>
                                            <Badge variant={product.stock <= 5 ? "destructive" : "outline"} className="font-bold">
                                                {product.stock} units
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Cart & Checkout */}
                <div className="flex-1 flex flex-col bg-white border-l shadow-xl z-20">
                    <div className="p-4 border-b bg-slate-50/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                                Cart
                                {cart.length > 0 && <Badge className="bg-indigo-600">{cart.length}</Badge>}
                            </h2>
                            {cart.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>

                        <Select
                            value={selectedCustomer?.id.toString() || 'none'}
                            onValueChange={(value) => {
                                if (value === 'none') {
                                    setSelectedCustomer(null);
                                } else {
                                    const customer = customers.find(c => c.id === Number(value));
                                    setSelectedCustomer(customer || null);
                                }
                            }}
                        >
                            <SelectTrigger className="w-full bg-white border-slate-200 h-10">
                                <SelectValue placeholder="Walk-in Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Walk-in Customer</SelectItem>
                                {customers.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedCustomer && (
                            <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-slate-500">Credit Balance:</span>
                                    <span className={`font-semibold ${selectedCustomer.current_balance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                        KES {selectedCustomer.current_balance.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Limit:</span>
                                    <span className="font-semibold text-slate-900">KES {selectedCustomer.credit_limit.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <ShoppingCart className="w-12 h-12 mb-2 stroke-[1.5px]" />
                                <p className="text-sm">Scan items to fill cart</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.product.id} className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-right-2 duration-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-semibold text-slate-900 truncate pr-2">{item.product.name}</span>
                                        <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                                <Minus className="w-3 h-3" />
                                            </Button>
                                            <span className="px-3 font-bold text-sm min-w-[30px] text-center">{item.quantity}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <span className="font-bold text-indigo-900">KES {item.total_price.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-6 bg-slate-900 text-white rounded-t-3xl shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-slate-400 font-medium tracking-wide uppercase text-xs">Total Amount</span>
                            <span className="text-3xl font-black">KES {total.toLocaleString()}</span>
                        </div>
                        <Button
                            className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
                            disabled={cart.length === 0}
                            onClick={() => setIsPaymentDialogOpen(true)}
                        >
                            <Receipt className="w-5 h-5 mr-3" />
                            PAYMENT
                        </Button>
                    </div>
                </div>
            </div>

            {/* Intake Mode Dialog */}
            <Dialog open={isIntakeDialogOpen} onOpenChange={setIsIntakeDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Stock In: {scannedProduct?.name}</DialogTitle>
                        <DialogDescription>Select UOM and enter quantity to add to stock.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4 border-y my-2">
                        <div className="space-y-2">
                            <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Unit of Measure</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant={selectedUom === 'base' ? 'default' : 'outline'}
                                    className="h-16 flex flex-col py-2"
                                    onClick={() => setSelectedUom('base')}
                                >
                                    <span className="font-bold">BASE</span>
                                    <span className="text-[10px] opacity-70">1 Unit</span>
                                </Button>
                                {scannedProduct?.uom_data?.map(uom => (
                                    <Button
                                        key={uom.code}
                                        variant={selectedUom === uom.code ? 'default' : 'outline'}
                                        className="h-16 flex flex-col py-2"
                                        onClick={() => setSelectedUom(uom.code)}
                                    >
                                        <span className="font-bold">{uom.code}</span>
                                        <span className="text-[10px] opacity-70">{uom.packSize} Units</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Quantity</Label>
                            <Input
                                type="number"
                                className="text-2xl h-14 font-bold text-center"
                                value={intakeQuantity}
                                onChange={(e) => setIntakeQuantity(e.target.value)}
                                min="1"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleIntakeSubmit()}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsIntakeDialogOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-500 px-8 h-12 rounded-xl font-bold"
                            onClick={handleIntakeSubmit}
                            disabled={addStockMutation.isPending}
                        >
                            {addStockMutation.isPending ? 'PRCESSING...' : 'CONFIRM INTAKE'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <PaymentDialog
                isOpen={isPaymentDialogOpen}
                onClose={() => setIsPaymentDialogOpen(false)}
                total={total}
                customer={selectedCustomer}
                canUseCredit={canUseCredit()}
                paymentMethods={paymentMethods}
                onPayment={handlePayment}
                isProcessing={createSaleMutation.isPending}
            />
        </div>
    );
}

// Payment Dialog Component
interface PaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    customer: Customer | null;
    canUseCredit: boolean;
    paymentMethods: PaymentMethod[];
    onPayment: (data: any) => void;
    isProcessing: boolean;
}

function PaymentDialog({ isOpen, onClose, total, customer, canUseCredit, paymentMethods, onPayment, isProcessing }: PaymentDialogProps) {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [repaymentAmount, setRepaymentAmount] = useState('');

    const handleSubmit = () => {
        if (!selectedMethod) return;

        const paymentMethodObj = paymentMethods.find(pm => pm.code.toLowerCase() === selectedMethod.toLowerCase());

        onPayment({
            payment_method: selectedMethod,
            payment_method_id: paymentMethodObj?.id,
            reference_number: referenceNumber,
            repayment_amount: parseFloat(repaymentAmount) || 0,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-3xl overflow-hidden p-0 border-0">
                <div className="bg-slate-900 p-8 text-white relative">
                    <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                        <p className="text-slate-400 text-xs uppercase font-black tracking-widest mb-2">Total Amount Due</p>
                        <h2 className="text-4xl font-black mb-1">KES {total.toLocaleString()}</h2>
                        {customer && (
                            <div className="inline-flex items-center bg-white/10 rounded-full px-4 py-1.5 mt-4 text-[11px] gap-2 border border-white/10">
                                <span className="text-white/60">Debt: </span>
                                <span className="font-bold">KES {customer.current_balance.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-8 space-y-6 bg-white">
                    <div className="space-y-3">
                        <Label className="uppercase text-[10px] font-black text-slate-500 tracking-widest">Payment Method</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {paymentMethods.filter(pm => pm.code !== 'CREDIT').map(method => (
                                <Button
                                    key={method.id}
                                    variant={selectedMethod === method.code.toLowerCase() ? 'default' : 'outline'}
                                    className={`h-24 flex flex-col gap-2 rounded-2xl transition-all border-2 ${selectedMethod === method.code.toLowerCase() ? 'border-transparent' : 'border-slate-100'}`}
                                    onClick={() => setSelectedMethod(method.code.toLowerCase())}
                                >
                                    {method.code.toLowerCase() === 'cash' ? <DollarSign className="w-6 h-6 mb-1" /> : <CreditCard className="w-6 h-6 mb-1" />}
                                    <span className="font-bold uppercase tracking-wider text-xs">{method.name}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button
                        variant={selectedMethod === 'credit' ? 'default' : 'outline'}
                        className={`w-full h-16 rounded-2xl text-lg font-bold border-2 transition-all group ${selectedMethod === 'credit' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-100 opacity-80'}`}
                        onClick={() => setSelectedMethod('credit')}
                        disabled={!customer}
                    >
                        <div className="flex flex-col items-center">
                            <span className="flex items-center">
                                <CreditCard className="mr-2 h-5 w-5" />
                                CREDIT SALE
                            </span>
                            {!customer && <span className="text-[9px] opacity-60 font-medium">Please select a customer first</span>}
                            {customer && !canUseCredit && <span className="text-[9px] text-red-500 font-medium font-black">LIMIT EXCEEDED (Max KES {customer.credit_limit.toLocaleString()})</span>}
                        </div>
                    </Button>

                    {selectedMethod && selectedMethod !== 'credit' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Reference</Label>
                                    <Input
                                        placeholder="M-Pesa / Card No..."
                                        value={referenceNumber}
                                        onChange={(e) => setReferenceNumber(e.target.value)}
                                        className="h-12 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-indigo-600 tracking-widest uppercase">Repayment</Label>
                                    <Input
                                        type="number"
                                        placeholder="Add to pay debt..."
                                        value={repaymentAmount}
                                        onChange={(e) => setRepaymentAmount(e.target.value)}
                                        className="h-12 border-indigo-200 focus:border-indigo-500 bg-indigo-50/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20"
                            disabled={!selectedMethod || isProcessing || (selectedMethod === 'credit' && !canUseCredit)}
                            onClick={handleSubmit}
                        >
                            {isProcessing ? 'PROCESSING...' : 'FINALIZE TRANSACTION'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
