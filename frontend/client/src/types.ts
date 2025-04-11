export interface Activity {
    id: number;
    type: string;
    created_at: string;
    quantity?: number;
    details?: {
        quantity?: number;
        old_quantity?: number;
        new_quantity?: number;
        items?: Array<{
            quantity: number;
            product_id: number;
        }>;
    };
    product?: number;
    user?: number;
    description?: string;
}

export interface Product {
    id: number;
    name: string;
    sku: string;
    quantity: number;
    min_stock_level: number;
    category: number | { id: number; name: string };
    category_id?: number;
    buy_price: number;
    sell_price: number;
    status: string;
}

export interface Category {
    id: number;
    name: string;
    description?: string;
}

export interface Sale {
    id: number;
    created_at: string;
    total_amount: string;
    items: {
        product: number;
        quantity: number;
        unit_price: number;
    }[];
} 