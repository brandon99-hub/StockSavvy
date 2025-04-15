export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'user';
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  category_id: number;
  buy_price: number;
  sell_price: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface RestockRule {
  id: number;
  product_id: number;
  min_quantity: number;
  restock_quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Sale {
  id: number;
  sale_date: string;
  total_amount: number;
  original_amount: number;
  discount: number;
  discount_percentage: number;
  user_id: number;
  created_at: string;
  items?: SaleItem[];
  user?: User;
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  user_id: number;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
  user?: User;
}

export interface APIResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  status: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ErrorResponse {
  detail: string;
  code?: string;
  status?: number;
} 