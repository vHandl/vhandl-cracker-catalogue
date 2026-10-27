import db from './db.js';

const REUSE_DAYS = Number(process.env.TOKEN_REUSE_DAYS || 30);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Keep only digits; accept an optional +91 / 91 / 0 prefix. Returns 10 digits or null. */
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

/** Generate a random 4-digit token not used by any order created within the reuse window. */
function generateToken() {
  const cutoff = new Date(Date.now() - REUSE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const used = new Set(
    db
      .prepare('SELECT DISTINCT token FROM orders WHERE created_at >= ?')
      .all(cutoff)
      .map((r) => r.token)
  );
  if (used.size >= 9000) {
    throw new HttpError(503, 'Too many recent orders. Please ask the shop to help you.');
  }
  for (let i = 0; i < 200; i++) {
    const t = String(Math.floor(1000 + Math.random() * 9000));
    if (!used.has(t)) return t;
  }
  // Pool is crowded: pick deterministically from what is left.
  const free = [];
  for (let n = 1000; n <= 9999; n++) if (!used.has(String(n))) free.push(String(n));
  return free[Math.floor(Math.random() * free.length)];
}

const createOrderTx = db.transaction((customerName, customerPhone, items) => {
  const getProduct = db.prepare(
    `SELECT p.id, p.code, p.name, p.price, p.unit, c.name AS category_name, c.sort_order AS category_order
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? AND p.active = 1 AND p.out_of_stock = 0`
  );

  // Merge duplicate product ids.
  const merged = new Map();
  for (const it of items) {
    const productId = Number(it?.productId);
    const qty = Number(it?.qty);
    if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1 || qty > 9999) {
      throw new HttpError(400, 'Invalid item or quantity.');
    }
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }

  const lines = [];
  for (const [productId, qty] of merged) {
    const p = getProduct.get(productId);
    if (!p) throw new HttpError(400, 'One of the selected items is out of stock or no longer available. Please refresh.');
    lines.push({ ...p, qty, line_total: round2(p.price * qty) });
  }

  const total = round2(lines.reduce((s, l) => s + l.line_total, 0));
  const token = generateToken();

  const { lastInsertRowid } = db
    .prepare('INSERT INTO orders (token, customer_name, customer_phone, total) VALUES (?, ?, ?, ?)')
    .run(token, customerName, customerPhone, total);
  const orderId = Number(lastInsertRowid);

  const insertItem = db.prepare(
    `INSERT INTO order_items
     (order_id, product_code, product_name, category_name, category_order, unit, unit_price, qty, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of lines) {
    insertItem.run(orderId, l.code, l.name, l.category_name, l.category_order, l.unit, l.price, l.qty, l.line_total);
  }
  return orderId;
});

export function getOrderById(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  return hydrate(order);
}

function hydrate(order) {
  const items = db
    .prepare(
      `SELECT product_code AS code, product_name AS name, category_name AS category, unit,
              unit_price AS price, qty, line_total AS lineTotal
       FROM order_items WHERE order_id = ?
       ORDER BY category_order, category_name, product_code`
    )
    .all(order.id);
  return {
    id: order.id,
    token: order.token,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    total: order.total,
    createdAt: order.created_at,
    items,
  };
}

export function createOrder(body) {
  const name = String(body?.customerName ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, 'Please enter your name.');
  }
  const phone = normalizePhone(body?.customerPhone);
  if (!phone) throw new HttpError(400, 'Please enter a valid 10-digit contact number.');
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 300) {
    throw new HttpError(400, 'Please select at least one item.');
  }
  const id = createOrderTx(name, phone, items);
  return getOrderById(id);
}

/** Orders matching a 4-digit token, newest first, with items. */
export function findOrdersByToken(token) {
  return db
    .prepare('SELECT * FROM orders WHERE token = ? ORDER BY created_at DESC, id DESC')
    .all(String(token))
    .map(hydrate);
}

export function listOrders({ q = '', limit = 50 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const term = `%${String(q).trim()}%`;
  const rows = q
    ? db
        .prepare(
          `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
           FROM orders o
           WHERE o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.token LIKE ?
           ORDER BY o.created_at DESC, o.id DESC LIMIT ?`
        )
        .all(term, term, term, lim)
    : db
        .prepare(
          `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
           FROM orders o ORDER BY o.created_at DESC, o.id DESC LIMIT ?`
        )
        .all(lim);
  return rows.map((o) => ({
    id: o.id,
    token: o.token,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    total: o.total,
    createdAt: o.created_at,
    itemCount: o.item_count,
  }));
}
