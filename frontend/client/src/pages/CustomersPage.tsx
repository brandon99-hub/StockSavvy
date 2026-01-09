import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Customer, Shop, CreditTransaction } from '../types';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { Plus, Edit, DollarSign, User as UserIcon, Phone, CreditCard, Ban, CheckCircle, Trash2, LayoutGrid, List, Search, Store, Shield, History as HistoryIcon } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AddCustomerForm } from '../components/customers/AddCustomerForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";

export default function CustomersPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const isAdmin = !!(user?.role === 'admin' || user?.can_access_all_shops);

    // Fetch shops (for admin)
    const { data: shops = [] } = useQuery<Shop[]>({
        queryKey: ['/api/shops/'],
        queryFn: () => apiRequest('/api/shops/'),
        enabled: isAdmin,
    });

    // Fetch customers (fetch all for local filtering)
    const { data: customers = [], isLoading } = useQuery<Customer[]>({
        queryKey: ['/api/customers/'],
        queryFn: () => apiRequest('/api/customers/'),
    });

    // Local filtering and pagination logic
    const filteredCustomers = customers.filter(customer => {
        const term = searchQuery.toLowerCase();
        return (
            customer.name.toLowerCase().includes(term) ||
            customer.phone.toLowerCase().includes(term) ||
            (customer.id_number && customer.id_number.toLowerCase().includes(term))
        );
    });

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const currentCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Fetch credit transactions for global history
    const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<CreditTransaction[]>({
        queryKey: ['/api/credit-transactions/'],
        queryFn: () => apiRequest('/api/credit-transactions/'),
    });

    // Create customer mutation
    const createCustomerMutation = useMutation({
        mutationFn: (data: Partial<Customer>) => apiRequest('/api/customers/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/customers/'] });
            setIsDialogOpen(false);
            toast({
                title: 'Success',
                description: 'Customer created successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to create customer',
                variant: 'destructive',
            });
        },
    });

    // Update customer mutation
    const updateCustomerMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) =>
            apiRequest(`/api/customers/${id}/`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/customers/'] });
            setIsDialogOpen(false);
            setEditingCustomer(null);
            toast({
                title: 'Success',
                description: 'Customer updated successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update customer',
                variant: 'destructive',
            });
        },
    });

    // Record payment mutation
    const recordPaymentMutation = useMutation({
        mutationFn: ({ id, amount, payment_method, notes }: { id: number; amount: number; payment_method: string; notes: string }) =>
            apiRequest(`/api/customers/${id}/record_payment/`, {
                method: 'POST',
                body: JSON.stringify({ amount, payment_method, notes }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['api_customers'] });
            setIsPaymentDialogOpen(false);
            setSelectedCustomer(null);
            toast({
                title: 'Success',
                description: 'Payment recorded successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to record payment',
                variant: 'destructive',
            });
        },
    });

    // Delete customer mutation
    const deleteCustomerMutation = useMutation({
        mutationFn: (id: number) => apiRequest(`/api/customers/${id}/`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/customers/'] });
            setIsDeleteDialogOpen(false);
            setCustomerToDelete(null);
            toast({
                title: 'Record Terminated',
                description: 'Customer file has been permanently removed.',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Security Exception',
                description: error.message || 'Failed to remove customer record.',
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: any) => {
        const { payment, ...customerData } = data;

        if (editingCustomer) {
            updateCustomerMutation.mutate({ id: editingCustomer.id, data: customerData });

            // Handle Quick Pay if provided
            if (payment && payment.amount > 0) {
                recordPaymentMutation.mutate({
                    id: editingCustomer.id,
                    amount: payment.amount,
                    payment_method: payment.method,
                    notes: payment.notes || 'Reconciliation during record update'
                });
            }
        } else {
            createCustomerMutation.mutate(customerData);
        }
    };

    const handlePaymentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        const formData = new FormData(e.currentTarget);
        const amount = Number(formData.get('amount'));
        const payment_method = formData.get('payment_method') as string;
        const notes = formData.get('notes') as string;

        recordPaymentMutation.mutate({
            id: selectedCustomer.id,
            amount,
            payment_method,
            notes,
        });
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    };

    const handleRecordPayment = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsPaymentDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) setEditingCustomer(null);
    };

    const handleDeleteClick = (customer: Customer) => {
        setCustomerToDelete(customer);
        setIsDeleteDialogOpen(true);
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
            active: 'default',
            suspended: 'secondary',
            blacklisted: 'destructive',
        };
        return (
            <Badge variant={variants[status] || 'default'}>
                {status === 'active' && <CheckCircle className="mr-1 h-3 w-3" />}
                {status === 'suspended' && <Ban className="mr-1 h-3 w-3" />}
                {status === 'blacklisted' && <Ban className="mr-1 h-3 w-3" />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Customer Management</h1>
                    <p className="text-muted-foreground">Manage customers and credit accounts</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingCustomer(null)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Customer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-slate-900 rounded-lg">
                                    <UserIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-slate-900">
                                        {editingCustomer ? 'Refine Identity' : 'Provision New Identity'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {editingCustomer ? 'Update existing customer parameters' : 'Establish a new customer credit profile'}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <AddCustomerForm
                            initialData={editingCustomer}
                            shops={shops}
                            isAdmin={isAdmin}
                            userShop={user?.shop}
                            onSubmit={onSubmit}
                            onCancel={() => handleDialogClose(false)}
                            isLoading={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* View & Search Control */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search name, phone, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
                    />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className={`gap-2 h-8 px-3 ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Cards
                    </Button>
                    <Button
                        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className={`gap-2 h-8 px-3 ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                        <List className="h-3.5 w-3.5" />
                        Table
                    </Button>
                </div>
            </div>

            {/* Visualizer */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentCustomers.map((customer: Customer) => (
                        <Card key={customer.id} className="group hover:border-primary/20 transition-all duration-300 hover:shadow-md border-slate-100">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">{customer.name}</CardTitle>
                                            <CardDescription className="text-xs font-mono tracking-tighter">{customer.phone}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-full"
                                            onClick={() => handleEdit(customer)}
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/5 rounded-full"
                                            onClick={() => handleDeleteClick(customer)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-1">
                                {customer.shop_name && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-slate-50 w-fit px-2 py-1 rounded-md">
                                        <Store className="h-3 w-3" />
                                        {customer.shop_name}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500 font-medium">Credit Limit</span>
                                        <span className="font-bold text-slate-900">KES {customer.credit_limit.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-t border-slate-100/50 pt-2 mt-1">
                                        <span className="text-slate-500 font-medium">Outstanding</span>
                                        <span className={`font-bold ${customer.current_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            KES {customer.current_balance.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    {getStatusBadge(customer.status)}
                                    {customer.current_balance > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRecordPayment(customer)}
                                            className="h-8 rounded-full border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all px-3"
                                        >
                                            <CreditCard className="mr-2 h-3.5 w-3.5" />
                                            Pay
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">Identity</TableHead>
                                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">National ID</TableHead>
                                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                                    <div className="flex items-center gap-2">
                                        <Store className="h-3.5 w-3.5 text-slate-400" />
                                        Branch
                                    </div>
                                </TableHead>
                                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">Credit Profile</TableHead>
                                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentCustomers.map((customer) => (
                                <TableRow key={customer.id} className="group hover:bg-slate-50 transition-colors border-slate-100">
                                    <TableCell className="py-4 px-6">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900">{customer.name}</span>
                                            <span className="text-xs text-slate-500 font-mono tracking-tighter">{customer.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <span className="text-sm text-slate-600 font-medium">{customer.id_number || '—'}</span>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <span className="text-sm font-medium text-slate-900">{customer.shop_name || 'Central HQ'}</span>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Limit:</span>
                                                <span className="text-sm font-bold text-slate-900">KES {customer.credit_limit.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Bal:</span>
                                                <span className={`text-sm font-bold ${customer.current_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    KES {customer.current_balance.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {customer.current_balance > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-full"
                                                    onClick={() => handleRecordPayment(customer)}
                                                >
                                                    <CreditCard className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-full"
                                                onClick={() => handleEdit(customer)}
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/5 rounded-full"
                                                onClick={() => handleDeleteClick(customer)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {filteredCustomers.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <UserIcon className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                        <p className="text-muted-foreground mb-4">Get started by adding your first customer</p>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Customer
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="w-9 h-9"
                            >
                                {page}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Credit Transaction History at the bottom */}
            <div className="pt-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <HistoryIcon className="h-5 w-5 text-slate-500" />
                            Credit Transaction History
                        </h2>
                        <p className="text-sm text-slate-500">Chronological audit trail of all credit sales and payments</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="py-3 px-6">Date</TableHead>
                                <TableHead className="py-3 px-6">Customer</TableHead>
                                <TableHead className="py-3 px-6">Type</TableHead>
                                <TableHead className="py-3 px-6 text-right">Amount</TableHead>
                                <TableHead className="py-3 px-6 text-right">Balance After</TableHead>
                                <TableHead className="py-3 px-6">Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isTransactionsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Loading transactions...</TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">No transactions recorded yet</TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((tx: CreditTransaction) => (
                                    <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="py-3 px-6">
                                            <div className="text-sm font-medium">{new Date(tx.created_at).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleTimeString()}</div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {tx.customer_name?.charAt(0) || 'C'}
                                                </div>
                                                <span className="font-medium">{tx.customer_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <Badge variant={tx.transaction_type === 'sale' ? 'outline' : 'default'} className={tx.transaction_type === 'sale' ? 'text-red-600 border-red-200 bg-red-50' : 'text-green-600 border-green-200 bg-green-50'}>
                                                {tx.transaction_type === 'sale' ? 'Credit Sale' : 'Payment'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`py-3 px-6 text-right font-bold ${tx.transaction_type === 'sale' ? 'text-red-700' : 'text-green-700'}`}>
                                            {tx.transaction_type === 'sale' ? '+' : ''}{tx.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="py-3 px-6 text-right font-medium text-slate-900">
                                            {tx.balance_after.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="py-3 px-6 text-slate-500 text-sm italic">
                                            {tx.notes || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment</DialogTitle>
                        <DialogDescription>
                            Record a payment for {selectedCustomer?.name}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedCustomer && (
                        <form onSubmit={handlePaymentSubmit} className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Current Balance:</span>
                                    <span className="font-medium text-red-600">
                                        KES {selectedCustomer.current_balance.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Payment Amount (KES) *</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    max={selectedCustomer.current_balance}
                                    required
                                    placeholder="e.g., 1000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment_method">Payment Method *</Label>
                                <Select name="payment_method" defaultValue="Cash">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                                        <SelectItem value="Card">Card</SelectItem>
                                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Input
                                    id="notes"
                                    name="notes"
                                    placeholder="Optional notes"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    Record Payment
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2 text-destructive">
                            <div className="p-2 bg-destructive/10 rounded-lg">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <AlertDialogTitle className="text-xl font-bold">Terminate Identity Record?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-slate-600 leading-relaxed">
                            You are about to permanently remove <span className="font-bold text-slate-900">{customerToDelete?.name}</span> from the system registry.
                            This action cannot be undone and will be logged in the activity audit trail.
                            {customerToDelete?.current_balance && customerToDelete.current_balance > 0 && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium">
                                    WARNING: This customer has an outstanding balance of KES {customerToDelete.current_balance.toLocaleString()}.
                                    System policy strictly prohibits deletion of records with active debt.
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-full border-slate-200">Retain Record</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => customerToDelete && deleteCustomerMutation.mutate(customerToDelete.id)}
                            disabled={deleteCustomerMutation.isPending || (customerToDelete?.current_balance ? customerToDelete.current_balance > 0 : false)}
                            className="rounded-full bg-destructive text-white hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                        >
                            {deleteCustomerMutation.isPending ? 'Terminating...' : 'Confirm Termination'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
