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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { useToast } from '../hooks/use-toast';
import { ShoppingCart, Scan, User, CreditCard, DollarSign, Trash2, Plus, Minus, X, Receipt, RefreshCw, Search, ChevronRight } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useIsMobile } from '../hooks/use-mobile';

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
    const isMobile = useIsMobile();
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(''); // Payment method state
    const [searchQuery, setSearchQuery] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Pagination States (Sales Mode only)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 24; // 24 products per page (4x6 grid)

    // Intake Mode States
    const [isStockIntakeMode, setIsStockIntakeMode] = useState(false);
    const [isIntakeDialogOpen, setIsIntakeDialogOpen] = useState(false);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [selectedUom, setSelectedUom] = useState<string>('base');
    const [intakeQuantity, setIntakeQuantity] = useState('1');
    const [customMultiplier, setCustomMultiplier] = useState('1');
    const [isSyncing, setIsSyncing] = useState(false);
    const [recentIntakes, setRecentIntakes] = useState<Array<{
        productName: string;
        quantity: number;
        uom: string;
        timestamp: Date;
    }>>([]);

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

    // Fetch products with pagination (Sales Mode only)
    const { data: productsData, isLoading: isProductsLoading } = useQuery<any>({
        queryKey: ['/api/products/', searchQuery, currentPage, pageSize],
        queryFn: () => apiRequest(
            `/api/products/?page=${currentPage}&page_size=${pageSize}${searchQuery ? `&search=${searchQuery}` : ''}`
        ),
    });

    // Extract products array and pagination info
    const products = Array.isArray(productsData) ? productsData : (productsData?.results || []);
    const totalProducts = productsData?.count || 0;
    const totalPages = Math.ceil(totalProducts / pageSize);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

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
            setSelectedPaymentMethod(''); // Reset payment method
            setIsCartOpen(false);
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

    // Reset search when switching modes
    useEffect(() => {
        setSearchQuery('');
        setBarcodeInput('');
        setCurrentPage(1);
    }, [isStockIntakeMode]);
    const handleBarcodeScan = async (barcode: string) => {
        if (!barcode.trim()) return;

        try {
            // Always search server-side by barcode/SKU to handle large inventories
            const searchResults = await apiRequest(`/api/products/?search=${encodeURIComponent(barcode)}`);
            const productsArray = Array.isArray(searchResults) ? searchResults : (searchResults?.results || []);

            // Find exact match by barcode or SKU
            let product = productsArray.find((p: Product) =>
                p.barcode === barcode || p.sku === barcode
            );

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
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to search product',
                variant: 'destructive',
            });
            setBarcodeInput('');
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

            // Add to recent intakes
            setRecentIntakes(prev => [{
                productName: data.product_name,
                quantity: data.added_quantity,
                uom: selectedUom === 'base' ? 'BASE' : selectedUom,
                timestamp: new Date()
            }, ...prev].slice(0, 10)); // Keep only last 10

            toast({
                title: 'Stock Updated',
                description: `Added ${data.added_quantity} units of ${data.product_name}`,
            });
            setIsIntakeDialogOpen(false);
            setScannedProduct(null);
            setIntakeQuantity('1');
            setSelectedUom('base');
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
        if (selectedUom === 'carton') {
            multiplier = parseInt(customMultiplier) || 1;
        } else if (selectedUom !== 'base' && scannedProduct.uom_data) {
            const uom = scannedProduct.uom_data.find(u => u.code.toLowerCase() === selectedUom.toLowerCase());
            if (uom) multiplier = uom.packSize;
        }

        addStockMutation.mutate({
            shop_id: user.shop,
            product_id: scannedProduct.id,
            quantity: parseInt(intakeQuantity) || 0,
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

    // Handle direct payment (no modal)
    const handleDirectPayment = () => {
        if (!selectedPaymentMethod || cart.length === 0) return;

        const paymentMethodObj = paymentMethods.find(pm => pm.code.toLowerCase() === selectedPaymentMethod.toLowerCase());

        const saleData = {
            shop: user?.shop,
            customer: selectedCustomer?.id,
            sale_date: new Date().toISOString(),
            total_amount: total,
            original_amount: total,
            discount: 0,
            discount_percentage: 0,
            user_id: user?.id,
            payment_status: selectedPaymentMethod === 'credit' ? 'credit' : 'paid',
            amount_paid: selectedPaymentMethod === 'credit' ? 0 : total,
            amount_credit: selectedPaymentMethod === 'credit' ? total : 0,
            items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
            })),
            payments: selectedPaymentMethod !== 'credit' ? [{
                payment_method_id: paymentMethodObj?.id,
                amount: total,
                reference_number: '',
            }] : [],
            repayment_amount: 0,
        };
        createSaleMutation.mutate(saleData);
    };

    // Check if customer can use credit
    const canUseCredit = () => {
        if (!selectedCustomer) return false;
        const availableCredit = selectedCustomer.credit_limit - selectedCustomer.current_balance;
        return availableCredit >= total && selectedCustomer.status === 'active';
    };

    const CartContentComponent = () => (
        <div className="flex flex-col h-full">
            {/* Header Section - Fixed height */}
            <div className="flex-shrink-0 p-4 border-b bg-slate-50/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
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

                {/* Customer Selection */}
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

                {/* Customer Credit Info */}
                {selectedCustomer && (
                    <div className="mt-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Balance:</span>
                            <span className={`font-semibold ${selectedCustomer.current_balance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                KES {selectedCustomer.current_balance.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-slate-500">Limit:</span>
                            <span className="font-semibold text-slate-900">KES {selectedCustomer.credit_limit.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Cart Items Section - Flexible height with scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30 min-h-0">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <ShoppingCart className="w-12 h-12 mb-2 stroke-[1.5px]" />
                        <p className="text-sm">Scan items to fill cart</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.product.id} className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-semibold text-slate-900 truncate pr-2 text-sm">{item.product.name}</span>
                                <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
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
                                <span className="font-bold text-indigo-900 text-sm">KES {item.total_price.toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer Section - Fixed height */}
            <div className="flex-shrink-0 p-4 bg-slate-900 text-white md:rounded-t-3xl shadow-2xl">
                {/* Payment Method Accordion - Compact */}
                <div className="mb-3">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="payment" className="border-slate-700">
                            <AccordionTrigger className="text-slate-400 text-xs uppercase tracking-wider hover:text-white py-2">
                                Payment {selectedPaymentMethod && `- ${paymentMethods.find(pm => pm.code.toLowerCase() === selectedPaymentMethod)?.name || 'Credit'}`}
                            </AccordionTrigger>
                            <AccordionContent className="pb-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.filter(pm => pm.code !== 'CREDIT').map(method => (
                                        <Button
                                            key={method.id}
                                            variant={selectedPaymentMethod === method.code.toLowerCase() ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col gap-1 rounded-xl transition-all text-xs ${selectedPaymentMethod === method.code.toLowerCase()
                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                                }`}
                                            onClick={() => setSelectedPaymentMethod(method.code.toLowerCase())}
                                        >
                                            {method.code.toLowerCase() === 'cash' ?
                                                <DollarSign className="w-4 h-4" /> :
                                                <CreditCard className="w-4 h-4" />
                                            }
                                            <span className="font-bold">{method.name}</span>
                                        </Button>
                                    ))}
                                    {selectedCustomer && canUseCredit() && (
                                        <Button
                                            variant={selectedPaymentMethod === 'credit' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col gap-1 rounded-xl transition-all col-span-2 text-xs ${selectedPaymentMethod === 'credit'
                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                                }`}
                                            onClick={() => setSelectedPaymentMethod('credit')}
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            <span className="font-bold">Credit Sale</span>
                                        </Button>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                {/* Total and Payment Button */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-t border-slate-700">
                        <span className="text-slate-400 font-medium tracking-wide uppercase text-xs">Total</span>
                        <span className="text-2xl font-black">KES {total.toLocaleString()}</span>
                    </div>
                    <Button
                        className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
                        disabled={cart.length === 0 || !selectedPaymentMethod || createSaleMutation.isPending}
                        onClick={handleDirectPayment}
                    >
                        <Receipt className="w-5 h-5 mr-2" />
                        {createSaleMutation.isPending ? 'PROCESSING...' : 'PAYMENT'}
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50/50">
            {/* Premium Responsive Header */}
            <div className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 shadow-sm gap-3">
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                        <Button
                            variant={isStockIntakeMode ? 'ghost' : 'default'}
                            size="sm"
                            className="rounded-md h-8 md:h-9 px-2 md:px-4"
                            onClick={() => {
                                setIsStockIntakeMode(false);
                                setTimeout(() => barcodeInputRef.current?.focus(), 100);
                            }}
                        >
                            <ShoppingCart className="w-3.5 h-3.5 md:mr-2" />
                            <span className="hidden md:inline">Sales</span>
                        </Button>
                        <Button
                            variant={isStockIntakeMode ? 'default' : 'ghost'}
                            size="sm"
                            className="rounded-md h-8 md:h-9 px-2 md:px-4"
                            onClick={() => {
                                setIsStockIntakeMode(true);
                                setTimeout(() => barcodeInputRef.current?.focus(), 100);
                            }}
                        >
                            <Scan className="w-3.5 h-3.5 md:mr-2" />
                            <span className="hidden md:inline">Stock Intake</span>
                        </Button>
                    </div>
                    <Badge variant="outline" className="md:hidden h-8 px-2 text-[10px] bg-white border-slate-200 font-medium">
                        {user?.shop_name || 'Main Shop'}
                    </Badge>
                </div>

                <div className="w-full md:flex-1 md:max-w-xl mx-0 md:mx-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Scan className={`h-4 w-4 md:h-5 md:w-5 ${isStockIntakeMode ? 'text-blue-500' : 'text-gray-400'}`} />
                        </div>
                        <Input
                            ref={barcodeInputRef}
                            type="text"
                            placeholder={isStockIntakeMode ? "Scan barcode or search products..." : "Scan barcode or search products..."}
                            className={`pl-9 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus-visible:ring-offset-0 transition-all ${isStockIntakeMode ? 'border-blue-200 focus:border-blue-500 bg-blue-50/30' : 'border-slate-200 focus:border-indigo-500'}`}
                            value={barcodeInput}
                            onChange={(e) => {
                                setBarcodeInput(e.target.value);
                                // Update search query for live search in both modes
                                setSearchQuery(e.target.value);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleBarcodeScan(barcodeInput);
                                }
                            }}
                        />
                        {isSyncing && (
                            <div className="absolute inset-y-0 right-3 flex items-center">
                                <RefreshCw className="h-4 w-4 md:h-5 md:w-5 animate-spin text-blue-500" />
                            </div>
                        )}
                        {barcodeInput && (
                            <button
                                onClick={() => {
                                    setBarcodeInput('');
                                    setSearchQuery('');
                                }}
                                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-3">
                    <Badge variant="outline" className="h-9 px-4 text-sm bg-white border-slate-200 font-medium">
                        {user?.shop_name || 'Main Shop'}
                    </Badge>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Stock Intake or Products */}
                <div className="flex-[3] overflow-y-auto p-4 md:p-6 border-r bg-white/40">
                    {isStockIntakeMode ? (
                        /* Stock Intake Mode - Product Cards when searching, Recent Intakes otherwise */
                        <div className="space-y-6">
                            {searchQuery ? (
                                /* Show Product Cards when searching */
                                <>
                                    {isProductsLoading ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                            {[...Array(pageSize)].map((_, i) => (
                                                <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-lg"></div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                            {products.map((product: Product) => (
                                                <Card
                                                    key={product.id}
                                                    className="group hover:shadow-md transition-all cursor-pointer border-blue-200/60 overflow-hidden active:bg-blue-50"
                                                    onClick={() => {
                                                        setScannedProduct(product);
                                                        setIsIntakeDialogOpen(true);
                                                    }}
                                                >
                                                    <CardContent className="p-3 md:p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex-1 pr-2">
                                                                <h3 className="font-semibold group-hover:text-blue-600 transition-colors uppercase text-xs md:text-sm tracking-tight line-clamp-2">{product.name}</h3>
                                                                {product.barcode && (
                                                                    <p className="text-[9px] md:text-[10px] text-slate-500 mt-1 font-mono">{product.barcode}</p>
                                                                )}
                                                            </div>
                                                            <Badge variant="secondary" className="bg-slate-100 text-[8px] md:text-[10px] uppercase font-bold tracking-widest shrink-0">{product.sku}</Badge>
                                                        </div>
                                                        <div className="flex justify-between items-end mt-3 md:mt-4">
                                                            <div>
                                                                <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Stock</p>
                                                                <Badge variant={product.stock <= 5 ? "destructive" : "outline"} className="font-bold h-5 px-1.5 md:h-6 md:px-2 text-[10px] md:text-xs">
                                                                    {product.stock}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Show Recent Intakes when not searching */
                                <>
                                    <div className="text-center py-8">
                                        <Scan className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Stock Intake Mode</h2>
                                        <p className="text-slate-500">Scan barcodes to add stock to inventory</p>
                                    </div>

                                    {recentIntakes.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Recent Intakes</h3>
                                            <div className="space-y-2">
                                                {recentIntakes.map((intake, index) => (
                                                    <div key={index} className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                    <h4 className="font-semibold text-slate-900">{intake.productName}</h4>
                                                                </div>
                                                                <p className="text-sm text-slate-600">
                                                                    <span className="font-bold text-green-600">{intake.quantity}</span> units ({intake.uom})
                                                                </p>
                                                            </div>
                                                            <span className="text-xs text-slate-400">
                                                                {new Date(intake.timestamp).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        /* Sales Mode - Product Grid with Pagination */
                        <>
                            {isProductsLoading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {[...Array(pageSize)].map((_, i) => (
                                        <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-lg"></div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                        {products.map((product: Product) => (
                                            <Card
                                                key={product.id}
                                                className="group hover:shadow-md transition-all cursor-pointer border-slate-200/60 overflow-hidden active:bg-slate-50"
                                                onClick={() => addToCart(product)}
                                            >
                                                <CardContent className="p-3 md:p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1 pr-2">
                                                            <h3 className="font-semibold group-hover:text-indigo-600 transition-colors uppercase text-xs md:text-sm tracking-tight line-clamp-2">{product.name}</h3>
                                                            {product.barcode && (
                                                                <p className="text-[9px] md:text-[10px] text-slate-500 mt-1 font-mono">{product.barcode}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant="secondary" className="bg-slate-100 text-[8px] md:text-[10px] uppercase font-bold tracking-widest shrink-0">{product.sku}</Badge>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-3 md:mt-4">
                                                        <div>
                                                            <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Price</p>
                                                            <p className="text-base md:text-lg font-bold text-slate-900">KES {Number(product.sell_price).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Stock</p>
                                                            <Badge variant={product.stock <= 5 ? "destructive" : "outline"} className="font-bold h-5 px-1.5 md:h-6 md:px-2 text-[10px] md:text-xs">
                                                                {product.stock}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                                            <div className="text-sm text-slate-600">
                                                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalProducts)} of {totalProducts} products
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }
                                                        return (
                                                            <Button
                                                                key={i}
                                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                                size="sm"
                                                                className="w-8 h-8 p-0"
                                                                onClick={() => setCurrentPage(pageNum)}
                                                            >
                                                                {pageNum}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Desktop Cart (Hidden on mobile and in Stock Intake mode) */}
                {!isStockIntakeMode && (
                    <div className="hidden lg:flex flex-1 flex flex-col bg-white border-l shadow-xl z-20">
                        <CartContentComponent />
                    </div>
                )}
            </div>

            {/* Mobile Cart FAB/Bottom Bar (Hidden in Stock Intake mode) */}
            {!isStockIntakeMode && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.1)] z-40">
                    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                        <SheetTrigger asChild>
                            <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg active:scale-95 transition-all">
                                <div className="flex items-center justify-between w-full px-2">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/20 p-2 rounded-lg">
                                            <ShoppingCart className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 leading-none mb-1">View Cart</p>
                                            <p className="text-sm font-black">{cart.length} ITEMS</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right pr-2 border-r border-white/20 mr-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 leading-none mb-1">Total</p>
                                            <p className="text-lg font-black">KES {total.toLocaleString()}</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 opacity-60" />
                                    </div>
                                </div>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-[2.5rem] border-none overflow-hidden">
                            <CartContentComponent />
                        </SheetContent>
                    </Sheet>
                </div>
            )}

            {/* Intake Mode Dialog/Sheet - Sheet on mobile, Dialog on desktop */}
            {isMobile ? (
                <Sheet open={isIntakeDialogOpen} onOpenChange={setIsIntakeDialogOpen}>
                    <SheetContent side="bottom" className="h-[60vh] rounded-t-[2rem] p-6">
                        <SheetHeader>
                            <SheetTitle className="text-lg">Stock In: {scannedProduct?.name}</SheetTitle>
                        </SheetHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Unit of Measure</Label>
                                <Select value={selectedUom} onValueChange={setSelectedUom}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="base">PIECE(S)</SelectItem>
                                        <SelectItem value="carton">CARTON</SelectItem>
                                        {scannedProduct?.uom_data?.filter(uom => uom.code.toLowerCase() !== 'base' && uom.code.toLowerCase() !== 'pcs').map(uom => (
                                            <SelectItem key={uom.code} value={uom.code.toLowerCase()}>
                                                {uom.code.toUpperCase()} ({uom.packSize} units)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedUom === 'carton' && (
                                <div className="space-y-2">
                                    <Label>Pieces per Carton</Label>
                                    <Input
                                        type="number"
                                        value={customMultiplier}
                                        onChange={(e) => setCustomMultiplier(e.target.value)}
                                        className="h-12 text-lg"
                                        min="1"
                                        placeholder={String(scannedProduct?.pieces_per_carton || scannedProduct?.carton_size || 1)}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Quantity ({selectedUom.toUpperCase()})</Label>
                                <Input
                                    type="number"
                                    value={intakeQuantity}
                                    onChange={(e) => setIntakeQuantity(e.target.value)}
                                    className="h-12 text-lg"
                                    min="1"
                                />
                            </div>

                            <Button
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 mt-6"
                                onClick={handleIntakeSubmit}
                                disabled={addStockMutation.isPending}
                            >
                                {addStockMutation.isPending ? 'PROCESSING...' : 'CONFIRM'}
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            ) : (
                <Dialog open={isIntakeDialogOpen} onOpenChange={setIsIntakeDialogOpen}>
                    <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Stock In: {scannedProduct?.name}</DialogTitle>
                            <DialogDescription>Select UOM and enter quantity.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4 border-y my-2">
                            <div className="space-y-2">
                                <Label>Unit of Measure</Label>
                                <Select value={selectedUom} onValueChange={setSelectedUom}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="base">PIECE(S)</SelectItem>
                                        <SelectItem value="carton">CARTON</SelectItem>
                                        {scannedProduct?.uom_data?.filter(uom => uom.code.toLowerCase() !== 'base' && uom.code.toLowerCase() !== 'pcs').map(uom => (
                                            <SelectItem key={uom.code} value={uom.code.toLowerCase()}>
                                                {uom.code.toUpperCase()} ({uom.packSize} units)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedUom === 'carton' && (
                                <div className="space-y-2">
                                    <Label>Pieces per Carton</Label>
                                    <Input
                                        type="number"
                                        value={customMultiplier}
                                        onChange={(e) => setCustomMultiplier(e.target.value)}
                                        className="h-12 text-lg"
                                        min="1"
                                        placeholder={String(scannedProduct?.pieces_per_carton || scannedProduct?.carton_size || 1)}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Quantity ({selectedUom.toUpperCase()})</Label>
                                <Input
                                    type="number"
                                    value={intakeQuantity}
                                    onChange={(e) => setIntakeQuantity(e.target.value)}
                                    className="h-12 text-lg"
                                    min="1"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                                onClick={handleIntakeSubmit}
                                disabled={addStockMutation.isPending}
                            >
                                {addStockMutation.isPending ? 'PROCESSING...' : 'CONFIRM'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

        </div>
    );
}
