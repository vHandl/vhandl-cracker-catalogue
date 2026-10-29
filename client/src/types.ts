export interface Shop {
  name: string;
  phone: string;
  whatsapp: string;
  /** Optional label for the first pickup location (e.g. "Sivakasi"). */
  locationName: string;
  address: string;
  logoUrl: string;
  mapsUrl: string;
  /** Optional label for the second pickup location. */
  locationName2: string;
  address2: string;
  mapsUrl2: string;
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

export type OrderStatus = 'pending' | 'processed' | 'cancelled' | 'no_response';

export const ORDER_STATUSES: { id: OrderStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'processed', label: 'Processed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no_response', label: 'No response' },
];

export interface Order {
  id: number;
  token: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
  /** 1 = first store, 2 = second store. Missing on older device-saved orders. */
  pickupStore?: 1 | 2;
  pickupName?: string;
  pickupAddress?: string;
  pickupMapsUrl?: string;
  /** Admin fulfilment status. Missing on older device-saved orders. */
  status?: OrderStatus;
}

export interface OrderSummary {
  id: number;
  token: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  itemCount: number;
  pickupStore?: 1 | 2;
  pickupName?: string;
  status?: OrderStatus;
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
