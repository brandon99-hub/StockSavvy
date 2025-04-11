export interface Activity {
    id: number;
    type: string;
    description: string;
    created_at: string;
    status: string;
    user_name: string;
    activity_type: string;
}

export interface Product {
    id: number;
    name: string;
    sku: string;
    description?: string;
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

export interface SaleItem {
    id: number;
    sale: number;
    product: number;
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface User {
    id: number;
    username: string;
    name: string;
    role: string;
    created_at: string;
} 