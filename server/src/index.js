import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { uploadsDir } from './db.js';
import adminRouter from './admin.js';
import { HttpError, createOrder } from './orders.js';
import { recordVisit } from './visits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
// CSV bulk uploads can be large; the parser below skips requests that were already parsed here.
app.use('/api/admin/products/bulk', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '100kb' }));

// ---------- public API ----------
app.get('/api/catalogue', (_req, res) => {
  const shop = db
    .prepare(
      'SELECT name, phone, whatsapp, address, logo_url AS logoUrl, maps_url AS mapsUrl FROM shop WHERE id = 1'
    )
    .get();
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name').all();
  const products = db
    .prepare(
      `SELECT id, code, brand, name, category_id AS categoryId, price, unit,
              video_url AS videoUrl, image_url AS imageUrl, out_of_stock AS outOfStock
       FROM products WHERE active = 1 ORDER BY price ASC, code`
    )
    .all()
    .map((p) => ({ ...p, outOfStock: !!p.outOfStock }));

  const result = categories
    .map((c) => ({ ...c, products: products.filter((p) => p.categoryId === c.id) }))
    .filter((c) => c.products.length > 0);
  res.set('Cache-Control', 'no-cache');
  res.json({ shop, categories: result });
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again in a few minutes.' },
});

app.post('/api/orders', orderLimiter, (req, res) => {
  const order = createOrder(req.body);
  res.status(201).json({ token: order.token, order });
});

const visitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

app.post('/api/visits', visitLimiter, (req, res) => {
  res.json(recordVisit(req.body?.visitorId));
});

// ---------- admin API ----------
app.use('/api/admin', adminRouter);

// Uploaded images. File names are random and never change, so they can be cached for a long time.
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  })
);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- static frontend (production) ----------
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ---------- error handler ----------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Cracker catalogue server running on http://localhost:${port}`);
});
