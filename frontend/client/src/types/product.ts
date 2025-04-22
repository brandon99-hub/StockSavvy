export interface Product {
    id: number;
    name: string;
    sku: string;
    description: string;
    category: string;
    quantity: number;
    min_stock_level: number;
    buy_price: number;
    sell_price: number;
    created_at: string;
    updated_at: string;
} 