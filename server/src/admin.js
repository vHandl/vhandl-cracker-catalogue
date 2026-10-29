import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import db, { uploadsDir } from './db.js';
import { parseCsv } from './csv.js';
import { login, requireAdmin } from './auth.js';
import { HttpError, findOrdersByToken, getOrderById, listOrders, updateOrderStatus } from './orders.js';
import { getVisitStats } from './visits.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const token = login(req.body?.password);
  if (!token) return res.status(401).json({ error: 'Wrong password.' });
  res.json({ token });
});

router.use(requireAdmin);

// ---------- helpers ----------
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function mapProduct(p) {
  return {
    id: p.id,
    code: p.code,
    brand: p.brand || '',
    name: p.name,
    categoryId: p.category_id,
    categoryName: p.category_name,
    price: p.price,
    unit: p.unit,
    videoUrl: p.video_url || '',
    imageUrl: p.image_url || '',
    active: !!p.active,
    outOfStock: !!p.out_of_stock,
  };
}

const truthy = (v) => v === true || v === 1 || /^(1|y|yes|true|oos|out of stock)$/i.test(String(v ?? '').trim());

function validUrl(v) {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Google Maps share / search links, plus goo.gl and maps.app.goo.gl short links. */
function validMapsUrl(v) {
  if (!v) return true;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host === 'maps.app.goo.gl' || host.endsWith('.maps.app.goo.gl')) return true;
    if (host === 'goo.gl' && path.startsWith('/maps')) return true;
    if (host === 'maps.google.com' || host.startsWith('maps.google.')) return true;
    const hostNoWww = host.replace(/^www\./, '');
    if (hostNoWww === 'google.com' || /^google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(hostNoWww)) {
      return path.startsWith('/maps');
    }
    return false;
  } catch {
    return false;
  }
}

/** An image is either a web link or a file previously uploaded through POST /uploads. */
const UPLOAD_URL = /^\/uploads\/[A-Za-z0-9-]+\.(png|jpe?g|gif|webp)$/i;
const validImageUrl = (v) => !v || UPLOAD_URL.test(v) || validUrl(v);

/** Identifies an image by its first bytes (the Content-Type header is not trusted). SVG is deliberately not allowed. */
function sniffImageExt(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------- image upload (logo / product picture) ----------
// The browser sends the raw file as the request body; the response holds the URL to store on the product/shop.
router.post('/uploads', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, 'Choose an image file to upload.');
  const ext = sniffImageExt(buf);
  if (!ext) throw new HttpError(400, 'Only PNG, JPG, GIF or WebP images can be uploaded.');
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), buf, { flag: 'wx' });
  res.status(201).json({ url: `/uploads/${name}` });
});

/**
 * Builds a new product code from the brand (or, if none, the item name): a 3-letter prefix plus the
 * next free number, e.g. "Sparklers 10cm" -> SPA001, SPA002 ... The code never depends on the full
 * name, so it stays valid if the name is edited later.
 */
function generateCode(brand, name) {
  const letters = (s) => s.toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = (letters(brand) || letters(name) || 'PRD').slice(0, 3).padEnd(3, 'X');
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const { code } of db.prepare('SELECT code FROM products WHERE code LIKE ?').all(`${prefix}%`)) {
    const m = re.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function parseProduct(body, { generate = false } = {}) {
  const brand = str(body.brand, 60);
  const name = str(body.name, 120);
  let code = str(body.code, 30).toUpperCase();
  if (!code && generate && name) code = generateCode(brand, name);
  const unit = str(body.unit, 20) || 'box';
  const price = Number(body.price);
  const categoryId = Number(body.categoryId);
  const videoUrl = str(body.videoUrl, 500);
  const imageUrl = str(body.imageUrl, 500);
  if (!code) throw new HttpError(400, 'Product code is required.');
  if (!name) throw new HttpError(400, 'Product name is required.');
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Enter a valid price.');
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) {
    throw new HttpError(400, 'Select a category.');
  }
  if (!validUrl(videoUrl)) throw new HttpError(400, 'Video URL must start with http:// or https://');
  if (!validImageUrl(imageUrl)) throw new HttpError(400, 'Image must be an uploaded file or a link starting with http:// or https://');
  return {
    code,
    brand,
    name,
    unit,
    price: Math.round(price * 100) / 100,
    categoryId,
    videoUrl: videoUrl || null,
    imageUrl: imageUrl || null,
    active: body.active === false || body.active === 0 ? 0 : 1,
    outOfStock: truthy(body.outOfStock) ? 1 : 0,
  };
}

