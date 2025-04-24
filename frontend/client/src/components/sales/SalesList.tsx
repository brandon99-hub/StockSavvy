// @ts-ignore
import React, {useState} from 'react';
import {format} from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../ui/table';
import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
} from "../ui/card";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "../ui/pagination";
import {Button} from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "../ui/dialog";
import {Badge} from '../ui/badge';
import {Input} from '../ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import {
    Sale,
    SaleItem,
    Product,
    User,
    Activity
} from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ReceiptDialog } from './ReceiptDialog';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityLog } from '@/components/activity/ActivityLog';

interface SalesListProps {
    sales: Sale[];
    saleItems: Record<number, SaleItem[]>;
    products: Record<number, Product>;
    users: Record<number, User>;
}

const SalesList = ({sales, saleItems, products, users}: SalesListProps) => {
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [clearError, setClearError] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const itemsPerPage = 10;
    const [receiptData, setReceiptData] = useState<Record<number, any>>({});

    // Filter sales
    const filteredSales = sales.filter(sale => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();

        // Search by sale ID
        if (sale.id.toString().includes(searchLower)) return true;

        // Search by date
        const saleDate = format(new Date(sale.sale_date), 'MMMM d, yyyy HH:mm');
        if (saleDate.toLowerCase().includes(searchLower)) return true;

        // Search by user
        const userName = users[sale.user_id]?.name || '';
        if (userName.toLowerCase().includes(searchLower)) return true;

        // Search by amount
        const amount = sale.total_amount.toString();
        if (amount.includes(searchLower)) return true;

        // Search by items
        const items = saleItems[sale.id] || [];
        for (const item of items) {
            const product = products[item.product_id];
            if (!product) continue;

            // Search by product name
            if (product.name.toLowerCase().includes(searchLower)) return true;

            // Search by quantity
            if (item.quantity.toString().includes(searchLower)) return true;
        }

        return false;
    });

    // Paginate sales
    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedSales = filteredSales
        .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
        .slice(startIndex, startIndex + itemsPerPage);

    // Open sale details
    const openSaleDetails = (sale: Sale) => {
        setSelectedSale(sale);
        setDetailDialogOpen(true);
    };

    // Function to get user display name
    const getUserDisplay = (userId: number | undefined) => {
        if (!userId) return 'Administrator'; // Default to Administrator instead of System
        const user = users[userId];
        if (!user) return 'Administrator';
        return user.name;
    };

    // Fetch receipt data for a sale
    const fetchReceiptData = async (saleId: number) => {
        try {
            const response = await apiRequest(`/api/sales/${saleId}/receipt/`, {
                method: 'GET'
            });

            if (response && response.items) {
                setReceiptData(prev => ({
                    ...prev,
                    [saleId]: response
                }));
            }
        } catch (error) {
            console.error('Error fetching receipt data:', error);
        }
    };

    // Function to get items display
    const getItemsDisplay = (saleId: number) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale || !sale.items || sale.items.length === 0) return 'No items';

        const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        const itemsDisplay = sale.items.map(item => {
            const product = products[item.product_id];
            const description = product?.description ? ` - ${product.description}` : '';
            return `${item.product_name}${description} (${item.quantity})`;
        }).join(', ');

        return `${totalQuantity} items: ${itemsDisplay}`;
    };

    // Handle clear all sales
    const handleClearAll = async () => {
        try {
            setIsClearing(true);
            setClearError(null); // Clear any previous errors

            await apiRequest('/api/sales/clear_all/', {
                method: 'POST'
            });

            toast({
                title: "Success",
                description: "All sales have been cleared successfully",
                variant: "default",
            });

            queryClient.invalidateQueries({ queryKey: ['/api/sales/'] });
            queryClient.invalidateQueries({ queryKey: ['/api/sales-items/'] });
            setClearDialogOpen(false);
        } catch (error: any) {
            // Extract error message from response
            const errorMessage = error.response?.data?.detail || 
                (error instanceof Error ? error.message : 'Unknown error');

            // Set the error state for the dialog
            setClearError(errorMessage);

            // Only show toast for errors that aren't displayed in the dialog
            if (!errorMessage) {
                toast({
                    title: "Error",
                    description: "Failed to clear sales",
                    variant: "destructive",
                });
            }
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <h2 className="text-xl font-semibold">Sales History</h2>
                        <div className="flex space-x-2">
                            <Button
                                variant="destructive"
                                onClick={() => setClearDialogOpen(true)}
                                disabled={sales.length === 0}
                            >
                                <i className="fas fa-trash mr-2"></i> Clear All Sales
                            </Button>
                            <Input
                                placeholder="Search by ID, date, items, amount..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full max-w-xs"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Sale ID</TableHead>
                                    <TableHead className="w-[180px]">Date</TableHead>
                                    <TableHead className="w-[150px]">Sold By</TableHead>
                                    <TableHead className="w-[300px]">Items</TableHead>
                                    <TableHead className="w-[150px]">Original Amount</TableHead>
                                    <TableHead className="w-[150px]">Discount</TableHead>
                                    <TableHead className="w-[150px]">Final Amount</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedSales.map(sale => (
                                    <TableRow key={sale.id} className="group hover:bg-gray-50">
                                        <TableCell className="font-medium">#{sale.id}</TableCell>
                                        <TableCell>{format(new Date(sale.sale_date), 'MMM d, yyyy HH:mm')}</TableCell>
                                        <TableCell>{getUserDisplay(sale.user_id)}</TableCell>
                                        <TableCell>{getItemsDisplay(sale.id)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-100 text-green-800">
                                                KSh {Number(sale.original_amount).toFixed(2)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-red-100 text-red-800">
                                                -KSh {Number(sale.discount || 0).toFixed(2)}
                                            </Badge>
                                            <div className="text-xs text-gray-500 mt-1">
                                                ({Number(sale.discount_percentage || 0).toFixed(1)}%)
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-100 text-green-800">
                                                KSh {Number(sale.total_amount).toFixed(2)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => openSaleDetails(sale)}
                                                className="opacity-70 group-hover:opacity-100"
                                            >
                                                <i className="fas fa-eye text-blue-500 mr-1"></i> View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Showing {Math.min(filteredSales.length, 1 + startIndex)}-{Math.min(filteredSales.length, startIndex + itemsPerPage)} of {filteredSales.length} sales
                    </div>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className={page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}
                                />
                            </PaginationItem>
                            {Array.from({length: Math.min(totalPages, 3)}).map((_, index) => (
                                <PaginationItem key={index}>
                                    <Button
                                        variant={page === index + 1 ? 'outline' : 'ghost'}
                                        size="icon"
                                        onClick={() => setPage(index + 1)}
                                    >
                                        {index + 1}
                                    </Button>
                                </PaginationItem>
                            ))}
                            {totalPages > 3 && (
                                <PaginationItem>
                                    <span className="px-2">...</span>
                                </PaginationItem>
                            )}
                            {totalPages > 3 && (
                                <PaginationItem>
                                    <Button
                                        variant={page === totalPages ? 'outline' : 'ghost'}
                                        size="icon"
                                        onClick={() => setPage(totalPages)}
                                    >
                                        {totalPages}
                                    </Button>
                                </PaginationItem>
                            )}
                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className={page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </CardFooter>
            </Card>

            {/* Sale Details Dialog */}
            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Sale Details - #{selectedSale?.id}</DialogTitle>
                    </DialogHeader>

                    {selectedSale && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Date</p>
                                    <p className="font-medium">{format(new Date(selectedSale.sale_date), 'MMMM d, yyyy HH:mm:ss')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Sold By</p>
                                    <p className="font-medium">{getUserDisplay(selectedSale.user_id)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Amount</p>
                                    <p className="font-medium text-green-600">
                                        KSh {Number(selectedSale.total_amount - (selectedSale.discount || 0)).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Items</p>
                                    <p className="font-medium">{getItemsDisplay(selectedSale.id)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Original Amount</p>
                                    <p className="font-medium">
                                        KSh {Number(selectedSale.original_amount).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Discount Applied</p>
                                    <p className="font-medium text-red-600">
                                        -KSh {Number(selectedSale.discount || 0).toFixed(2)}
                                        <span className="text-gray-500 ml-2">
                                        ({Number(selectedSale.discount_percentage || 0).toFixed(1)}%)
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="font-medium mb-2">Sale Items</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(saleItems[selectedSale.id] || []).map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{products[item.product_id]?.name || `Product #${item.product_id}`}</div>
                                                        {products[item.product_id]?.description && (
                                                            <div className="text-xs text-gray-500">{products[item.product_id].description}</div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell
                                                    className="text-right">KSh {Number(item.unit_price).toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                <TableCell
                                                    className="text-right">KSh {Number(item.total_price).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end items-center border-t pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setDetailDialogOpen(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog 
                open={clearDialogOpen} 
                onOpenChange={(open) => {
                    if (!open) {
                        setClearDialogOpen(false);
                        setClearError(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {clearError ? 'Error Clearing Sales' : 'Clear All Sales'}
                        </DialogTitle>
                        {clearError ? (
                            <div>
                                <DialogDescription className="text-red-500 font-medium mb-2">
                                    {clearError}
                                </DialogDescription>
                                <DialogDescription>
                                    There was an error while trying to clear all sales. This could be due to:
                                    <ul className="list-disc pl-5 mt-2">
                                        <li>Sales data being referenced by other parts of the system</li>
                                        <li>Insufficient permissions to perform this action</li>
                                        <li>A temporary server issue</li>
                                    </ul>
                                    You may want to try again later or contact your system administrator.
                                </DialogDescription>
                            </div>
                        ) : (
                            <DialogDescription>
                                Are you sure you want to clear all sales data? This action cannot be undone.
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setClearDialogOpen(false)}
                            disabled={isClearing}
                        >
                            {clearError ? 'Close' : 'Cancel'}
                        </Button>
                        {!clearError && (
                            <Button
                                variant="destructive"
                                onClick={handleClearAll}
                                disabled={isClearing}
                            >
                                {isClearing ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Clearing...
                                    </>
                                ) : (
                                    'Clear All Sales'
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SalesList;
