export interface Activity {
    id: number;
    type: string;
    created_at: string;
    quantity?: number;
    product?: number;
    user?: number;
    description?: string;
}

export interface Product {
    id: number;
    name: string;
    sku: string;
    category?: number;
    quantity: number;
    min_stock_level: number;
    sell_price: number;
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