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
} from "../ui/dialog";
import {Badge} from '../ui/badge';
import {Input} from '../ui/input';
import {
    Sale,
    SaleItem,
    Product,
    User
} from '../types';

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
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const itemsPerPage = 10;

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
        if (!userId) return users[1]?.name || 'System'; // Show first user's name instead of 'System'
        const user = users[userId];
        if (!user) return users[1]?.name || 'Unknown User';
        return user.name;
    };

    // Function to get items display
    const getItemsDisplay = (saleId: number) => {
        const items = saleItems[saleId] || [];
        const total = items.reduce((sum, item) => sum + item.quantity, 0);
        
        if (items.length === 0) {
            const sale = sales.find(s => s.id === saleId);
            if (sale?.total_amount > 0) {
                return <span className="font-medium">1 item</span>;
            }
            return <span className="font-medium">No items</span>;
        }
        
        const itemsList = items.map(item => {
            const product = products[item.product_id];
            if (!product) return `${item.quantity}x Unknown Product`;
            return `${item.quantity}x ${product.name}`;
        }).join(', ');
        
        return (
            <div className="flex flex-col">
                <span className="font-medium">{total} item{total === 1 ? '' : 's'}</span>
                <span className="text-sm text-gray-500 truncate" title={itemsList}>
                    {itemsList}
                </span>
            </div>
        );
    };

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <h2 className="text-xl font-semibold">Sales History</h2>
                        <div className="flex space-x-2">
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
                                                <TableCell>{products[item.product_id]?.name || `Product #${item.product_id}`}</TableCell>
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
        </>
    );
};

export default SalesList;
