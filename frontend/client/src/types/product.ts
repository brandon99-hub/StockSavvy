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
    current_batch_buy_price?: number;
    current_batch_sell_price?: number;
} 