function wrapUnique(fn) {
  try {
    return fn();
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      throw new HttpError(409, 'That code/name already exists.');
    }
    throw e;
  }
}

// ---------- shop ----------
router.put('/shop', (req, res) => {
  const name = str(req.body.name, 100);
  if (!name) throw new HttpError(400, 'Shop name is required.');
  const logoUrl = str(req.body.logoUrl, 500);
  if (!validImageUrl(logoUrl)) {
    throw new HttpError(400, 'Logo must be an uploaded file or a link starting with http:// or https://');
  }
  const mapsUrl = str(req.body.mapsUrl, 1000);
  const mapsUrl2 = str(req.body.mapsUrl2, 1000);
  if (!validMapsUrl(mapsUrl) || !validMapsUrl(mapsUrl2)) {
    throw new HttpError(
      400,
      'Google Maps link must be an http(s) maps URL (maps.google.com, google.com/maps, goo.gl/maps, or maps.app.goo.gl).'
    );
  }
  db.prepare(
    `UPDATE shop SET name = ?, phone = ?, whatsapp = ?, location_name = ?, address = ?, logo_url = ?, maps_url = ?,
     location_name2 = ?, address2 = ?, maps_url2 = ? WHERE id = 1`
  ).run(
    name,
    str(req.body.phone, 30),
    str(req.body.whatsapp, 30).replace(/\D/g, ''),
    str(req.body.locationName, 80),
    str(req.body.address, 300),
    logoUrl,
    mapsUrl,
    str(req.body.locationName2, 80),
    str(req.body.address2, 300),
    mapsUrl2
  );
  res.json({ ok: true });
});

// ---------- categories ----------
router.get('/categories', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.sort_order AS sortOrder,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount
       FROM categories c ORDER BY c.sort_order, c.name`
    )
    .all();
  res.json(rows);
});

router.post('/categories', (req, res) => {
  const name = str(req.body.name, 60);
  if (!name) throw new HttpError(400, 'Category name is required.');
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get().m;
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) && req.body.sortOrder !== undefined
    ? Number(req.body.sortOrder)
    : max + 1;
  const r = wrapUnique(() =>
    db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder)
  );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.put('/categories/:id', (req, res) => {
  const name = str(req.body.name, 60);
  if (!name) throw new HttpError(400, 'Category name is required.');
  const sortOrder = Number(req.body.sortOrder);
  const r = wrapUnique(() =>
    db
      .prepare('UPDATE categories SET name = ?, sort_order = ? WHERE id = ?')
      .run(name, Number.isFinite(sortOrder) ? sortOrder : 0, Number(req.params.id))
  );
  if (!r.changes) throw new HttpError(404, 'Category not found.');
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  const count = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id).n;
  if (count > 0) {
    throw new HttpError(409, 'This category still has products. Move or delete them first.');
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- products ----------
router.get('/products', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order, c.name, p.sort_order, p.code`
    )
    .all();
  res.json(rows.map(mapProduct));
});

