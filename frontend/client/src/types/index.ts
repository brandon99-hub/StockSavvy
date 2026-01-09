export interface Shop {
  id: number;
  name: string;
  code: string;
  location?: string;
  phone?: string;
  manager?: number | null;
  manager_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'manager' | 'staff' | 'user';
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  shop?: number;
  shop_name?: string;
  can_access_all_shops: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopInventory {
  id: number;
  shop: number;
  product: number;
  product_name: string;
  product_sku: string;
  product_barcode?: string;
  quantity: number;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  shop: number;
  shop_name?: string;
  name: string;
  phone: string;
  id_number?: string;
  credit_limit: number;
  current_balance: number;
  status: 'active' | 'suspended' | 'blacklisted';
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface CreditTransaction {
  id: number;
  customer: number;
  customer_name: string;
  shop: number;
  sale?: number;
  transaction_type: 'sale' | 'payment';
  amount: number;
  balance_after: number;
  payment_method?: string;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}


export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface UOMDefinition {
  id: number;
  code: string;
  description: string;
  packSize: number;
  unitCost: number;
  unitPrice: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  category_id: number;
  category?: number | { id: number; name: string }; // For various API responses
  category_name?: string; // For analytics
  buy_price: number;
  sell_price: number;
  stock: number;
  quantity?: number; // For analytics aliases
  min_stock: number;
  min_stock_level?: number; // For analytics aliases
  status?: string; // For analytics aliases
  barcode?: string;
  bc_item_no?: string;
  last_bc_sync?: string;
  uom_data?: UOMDefinition[];
  sync_hash?: string;
  is_manual_override?: boolean;
  uom_type: 'PCS' | 'CARTON';
  carton_size?: number; // Number of units in a carton
  pieces_per_carton: number;
  carton_buy_price?: number;
  carton_sell_price?: number;
  master_quantity: number;
  shop_total_quantity?: number;
  has_shop_inventory?: boolean;
  has_mismatch?: boolean;
  quantity_diff?: number;
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
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
}

export interface Sale {
  id: number;
  sale_date: string;
  total_amount: number;
  original_amount: number;
  discount: number;
  discount_percentage: number;
  user_id: number;
  sold_by: string;
  items_count: number;
  total_quantity: number;
  items: string; // This is a comma-separated string of product names and quantities
  created_at: string;
  items_details?: SaleItem[];  // Optional detailed items array
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  created_at: string;
  status: string;
  user_name: string;
  shop_name?: string;
  shop_id?: number;
  activity_type: 'sale' | 'restock' | 'warning' | 'info';
  user?: User;
  details?: any; // For detailed logs (structured object)
  quantity?: number; // For movement logs
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

export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'syncing' | 'complete' | 'error';
  last_product?: string;
  message?: string;
}