import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Shop, User } from '../types/index';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { Plus, Edit, Trash2, Store, MapPin, Phone, User as UserIcon, LayoutGrid, List, Search, Loader2 } from 'lucide-react';

export default function ShopsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingShop, setEditingShop] = useState<Shop | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch shops
    const { data: shops = [], isLoading } = useQuery({
        queryKey: ['/api/shops/'],
        queryFn: () => apiRequest('/api/shops/'),
    });

    // Fetch users (for manager selection)
    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['/api/users/'],
        queryFn: () => apiRequest('/api/users/'),
    });

    // Create shop mutation
    const createShopMutation = useMutation({
        mutationFn: (data: Partial<Shop>) => apiRequest('/api/shops/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/shops/'] });
            setIsDialogOpen(false);
            toast({
                title: 'Success',
                description: 'Shop created successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to create shop',
                variant: 'destructive',
            });
        },
    });

    // Update shop mutation
    const updateShopMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Shop> }) =>
            apiRequest(`/api/shops/${id}/`, {
                method: 'PUT',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/shops/'] });
            setIsDialogOpen(false);
            setEditingShop(null);
            toast({
                title: 'Success',
                description: 'Shop updated successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update shop',
                variant: 'destructive',
            });
        },
    });

    // Delete shop mutation
    const deleteShopMutation = useMutation({
        mutationFn: (id: number) => apiRequest(`/api/shops/${id}/`, {
            method: 'DELETE',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/shops/'] });
            toast({
                title: 'Success',
                description: 'Shop deleted successfully',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete shop',
                variant: 'destructive',
            });
        },
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const managerValue = formData.get('manager') as string;
        const data = {
            name: formData.get('name') as string,
            code: formData.get('code') as string,
            location: formData.get('location') as string,
            phone: formData.get('phone') as string,
            manager: managerValue && managerValue !== 'none' ? Number(managerValue) : null,
            is_active: true,
        };

        if (editingShop) {
            updateShopMutation.mutate({ id: editingShop.id, data });
        } else {
            createShopMutation.mutate(data);
        }
    };

    const handleEdit = (shop: Shop) => {
        setEditingShop(shop);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this shop?')) {
            deleteShopMutation.mutate(id);
        }
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingShop(null);
    };

    const filteredShops = shops.filter((shop: Shop) =>
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.location && shop.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Shop Management</h1>
                    <p className="text-muted-foreground mt-1 text-lg">Centralize and manage your retail locations effectively.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-muted rounded-lg p-1">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className="px-3"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('table')}
                            className="px-3"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button onClick={() => { setEditingShop(null); setIsDialogOpen(true); }} className="shadow-lg shadow-primary/20">
                        <Plus className="mr-2 h-5 w-5" />
                        Add Shop
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 max-w-md">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search shops..."
                        className="pl-9 h-11"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredShops.map((shop: Shop) => (
                        <Card key={shop.id} className="group hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                            <Store className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">{shop.name}</CardTitle>
                                            <CardDescription className="font-mono text-xs uppercase tracking-wider">{shop.code}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-muted"
                                            onClick={() => handleEdit(shop)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleDelete(shop.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2.5">
                                    {shop.location && (
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <div className="p-1 bg-muted rounded-md"><MapPin className="h-3.5 w-3.5" /></div>
                                            {shop.location}
                                        </div>
                                    )}
                                    {shop.phone && (
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <div className="p-1 bg-muted rounded-md"><Phone className="h-3.5 w-3.5" /></div>
                                            {shop.phone}
                                        </div>
                                    )}
                                    {shop.manager_name && (
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <div className="p-1 bg-muted rounded-md"><UserIcon className="h-3.5 w-3.5" /></div>
                                            <span className="font-medium text-foreground">Manager:</span> {shop.manager_name}
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2 flex items-center justify-between border-t border-border/50">
                                    <Badge variant={shop.is_active ? "success" : "secondary"} className="rounded-md px-2 py-0.5">
                                        {shop.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest italic">StockSavvy Verified</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-border/50 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[250px] font-bold">Shop Name</TableHead>
                                <TableHead className="font-bold">Code</TableHead>
                                <TableHead className="font-bold">Location</TableHead>
                                <TableHead className="font-bold">Manager</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                                <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredShops.map((shop: Shop) => (
                                <TableRow key={shop.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-semibold">{shop.name}</TableCell>
                                    <TableCell><Badge variant="outline" className="font-mono text-[10px] uppercase">{shop.code}</Badge></TableCell>
                                    <TableCell>{shop.location || '-'}</TableCell>
                                    <TableCell>{shop.manager_name || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={shop.is_active ? "success" : "secondary"}>
                                            {shop.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(shop)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(shop.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {filteredShops.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-background border-2 border-dashed border-muted rounded-2xl animate-in zoom-in-95 duration-300">
                    <div className="p-6 bg-muted/50 rounded-full mb-6 relative">
                        <Store className="h-12 w-12 text-muted-foreground" />
                        <div className="absolute top-0 right-0 p-1.5 bg-primary rounded-full translate-x-1/4 -translate-y-1/4 animate-bounce">
                            <Plus className="h-3 w-3 text-white" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">No shops found</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs text-center">
                        {searchQuery ? "No shops match your search criteria." : "Experience multi-location management by creating your first shop."}
                    </p>
                    <Button
                        onClick={() => { setEditingShop(null); setIsDialogOpen(true); }}
                        className="mt-8 px-8 py-6 rounded-xl text-lg font-bold transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="mr-2 h-6 w-6" />
                        Get Started
                    </Button>
                </div>
            )}

            {/* Refined Modal */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[500px] overflow-hidden rounded-2xl border-none p-0 shadow-2xl">
                    <div className="px-6 py-6 border-b border-border/50 bg-background/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <Store className="h-7 w-7" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {editingShop ? 'Edit Shop' : 'Add New Shop'}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm mt-0.5">
                                    {editingShop ? `Modify details for ${editingShop.name}` : 'Configure a new retail outlet in your system.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Store className="h-3 w-3" /> Shop Name
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingShop?.name}
                                    required
                                    placeholder="e.g., Downtown flagship"
                                    className="bg-muted/30 border-none h-12 text-lg font-semibold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Edit className="h-3 w-3" /> Shop Code
                                </Label>
                                <Input
                                    id="code"
                                    name="code"
                                    defaultValue={editingShop?.code}
                                    required
                                    placeholder="DTW-01"
                                    className="bg-muted/30 border-none h-11 font-mono uppercase"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Phone className="h-3 w-3" /> Phone
                                </Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    defaultValue={editingShop?.phone}
                                    placeholder="+254..."
                                    className="bg-muted/30 border-none h-11"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <MapPin className="h-3 w-3" /> Location Address
                            </Label>
                            <Input
                                id="location"
                                name="location"
                                defaultValue={editingShop?.location}
                                placeholder="Street, Building, City"
                                className="bg-muted/30 border-none h-11"
                            />
                        </div>
                        <div className="space-y-2 pb-2">
                            <Label htmlFor="manager" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <UserIcon className="h-3 w-3" /> Store Manager
                            </Label>
                            <Select name="manager" defaultValue={editingShop?.manager?.toString() || 'none'}>
                                <SelectTrigger className="bg-muted/30 border-none h-11">
                                    <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {users
                                        .filter(u => u.role === 'manager' || u.role === 'admin')
                                        .map(user => (
                                            <SelectItem key={user.id} value={user.id.toString()}>
                                                {user.name} (@{user.username})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="pt-4 border-t border-border/50 gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDialogClose}
                                className="px-6 h-12 rounded-xl font-bold"
                                disabled={createShopMutation.isPending || updateShopMutation.isPending}
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                className="px-8 h-12 rounded-xl font-bold tracking-wide shadow-xl shadow-primary/20 min-w-[180px]"
                                disabled={createShopMutation.isPending || updateShopMutation.isPending}
                            >
                                {(createShopMutation.isPending || updateShopMutation.isPending) ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {editingShop ? 'UPDATING...' : 'INITIALIZING...'}
                                    </>
                                ) : (
                                    editingShop ? 'UPDATE CONFIGURATION' : 'INITIALIZE LOCATION'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
