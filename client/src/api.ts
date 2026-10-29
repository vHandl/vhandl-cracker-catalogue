import type { AdminCategory, AdminProduct, Catalogue, Order, OrderSummary, Shop, VisitStats } from './types';

const ADMIN_TOKEN_KEY = 'cc_admin_token';

export const adminAuth = {
  get: () => sessionStorage.getItem(ADMIN_TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(ADMIN_TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(ADMIN_TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  /** Row-level problems, e.g. from a rejected CSV upload. */
  details?: BulkProblem[];
  totalProblems?: number;
  constructor(status: number, message: string, details?: BulkProblem[], totalProblems?: number) {
    super(message);
    this.status = status;
    this.details = details;
    this.totalProblems = totalProblems;
  }
}

export interface BulkProblem {
  line: number;
  code: string;
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}, admin = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (admin) {
    const t = adminAuth.get();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (admin && res.status === 401) adminAuth.clear();
    throw new ApiError(
      res.status,
      data?.error || 'Something went wrong. Please try again.',
      Array.isArray(data?.details) ? data.details : undefined,
      typeof data?.totalProblems === 'number' ? data.totalProblems : undefined
    );
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

// ---- public ----
export const getCatalogue = () => request<Catalogue>('/api/catalogue');

export const submitOrder = (body: {
  customerName: string;
  customerPhone: string;
  items: { productId: number; qty: number }[];
}) => request<{ token: string; order: Order }>('/api/orders', { method: 'POST', body: json(body) });

const VISITOR_KEY = 'cc_visitor_id';
const VISIT_SENT_KEY = 'cc_visit_sent';

/** Count this catalogue open once per browser tab. Failures are ignored so the shop still loads. */
export function pingVisit() {
  if (adminAuth.get()) return;
  try {
    if (sessionStorage.getItem(VISIT_SENT_KEY)) return;
    sessionStorage.setItem(VISIT_SENT_KEY, '1');
  } catch {
    /* private mode can block storage */
  }
  let visitorId = '';
  try {
    visitorId = localStorage.getItem(VISITOR_KEY) || '';
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
  } catch {
    visitorId = crypto.randomUUID();
  }
  request('/api/visits', { method: 'POST', body: json({ visitorId }) }).catch(() => undefined);
}

// ---- admin ----
export const adminLogin = (password: string) =>
  request<{ token: string }>('/api/admin/login', { method: 'POST', body: json({ password }) });

export const adminApi = {
  orders: (q = '') =>
    request<{ orders: OrderSummary[] }>(`/api/admin/orders?q=${encodeURIComponent(q)}`, {}, true),
  ordersByToken: (token: string) =>
    request<{ orders: Order[] }>(`/api/admin/orders?token=${encodeURIComponent(token)}`, {}, true),
  order: (id: number) => request<{ order: Order }>(`/api/admin/orders/${id}`, {}, true),

  products: () => request<AdminProduct[]>('/api/admin/products', {}, true),
  saveProduct: (p: Partial<AdminProduct> & { id?: number }) =>
    p.id
      ? request<{ ok: true }>(`/api/admin/products/${p.id}`, { method: 'PUT', body: json(p) }, true)
      : request<{ id: number }>('/api/admin/products', { method: 'POST', body: json(p) }, true),
  bulkUploadProducts: (csv: string) =>
    request<{ created: number; categoriesCreated: string[] }>(
      '/api/admin/products/bulk',
      { method: 'POST', body: json({ csv }) },
      true
    ),
  /** Uploads a logo / product picture; resolves to the URL to store (e.g. "/uploads/<id>.png"). */
  uploadImage: (file: Blob) =>
    request<{ url: string }>(
      '/api/admin/uploads',
      { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } },
      true
    ),
  bulkProductAction: (action: 'show' | 'hide' | 'delete' | 'outofstock' | 'instock', ids: number[]) =>
    request<{ ok: true; changed: number }>(
      '/api/admin/products/bulk-action',
      { method: 'POST', body: json({ action, ids }) },
      true
    ),
  deleteProduct: (id: number) =>
    request<{ ok: true }>(`/api/admin/products/${id}`, { method: 'DELETE' }, true),

  categories: () => request<AdminCategory[]>('/api/admin/categories', {}, true),
  saveCategory: (c: { id?: number; name: string; sortOrder?: number }) =>
    c.id
      ? request<{ ok: true }>(`/api/admin/categories/${c.id}`, { method: 'PUT', body: json(c) }, true)
      : request<{ id: number }>('/api/admin/categories', { method: 'POST', body: json(c) }, true),
  deleteCategory: (id: number) =>
    request<{ ok: true }>(`/api/admin/categories/${id}`, { method: 'DELETE' }, true),

  saveShop: (s: Shop) => request<{ ok: true }>('/api/admin/shop', { method: 'PUT', body: json(s) }, true),

  stats: () => request<VisitStats>('/api/admin/stats', {}, true),
};
