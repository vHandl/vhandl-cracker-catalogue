import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.ADMIN_PASSWORD) {
  console.warn('[warn] ADMIN_PASSWORD not set - using default "admin123". Set it in server/.env!');
}
if (!process.env.JWT_SECRET) {
  console.warn('[warn] JWT_SECRET not set - using a random one (admin sessions reset on restart).');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function login(password) {
  if (!safeEqual(password ?? '', ADMIN_PASSWORD)) return null;
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}
