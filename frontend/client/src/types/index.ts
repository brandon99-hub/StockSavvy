export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  category: number;
  quantity: number;
  min_stock_level: number;
  buy_price: string;
  sell_price: string;
  created_at: string;
  updated_at: string;
}

export interface RestockRule {
  id: number;
  product: Product;
  reorder_quantity: number;
  is_auto_reorder_enabled: boolean;
  supplier_id?: number;
  supplier_name: string;
  supplier_email?: string;
  supplier_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale: Sale;
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Sale {
  id: number;
  sale_date: string;
  total_amount: number;
  user?: User;
  created_at: string;
  discount: number;
  discount_percentage: number;
  original_amount: number;
  items?: SaleItem[];
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  message: string;
  details: {
    product_name?: string;
    amount?: number;
    [key: string]: any;
  };
  product?: Product;
  user: User;
  created_at: string;
  status: string;
} 