export interface ProductBatch {
    id: number;
    product: number;
    batch_number: string;
    purchase_price: number;
    quantity: number;
    remaining_quantity: number;
    purchase_date: string;
    created_at: string;
    updated_at: string;
}

export interface BatchSaleItem {
    id: number;
    sale_item: number;
    batch: number;
    quantity: number;
    created_at: string;
}

export interface BatchSaleDetails {
    id: number;
    quantity: number;
    batch_number: string;
    purchase_price: number;
    product_name: string;
} 