router.post('/products', (req, res) => {
  const p = parseProduct(req.body, { generate: true });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM products').get().m;
  const r = wrapUnique(() =>
    db
      .prepare(
        `INSERT INTO products (code, brand, name, category_id, price, unit, video_url, image_url, active, out_of_stock, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(p.code, p.brand, p.name, p.categoryId, p.price, p.unit, p.videoUrl, p.imageUrl, p.active, p.outOfStock, max + 1)
  );
  res.status(201).json({ id: Number(r.lastInsertRowid), code: p.code });
});

// ---- bulk upload (CSV) ----
const BULK_MAX_ROWS = 5000;
const BULK_DEFAULT_CATEGORY = 'Misc';
// Accepted header names (compared lower-case, ignoring spaces, "_" and "-").
const BULK_HEADERS = {
  code: ['code', 'itemcode', 'productcode'],
  name: ['name', 'itemname', 'productname'],
  category: ['category', 'categoryname'],
  price: ['price', 'rate', 'mrp'],
  brand: ['brand'],
  unit: ['unit', 'per'],
  videoUrl: ['videourl', 'video'],
  imageUrl: ['imageurl', 'image'],
  outOfStock: ['outofstock', 'oos'],
};

/**
 * Validates every row of an uploaded CSV and, only if all rows are valid, inserts them in one transaction.
 * Rules: item code required and unique (in the file and in the catalogue), price >= 0,
 * blank category -> "Misc", every product is shown in the catalogue.
 */
router.post('/products/bulk', (req, res) => {
  const rows = (() => {
    try {
      return parseCsv(req.body?.csv);
    } catch (e) {
      if (e.csv) throw new HttpError(400, e.message);
      throw e;
    }
  })();
  if (rows.length === 0) throw new HttpError(400, 'The CSV file is empty.');

  // Map header names to column positions.
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const header = rows[0].cells.map(norm);
  const col = {};
  for (const [field, aliases] of Object.entries(BULK_HEADERS)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) col[field] = i;
  }
  const missing = ['code', 'name', 'price'].filter((f) => col[f] === undefined);
  if (missing.length) {
    throw new HttpError(
      400,
      `The first row must be a header with these columns: code, name, price (missing: ${missing.join(', ')}). Optional: category, brand, unit, video_url, image_url.`
    );
  }
  const data = rows.slice(1);
  if (data.length === 0) throw new HttpError(400, 'The CSV has a header but no products.');
  if (data.length > BULK_MAX_ROWS) {
    throw new HttpError(400, `Too many rows (${data.length}). Upload at most ${BULK_MAX_ROWS} products at a time.`);
  }

  const existingCodes = new Set(db.prepare('SELECT code FROM products').all().map((r) => r.code.toUpperCase()));
  const seen = new Map(); // code -> line of first occurrence
  const errors = [];
  const items = [];

  for (const { line, cells } of data) {
    const get = (f) => (col[f] === undefined ? '' : String(cells[col[f]] ?? '').trim());
    const problems = [];

    const code = get('code').toUpperCase();
    if (!code) problems.push('Item code is required.');
    else if (code.length > 30) problems.push('Item code is longer than 30 characters.');
    else if (seen.has(code)) problems.push(`Item code "${code}" is repeated (first used on line ${seen.get(code)}).`);
    else if (existingCodes.has(code)) problems.push(`Item code "${code}" already exists in the catalogue.`);

    const name = get('name');
    if (!name) problems.push('Item name is required.');
    else if (name.length > 120) problems.push('Item name is longer than 120 characters.');

    const priceText = get('price').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
    const price = priceText === '' ? NaN : Number(priceText);
    if (priceText === '') problems.push('Price is required.');
    else if (!Number.isFinite(price)) problems.push(`Price "${get('price')}" is not a number.`);
    else if (price < 0) problems.push('Price cannot be less than 0.');

    const videoUrl = get('videoUrl').slice(0, 500);
    const imageUrl = get('imageUrl').slice(0, 500);
    if (!validUrl(videoUrl)) problems.push('Video URL must start with http:// or https://');
    if (!validImageUrl(imageUrl)) problems.push('Image URL must start with http:// or https://');

    if (code && !seen.has(code)) seen.set(code, line);
    if (problems.length) {
      for (const message of problems) errors.push({ line, code, message });
      continue;
    }
    items.push({
      code,
      name,
      category: get('category').slice(0, 60) || BULK_DEFAULT_CATEGORY,
      price: Math.round(price * 100) / 100,
      brand: get('brand').slice(0, 60),
      unit: get('unit').slice(0, 20) || 'box',
      videoUrl: videoUrl || null,
      imageUrl: imageUrl || null,
      outOfStock: truthy(get('outOfStock')) ? 1 : 0,
    });
  }

  if (errors.length) {
    const rowsWithErrors = new Set(errors.map((e) => e.line)).size;
    return res.status(422).json({
      error: `Nothing was uploaded. ${rowsWithErrors} row${rowsWithErrors === 1 ? ' has' : 's have'} problems. Fix the file and upload it again.`,
      details: errors.slice(0, 200),
      totalProblems: errors.length,
    });
  }

  const created = [];
  const insertAll = db.transaction(() => {
    const cats = new Map(db.prepare('SELECT id, name FROM categories').all().map((c) => [c.name.toLowerCase(), c.id]));
    let catOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get().m;
    let prodOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM products').get().m;
    const addCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    const addProd = db.prepare(
      `INSERT INTO products (code, brand, name, category_id, price, unit, video_url, image_url, active, out_of_stock, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    );
    for (const it of items) {
      let catId = cats.get(it.category.toLowerCase());
      if (catId === undefined) {
        catId = Number(addCat.run(it.category, ++catOrder).lastInsertRowid);
        cats.set(it.category.toLowerCase(), catId);
        created.push(it.category);
      }
      addProd.run(it.code, it.brand, it.name, catId, it.price, it.unit, it.videoUrl, it.imageUrl, it.outOfStock, ++prodOrder);
    }
  });
  wrapUnique(insertAll);
  res.status(201).json({ created: items.length, categoriesCreated: created });
});

