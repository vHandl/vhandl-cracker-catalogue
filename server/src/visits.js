import db from './db.js';
import { HttpError } from './orders.js';

/** Same visitor opening the page again within this window is not a new open. */
const DEDUP_MINUTES = 30;

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** India Standard Time (UTC+5:30) — "today" for this shop. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function startOfIstDayIso() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const midnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  return new Date(midnightUtcMs).toISOString();
}

export function recordVisit(visitorId) {
  const id = String(visitorId ?? '').trim();
  if (!VISITOR_ID.test(id)) throw new HttpError(400, 'Invalid visitor.');

  const since = new Date(Date.now() - DEDUP_MINUTES * 60 * 1000).toISOString();
  const recent = db
    .prepare('SELECT 1 FROM catalogue_visits WHERE visitor_id = ? AND created_at >= ? LIMIT 1')
    .get(id, since);
  if (recent) return { recorded: false };

  db.prepare('INSERT INTO catalogue_visits (visitor_id) VALUES (?)').run(id);
  return { recorded: true };
}

export function getVisitStats() {
  const todayFrom = startOfIstDayIso();
  const weekFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS totalOpens,
         COUNT(DISTINCT visitor_id) AS uniqueVisitors,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS todayOpens,
         COUNT(DISTINCT CASE WHEN created_at >= ? THEN visitor_id END) AS todayUnique,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS weekOpens,
         COUNT(DISTINCT CASE WHEN created_at >= ? THEN visitor_id END) AS weekUnique
       FROM catalogue_visits`
    )
    .get(todayFrom, todayFrom, weekFrom, weekFrom);

  return {
    uniqueVisitors: Number(row.uniqueVisitors) || 0,
    totalOpens: Number(row.totalOpens) || 0,
    today: {
      uniqueVisitors: Number(row.todayUnique) || 0,
      opens: Number(row.todayOpens) || 0,
    },
    week: {
      uniqueVisitors: Number(row.weekUnique) || 0,
      opens: Number(row.weekOpens) || 0,
    },
  };
}
