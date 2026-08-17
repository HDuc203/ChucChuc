// ── Supabase Database Types ──────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_deleted?: boolean;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_deleted?: boolean;
  created_at?: string;
  categories?: Category;
}

export interface Table {
  id: string;
  name: string;
  status: 'empty' | 'occupied' | 'needs_cleaning';
}

export interface Order {
  id: string;
  order_type: 'takeaway' | 'dine_in';
  table_id: string | null;
  status: 'open' | 'paid' | 'cancelled';
  payment_method: 'cash' | 'transfer' | 'qr' | null;
  total_amount: number;
  created_at: string;
  paid_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  note: string | null;
  created_at: string;
  products?: Product;
}

export type ExpenseCategory = 'nguyen_lieu' | 'dien_nuoc' | 'mat_bang' | 'luong' | 'khac';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  created_at?: string;
}

export interface MonthlyProfit {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

// ── Cart Types ───────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product;
  quantity: number;
  note: string;
  orderItemId?: string;
}

export type OrderType = 'takeaway' | 'dine_in' | null;

export type PaymentMethod = 'cash' | 'transfer' | 'qr';

// ── Navigation param types ────────────────────────────────────────────────────

export type RootStackParamList = {
  index: undefined;
  'table-select': undefined;
  menu: undefined;
  cart: undefined;
  payment: undefined;
  dashboard: undefined;
  manage: undefined;
  'orders-history': undefined;
  expenses: undefined;
};
