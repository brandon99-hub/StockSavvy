import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProductBatch } from '@/types/batch';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

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
        try {
            await apiRequest('/api/product-batches/', {
                method: 'POST',
                body: JSON.stringify({
                    product: productId,
                    ...newBatch,
                    purchase_price: parseFloat(newBatch.purchase_price),
                    selling_price: newBatch.selling_price ? parseFloat(newBatch.selling_price) : null,
                    quantity: parseInt(newBatch.quantity)
                })
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
        } catch (err) {
            console.error('Error creating batch:', err);
            toast({
                title: 'Error',
                description: 'Failed to create batch. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleUpdateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBatch) return;

        try {
            await apiRequest(`/api/product-batches/${editingBatch.id}/`, {
                method: 'PUT',
                data: {
                    ...editingBatch,
                    purchase_price: parseFloat(editingBatch.purchase_price.toString()),
                    selling_price: editingBatch.selling_price !== null ? parseFloat(editingBatch.selling_price.toString()) : null,
                    quantity: parseInt(editingBatch.quantity.toString())
                }
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });
            setEditingBatch(null);
        } catch (err) {
            setError('Failed to update batch');
            console.error('Error updating batch:', err);
        }
    };

    const handleDeleteBatch = async (batchId: number) => {
        try {
            await apiRequest(`/api/product-batches/${batchId}/`, {
                method: 'DELETE'
            });
            queryClient.invalidateQueries({ queryKey: ['batches', productId] });
            queryClient.invalidateQueries({ queryKey: ['batch-stats', productId] });
        } catch (err) {
            setError('Failed to delete batch');
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
                        <Button type="submit">Add Batch</Button>
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
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batchesData.map((batch) => (
                                <TableRow key={batch.id}>
                                    <TableCell>{batch.batch_number}</TableCell>
                                    <TableCell>{formatCurrency(batch.purchase_price)}</TableCell>
                                    <TableCell>{batch.selling_price ? formatCurrency(batch.selling_price) : '-'}</TableCell>
                                    <TableCell>{batch.quantity}</TableCell>
                                    <TableCell>{batch.remaining_quantity}</TableCell>
                                    <TableCell>{formatDate(batch.purchase_date)}</TableCell>
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
                                                                value={editingBatch?.purchase_price}
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
                                                                value={editingBatch?.quantity}
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
                                                                value={editingBatch?.purchase_date?.split('T')[0] || ''}
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
        </Card>
    );
}; 
