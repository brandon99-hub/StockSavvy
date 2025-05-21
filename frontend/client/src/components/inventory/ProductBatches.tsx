import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { ProductBatch } from '../../types/batch';
import { apiRequest } from '../../lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../lib/auth';
import { AlertTriangle } from 'lucide-react';

interface ProductBatchesProps {
    productId: number;
}

interface BatchStats {
    total_batches: number;
    total_quantity: number;
    total_remaining: number;
    average_price: number;
}

export const ProductBatches: React.FC<ProductBatchesProps> = ({ productId }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [batches, setBatches] = useState<ProductBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<BatchStats | null>(null);
    const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
    const [isAddingBatch, setIsAddingBatch] = useState(false);
    const [filters, setFilters] = useState({
        min_remaining: '',
        max_remaining: '',
        start_date: '',
        end_date: '',
        search: ''
    });

    const [newBatch, setNewBatch] = useState({
        batch_number: '',
        purchase_price: '',
        selling_price: '',
        quantity: '',
        purchase_date: new Date().toISOString().split('T')[0]
    });

    const [warningModal, setWarningModal] = useState<{ message: string, data: any, mode: 'create' | 'update' } | null>(null);

    // Fetch batches with React Query
    const { data: batchesData = [], isLoading: isLoadingBatches } = useQuery<ProductBatch[]>({
        queryKey: ['batches', productId, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('product_id', productId.toString());
            if (filters.min_remaining) params.append('min_remaining', filters.min_remaining);
            if (filters.max_remaining) params.append('max_remaining', filters.max_remaining);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.search) params.append('search', filters.search);

            return apiRequest(`/api/product-batches/?${params.toString()}`);
        }
    });

    // Fetch stats with React Query
    const { data: statsData } = useQuery<BatchStats>({
        queryKey: ['batch-stats', productId],
        queryFn: () => apiRequest(`/api/product-batches/stats/?product_id=${productId}`)
    });

    const handleCreateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingBatch(true);
        try {
            await apiRequest('/api/product-batches/', {
                method: 'POST',
                body: JSON.stringify({
                    product: productId,
                    ...newBatch,
                    purchase_price: parseFloat(newBatch.purchase_price),
                    selling_price: newBatch.selling_price ? parseFloat(newBatch.selling_price) : null,
                    quantity: parseInt(newBatch.quantity)
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            // Invalidate and refetch queries
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });

            setNewBatch({
                batch_number: '',
                purchase_price: '',
                selling_price: '',
                quantity: '',
                purchase_date: new Date().toISOString().split('T')[0]
            });
            toast({
                title: 'Success',
                description: 'Batch created successfully',
            });
        } catch (err: any) {
            const warning = err?.response?.data?.selling_price?.[0];
            if (warning) {
                setWarningModal({ message: warning, data: { ...newBatch }, mode: 'create' });
            } else {
                console.error('Error creating batch:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to create batch. Please try again.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsAddingBatch(false);
        }
    };

    const handleCreateBatchWithForce = async () => {
        setIsAddingBatch(true);
        try {
            await apiRequest('/api/product-batches/', {
                method: 'POST',
                body: JSON.stringify({
                    product: productId,
                    ...warningModal?.data,
                    purchase_price: parseFloat(warningModal?.data.purchase_price),
                    selling_price: warningModal?.data.selling_price ? parseFloat(warningModal?.data.selling_price) : null,
                    quantity: parseInt(warningModal?.data.quantity),
                    force: true
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });
            setNewBatch({
                batch_number: '',
                purchase_price: '',
                selling_price: '',
                quantity: '',
                purchase_date: new Date().toISOString().split('T')[0]
            });
            toast({
                title: 'Success',
                description: 'Batch created successfully',
            });
        } catch (err: any) {
            toast({
                title: 'Error',
                description: 'Failed to create batch. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsAddingBatch(false);
            setWarningModal(null);
        }
    };

    const handleUpdateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBatch) return;

        try {
            await apiRequest(`/api/product-batches/${editingBatch.id}/`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...editingBatch,
                    purchase_price: typeof editingBatch.purchase_price === 'number' ? editingBatch.purchase_price : parseFloat(String(editingBatch.purchase_price || 0)),
                    selling_price: editingBatch.selling_price !== null && editingBatch.selling_price !== undefined ? parseFloat(String(editingBatch.selling_price)) : null,
                    quantity: typeof editingBatch.quantity === 'number' ? editingBatch.quantity : parseInt(String(editingBatch.quantity || 0))
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });
            setEditingBatch(null);
        } catch (err: any) {
            const warning = err?.response?.data?.selling_price?.[0];
            if (warning) {
                setWarningModal({ message: warning, data: { ...editingBatch }, mode: 'update' });
            } else {
                setError('Failed to update batch');
                console.error('Error updating batch:', err);
            }
        }
    };

    const handleUpdateBatchWithForce = async () => {
        if (!editingBatch) return;
        try {
            await apiRequest(`/api/product-batches/${editingBatch.id}/`, {
                method: 'PUT',
                data: {
                    ...warningModal?.data,
                    purchase_price: typeof warningModal?.data.purchase_price === 'number' ? warningModal?.data.purchase_price : parseFloat(String(warningModal?.data.purchase_price || 0)),
                    selling_price: warningModal?.data.selling_price !== null && warningModal?.data.selling_price !== undefined ? parseFloat(String(warningModal?.data.selling_price)) : null,
                    quantity: typeof warningModal?.data.quantity === 'number' ? warningModal?.data.quantity : parseInt(String(warningModal?.data.quantity || 0)),
                    force: true
                }
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });
            setEditingBatch(null);
        } catch (err) {
            setError('Failed to update batch');
            console.error('Error updating batch:', err);
        } finally {
            setWarningModal(null);
        }
    };

    const handleDeleteBatch = async (batchId: number) => {
        try {
            await apiRequest(`/api/product-batches/${batchId}/`, {
                method: 'DELETE'
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });

            // Show success toast
            toast({
                title: 'Success',
                description: 'Batch deleted successfully',
            });
        } catch (err: any) {
            // Extract the error message
            const errorMessage = err.message || 'Failed to delete batch';

            // Set error state
            setError(errorMessage);

            // Show error toast with the specific message
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });

            console.error('Error deleting batch:', err);
        }
    };

    if (isLoadingBatches) return <div>Loading batches...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Product Batches</CardTitle>
                {stats && (
                    <div className="grid grid-cols-4 gap-4 mt-4">
                        <div>
                            <h3 className="text-sm font-medium">Total Batches</h3>
                            <p className="text-2xl font-bold">{stats.total_batches}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Total Quantity</h3>
                            <p className="text-2xl font-bold">{stats.total_quantity}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Remaining</h3>
                            <p className="text-2xl font-bold">{stats.total_remaining}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Avg. Price</h3>
                            <p className="text-2xl font-bold">{formatCurrency(stats.average_price)}</p>
                        </div>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="search">Search Batch Number</Label>
                            <Input
                                id="search"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Enter batch number..."
                            />
                        </div>
                        <div>
                            <Label htmlFor="min_remaining">Min Remaining</Label>
                            <Input
                                id="min_remaining"
                                type="number"
                                value={filters.min_remaining}
                                onChange={(e) => setFilters({ ...filters, min_remaining: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="max_remaining">Max Remaining</Label>
                            <Input
                                id="max_remaining"
                                type="number"
                                value={filters.max_remaining}
                                onChange={(e) => setFilters({ ...filters, max_remaining: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Add Batch Form */}
                    <form onSubmit={handleCreateBatch} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="batch_number">Batch Number</Label>
                                <Input
                                    id="batch_number"
                                    value={newBatch.batch_number}
                                    onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="purchase_price">Purchase Price</Label>
                                <Input
                                    id="purchase_price"
                                    type="number"
                                    step="0.01"
                                    value={newBatch.purchase_price}
                                    onChange={(e) => setNewBatch({ ...newBatch, purchase_price: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="selling_price">Selling Price (Optional)</Label>
                                <Input
                                    id="selling_price"
                                    type="number"
                                    step="0.01"
                                    value={newBatch.selling_price}
                                    onChange={(e) => setNewBatch({ ...newBatch, selling_price: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    value={newBatch.quantity}
                                    onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="purchase_date">Purchase Date</Label>
                                <Input
                                    id="purchase_date"
                                    type="date"
                                    value={newBatch.purchase_date}
                                    onChange={(e) => setNewBatch({ ...newBatch, purchase_date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isAddingBatch}>
                            {isAddingBatch ? "Adding Batch..." : "Add Batch"}
                        </Button>
                    </form>

                    {/* Batches Table */}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Batch Number</TableHead>
                                <TableHead>Purchase Price</TableHead>
                                <TableHead>Selling Price</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Remaining</TableHead>
                                <TableHead>Purchase Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batchesData.map((batch) => (
                                <TableRow key={batch.id}>
                                    <TableCell>{batch.batch_number}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(batch.purchase_price)}</TableCell>
                                    <TableCell className="text-right">{batch.selling_price !== undefined && batch.selling_price !== null ? formatCurrency(batch.selling_price) : '-'}</TableCell>
                                    <TableCell>{batch.quantity}</TableCell>
                                    <TableCell>{batch.remaining_quantity}</TableCell>
                                    <TableCell>{formatDate(batch.purchase_date)}</TableCell>
                                    <TableCell>
                                        {batch.remaining_quantity > 0 && batchesData.findIndex(b => b.remaining_quantity > 0) === batchesData.indexOf(batch) ? (
                                            <Badge className="bg-green-100 text-green-800">Current Batch</Badge>
                                        ) : batch.remaining_quantity === 0 ? (
                                            <Badge className="bg-red-100 text-red-800">Depleted</Badge>
                                        ) : (
                                            <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setEditingBatch(batch)}
                                                    >
                                                        Edit
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Edit Batch</DialogTitle>
                                                    </DialogHeader>
                                                    <form onSubmit={handleUpdateBatch} className="space-y-4">
                                                        <div>
                                                            <Label htmlFor="edit_batch_number">Batch Number</Label>
                                                            <Input
                                                                id="edit_batch_number"
                                                                value={editingBatch?.batch_number}
                                                                onChange={(e) => setEditingBatch({
                                                                    ...editingBatch!,
                                                                    batch_number: e.target.value
                                                                })}
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit_purchase_price">Purchase Price</Label>
                                                            <Input
                                                                id="edit_purchase_price"
                                                                type="number"
                                                                step="0.01"
                                                                value={editingBatch?.purchase_price || ''}
                                                                onChange={(e) => setEditingBatch({
                                                                    ...editingBatch!,
                                                                    purchase_price: parseFloat(e.target.value)
                                                                })}
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit_selling_price">Selling Price (Optional)</Label>
                                                            <Input
                                                                id="edit_selling_price"
                                                                type="number"
                                                                step="0.01"
                                                                value={editingBatch?.selling_price || ''}
                                                                onChange={(e) => setEditingBatch({
                                                                    ...editingBatch!,
                                                                    selling_price: e.target.value ? parseFloat(e.target.value) : null
                                                                })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit_quantity">Quantity</Label>
                                                            <Input
                                                                id="edit_quantity"
                                                                type="number"
                                                                value={editingBatch?.quantity || ''}
                                                                onChange={(e) => setEditingBatch({
                                                                    ...editingBatch!,
                                                                    quantity: parseInt(e.target.value)
                                                                })}
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="edit_purchase_date">Purchase Date</Label>
                                                            <Input
                                                                id="edit_purchase_date"
                                                                type="date"
                                                                value={editingBatch?.purchase_date ? editingBatch.purchase_date.split('T')[0] : ''}
                                                                onChange={(e) => setEditingBatch({
                                                                    ...editingBatch!,
                                                                    purchase_date: e.target.value
                                                                })}
                                                                required
                                                            />
                                                        </div>
                                                        <Button type="submit">Save Changes</Button>
                                                    </form>
                                                </DialogContent>
                                            </Dialog>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive">Delete</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the batch
                                                            and update the product quantity.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteBatch(batch.id)}>
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {/* Warning Modal for outlier price */}
            <Dialog open={!!warningModal} onOpenChange={() => setWarningModal(null)}>
                <DialogContent className="max-w-md">
                    <div className="flex flex-col items-center text-center">
                        <AlertTriangle className="w-10 h-10 text-orange-500 mb-2" aria-hidden="true" />
                        <DialogTitle className="text-red-700 font-bold text-lg mb-1">Unusual Price Warning</DialogTitle>
                        <DialogDescription className="mb-2 text-gray-700">
                            {warningModal?.message}
                        </DialogDescription>
                        <div className="text-sm text-gray-500 mb-4">
                            This selling price is much higher or lower than usual for similar products in this category.<br />
                            Please double-check before proceeding.
                        </div>
                        <div className="flex gap-2 w-full justify-center">
                            <Button
                                variant="destructive"
                                className="w-32"
                                onClick={() => {
                                    if (warningModal?.mode === 'create') handleCreateBatchWithForce();
                                    if (warningModal?.mode === 'update') handleUpdateBatchWithForce();
                                }}
                            >
                                Proceed Anyway
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
