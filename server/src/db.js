import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

const dbPath = path.resolve(serverRoot, process.env.DB_PATH || './data/catalogue.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

/** Uploaded logos / product pictures live next to the database so they sit on the same persistent disk. */
export const uploadsDir = path.join(path.dirname(dbPath), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS shop (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    maps_url TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    price REAL NOT NULL CHECK (price >= 0),
    unit TEXT NOT NULL DEFAULT 'box',
    video_url TEXT,
    image_url TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- token is NOT unique at the DB level: tokens older than TOKEN_REUSE_DAYS are recycled.
  -- Uniqueness among recent orders is enforced when the token is generated.
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category_name TEXT NOT NULL,
    category_order INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    unit_price REAL NOT NULL,
    qty INTEGER NOT NULL,
    line_total REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

// ---- lightweight migrations for existing databases ----
// brand : optional manufacturer/brand name (used when generating a product code).
const productCols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
if (!productCols.includes('brand')) {
  db.exec("ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT ''");
}
// out_of_stock : 1 = shown to customers as "Out of Stock" and cannot be ordered.
if (!productCols.includes('out_of_stock')) {
  db.exec('ALTER TABLE products ADD COLUMN out_of_stock INTEGER NOT NULL DEFAULT 0');
}
// The QR "box code" feature was removed: drop its index and column from existing databases.
db.exec('DROP INDEX IF EXISTS idx_products_box_code');
if (productCols.includes('box_code')) {
  db.exec('ALTER TABLE products DROP COLUMN box_code');
}

const shopCols = db.prepare('PRAGMA table_info(shop)').all().map((c) => c.name);
if (!shopCols.includes('maps_url')) {
  db.exec("ALTER TABLE shop ADD COLUMN maps_url TEXT NOT NULL DEFAULT ''");
}

function seed() {
  const hasShop = db.prepare('SELECT 1 FROM shop WHERE id = 1').get();
  if (!hasShop) {
    db.prepare(
      'INSERT INTO shop (id, name, phone, whatsapp, address) VALUES (1, ?, ?, ?, ?)'
    ).run(
      'Sri Lakshmi Crackers',
      '9876543210',
      '919876543210',
      '12, Main Road, Sivakasi - 626123'
    );
  }

  const hasCategories = db.prepare('SELECT 1 FROM categories LIMIT 1').get();
  if (hasCategories) return;

  const categories = [
    'Sparklers',
    'Flower Pots',
    'Ground Chakkars',
    'Rockets',
    'Sound Crackers',
    'Gift Boxes',
  ];
  const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  const catId = {};
  categories.forEach((name, i) => {
    catId[name] = insertCategory.run(name, i + 1).lastInsertRowid;
  });

  const demoVideo = 'https://www.w3schools.com/html/mov_bbb.mp4'; // replace with real product videos from admin
  const products = [
    ['SP001', 'Sparklers 7cm (10 pcs)', 'Sparklers', 30, 'box'],
    ['SP002', 'Sparklers 10cm (10 pcs)', 'Sparklers', 55, 'box'],
    ['SP003', 'Colour Sparklers 15cm (10 pcs)', 'Sparklers', 90, 'box', demoVideo],
    ['FP001', 'Flower Pots Small (10 pcs)', 'Flower Pots', 120, 'box'],
    ['FP002', 'Flower Pots Big (10 pcs)', 'Flower Pots', 220, 'box', demoVideo],
    ['FP003', 'Flower Pots Deluxe (5 pcs)', 'Flower Pots', 300, 'box'],
    ['GC001', 'Ground Chakkar Small (10 pcs)', 'Ground Chakkars', 70, 'box'],
    ['GC002', 'Ground Chakkar Big (10 pcs)', 'Ground Chakkars', 140, 'box'],
    ['RK001', 'Rocket Bomb (10 pcs)', 'Rockets', 160, 'box'],
    ['RK002', 'Two Sound Rocket (5 pcs)', 'Rockets', 190, 'box', demoVideo],
    ['SC001', 'Red Bijili (100 pcs)', 'Sound Crackers', 45, 'packet'],
    ['SC002', 'Lakshmi Crackers (10 pcs)', 'Sound Crackers', 60, 'packet'],
    ['SC003', 'Atom Bomb (10 pcs)', 'Sound Crackers', 110, 'packet'],
    ['GB001', 'Family Gift Box (25 items)', 'Gift Boxes', 750, 'box'],
    ['GB002', 'Premium Gift Box (40 items)', 'Gift Boxes', 1250, 'box', demoVideo],
  ];
  const insertProduct = db.prepare(
    `INSERT INTO products (code, name, category_id, price, unit, video_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  products.forEach(([code, name, cat, price, unit, video], i) => {
    insertProduct.run(code, name, catId[cat], price, unit, video || null, i + 1);
  });
}

seed();

export default db;
