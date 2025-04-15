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
import { useQueryClient } from '@tanstack/react-query';

interface ReceiptDialogProps {
    isOpen: boolean;
    onClose: () => void;
    saleId: number;
    storeName: string;
}

const ReceiptDialog: React.FC<ReceiptDialogProps> = ({ isOpen, onClose, saleId, storeName }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [receiptData, setReceiptData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

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

    const handlePrint = async () => {
        setIsPrinting(true);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({
                title: "Error",
                description: "Could not open print window. Please check your browser settings.",
                variant: "destructive"
            });
            setIsPrinting(false);
            return;
        }

        const receiptElement = document.getElementById('receipt');
        if (!receiptElement) {
            setIsPrinting(false);
            return;
        }

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

        // Wait for print to complete
        const printComplete = new Promise<void>((resolve) => {
            printWindow.onbeforeunload = () => {
                resolve();
            };
        });

        await printComplete;
        setIsPrinting(false);
    };

    const handlePrintBoth = async () => {
        try {
            // Print first copy
            await handlePrint();
            
            // Small delay before printing second copy
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Print second copy
            await handlePrint();

            // Show success notification
            toast({
                title: "Receipts Generated",
                description: "Two copies of the receipt have been generated for printing.",
            });

            // Log receipt printing activity
            await apiRequest('/api/activities/', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'receipt_printed',
                    description: `Receipt printed for sale #${saleId}`,
                    status: 'completed',
                    user_id: receiptData?.sale?.user_id,
                    created_at: new Date().toISOString()
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch(error => {
                console.error('Error logging activity:', error);
                // Don't show error toast for activity logging failures
            });

            // Refresh activities
            await queryClient.invalidateQueries({ queryKey: ['/api/activities'] });

            onClose();
        } catch (error) {
            console.error('Error printing receipts:', error);
            toast({
                title: "Error",
                description: "Failed to print receipts. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent aria-describedby="receipt-dialog-description">
                <DialogHeader>
                    <DialogTitle>Receipt</DialogTitle>
                </DialogHeader>
                <div id="receipt-dialog-description">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : receiptData ? (
                        <Receipt
                            sale={receiptData.sale}
                            items={receiptData.items}
                            storeName={storeName}
                        />
                    ) : (
                        <div className="text-center text-gray-500">No receipt data available</div>
                    )}
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                    <Button 
                        onClick={handlePrintBoth}
                        disabled={!receiptData || isLoading || isPrinting}
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        {isPrinting ? 'Printing...' : 'Print Both Copies'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReceiptDialog; 