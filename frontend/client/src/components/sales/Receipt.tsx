import React from 'react';
import { format } from 'date-fns';

interface ReceiptProps {
    sale: {
        id: number;
        sale_date: string;
        total_amount: string;
        original_amount: string;
        discount: string;
        discount_percentage: string;
        created_at: string;
        cashier_name: string;
    };
    items: Array<{
        id: number;
        quantity: number;
        unit_price: string;
        total_price: string;
        product_name: string;
        sku: string;
    }>;
    storeName: string;
}

const Receipt: React.FC<ReceiptProps> = ({ sale, items, storeName }) => {
    const formattedDate = format(new Date(sale.sale_date), 'dd/MM/yyyy HH:mm:ss');
    
    return (
        <div className="w-[300px] p-4 bg-white" id="receipt">
            {/* Store Header */}
            <div className="text-center mb-4 border-b border-gray-200 pb-2">
                <h2 className="text-xl font-bold tracking-tight">{storeName}</h2>
                <p className="text-sm text-gray-600">Receipt</p>
            </div>

            {/* Sale Details */}
            <div className="mb-4 text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Receipt #:</span>
                    <span className="font-medium">{sale.id}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Cashier:</span>
                    <span className="font-medium">{sale.cashier_name}</span>
                </div>
            </div>

            {/* Items */}
            <div className="mb-4">
                <div className="border-b border-gray-200 mb-2">
                    <div className="grid grid-cols-4 text-sm font-semibold">
                        <div className="col-span-2">Item</div>
                        <div className="text-right">Qty</div>
                        <div className="text-right">Total</div>
                    </div>
                </div>
                {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-4 text-sm mb-1">
                        <div className="col-span-2">{item.product_name}</div>
                        <div className="text-right">{item.quantity}</div>
                        <div className="text-right">KSh {item.total_price}</div>
                    </div>
                ))}
            </div>

            {/* Totals */}
            <div className="space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>KSh {sale.original_amount}</span>
                </div>
                {parseFloat(sale.discount) > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="text-red-600">-KSh {sale.discount}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total:</span>
                    <span>KSh {sale.total_amount}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 text-xs text-gray-500 space-y-1">
                <p>Thank you for your purchase!</p>
                <p>Please keep this receipt for your records</p>
                <p className="mt-2">--- {storeName} ---</p>
            </div>
        </div>
    );
};

export default Receipt; 