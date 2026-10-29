export interface Shop {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  logoUrl: string;
  mapsUrl: string;
}

export interface Product {
  id: number;
  code: string;
  brand: string;
  name: string;
  categoryId: number;
  price: number;
  unit: string;
  videoUrl: string | null;
  imageUrl: string | null;
  /** Out of stock: shown disabled to customers and cannot be ordered. */
  outOfStock: boolean;
}

export interface Category {
  id: number;
  name: string;
  products: Product[];
}

export interface Catalogue {
  shop: Shop;
  categories: Category[];
}

export interface OrderItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  qty: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  token: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderSummary {
  id: number;
  token: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  itemCount: number;
}

/** productId -> quantity */
export type Selection = Record<number, number>;

export interface AdminProduct {
  id: number;
  code: string;
  brand: string;
  name: string;
  categoryId: number;
  categoryName: string;
  price: number;
  unit: string;
  videoUrl: string;
  imageUrl: string;
  active: boolean;
  outOfStock: boolean;
}

export interface AdminCategory {
  id: number;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface VisitPeriodStats {
  uniqueVisitors: number;
  opens: number;
}

/** Catalogue open counts shown on the admin dashboard. */
export interface VisitStats {
  uniqueVisitors: number;
  totalOpens: number;
  today: VisitPeriodStats;
  week: VisitPeriodStats;
}