// ---- bulk actions on selected products: show / hide / delete ----
router.post('/products/bulk-action', (req, res) => {
  const action = String(req.body?.action ?? '');
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number))];
  if (!['show', 'hide', 'delete', 'outofstock', 'instock'].includes(action)) {
    throw new HttpError(400, 'Unknown action.');
  }
  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new HttpError(400, 'Select at least one product.');
  }
  if (ids.length > BULK_MAX_ROWS) throw new HttpError(400, `Select at most ${BULK_MAX_ROWS} products at a time.`);

  const stmt =
    action === 'delete'
      ? db.prepare('DELETE FROM products WHERE id = ?')
      : action === 'outofstock' || action === 'instock'
        ? db.prepare('UPDATE products SET out_of_stock = ? WHERE id = ?')
        : db.prepare('UPDATE products SET active = ? WHERE id = ?');
  const flag = action === 'show' || action === 'outofstock' ? 1 : 0;
  const run = db.transaction(() => {
    let changed = 0;
    for (const id of ids) {
      changed += (action === 'delete' ? stmt.run(id) : stmt.run(flag, id)).changes;
    }
    return changed;
  });
  res.json({ ok: true, changed: run() });
});

router.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = parseProduct(req.body);
  const r = wrapUnique(() =>
    db
      .prepare(
        `UPDATE products SET code = ?, brand = ?, name = ?, category_id = ?, price = ?, unit = ?,
                video_url = ?, image_url = ?, active = ?, out_of_stock = ? WHERE id = ?`
      )
      .run(p.code, p.brand, p.name, p.categoryId, p.price, p.unit, p.videoUrl, p.imageUrl, p.active, p.outOfStock, id)
  );
  if (!r.changes) throw new HttpError(404, 'Product not found.');
  res.json({ ok: true });
});

router.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- orders ----------
router.get('/orders', (req, res) => {
  const token = String(req.query.token ?? '').trim();
  if (token) {
    if (!/^\d{4}$/.test(token)) throw new HttpError(400, 'Token must be 4 digits.');
    return res.json({ orders: findOrdersByToken(token) });
  }
  res.json({ orders: listOrders({ q: req.query.q, store: req.query.store, limit: req.query.limit }) });
});

router.get('/orders/:id', (req, res) => {
  const order = getOrderById(Number(req.params.id));
  if (!order) throw new HttpError(404, 'Order not found.');
  res.json({ order });
});

router.patch('/orders/:id/status', (req, res) => {
  const order = updateOrderStatus(Number(req.params.id), req.body?.status);
  res.json({ order });
});

router.get('/stats', (_req, res) => {
  res.json(getVisitStats());
});

export default router;
