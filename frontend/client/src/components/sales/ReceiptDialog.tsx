import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import Receipt from './Receipt';
import { useToast } from '../../hooks/use-toast';
import { Printer, X } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

interface ReceiptDialogProps {
    isOpen: boolean;
    onClose: () => void;
    saleId: number;
    storeName: string;
}

const ReceiptDialog: React.FC<ReceiptDialogProps> = ({ isOpen, onClose, saleId, storeName }) => {
    const { toast } = useToast();
    const [receiptData, setReceiptData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && saleId) {
            fetchReceiptData();
        }
    }, [isOpen, saleId]);

    const fetchReceiptData = async () => {
        setIsLoading(true);
        try {
            const response = await apiRequest(`/api/sales/${saleId}/receipt/`, {
                method: 'GET'
            });
            setReceiptData(response);
        } catch (error: any) {
            console.error('Error fetching receipt data:', error);
            toast({
                title: "Error",
                description: error.response?.data?.detail || "Failed to fetch receipt data",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({
                title: "Error",
                description: "Could not open print window. Please check your browser settings.",
                variant: "destructive"
            });
            return;
        }

        const receiptElement = document.getElementById('receipt');
        if (!receiptElement) return;

        const printContent = `
            <html>
                <head>
                    <title>Receipt #${receiptData?.sale?.id}</title>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 0;
                            font-family: Arial, sans-serif;
                        }
                        @media print {
                            body { 
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                margin: 0;
                                size: 80mm 297mm;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${receiptElement.outerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    const handlePrintBoth = () => {
        handlePrint();
        toast({
            title: "Receipts Generated",
            description: "Two copies of the receipt have been generated for printing.",
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Print Receipt</DialogTitle>
                </DialogHeader>
                <div className="py-4 flex justify-center">
                    {isLoading ? (
                        <div className="text-center">Loading receipt data...</div>
                    ) : receiptData ? (
                        <Receipt 
                            sale={receiptData.sale} 
                            items={receiptData.items}
                            storeName={storeName} 
                        />
                    ) : (
                        <div className="text-center">No receipt data available</div>
                    )}
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <Button 
                        onClick={handlePrintBoth}
                        disabled={!receiptData || isLoading}
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Print Both Copies
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReceiptDialog; 