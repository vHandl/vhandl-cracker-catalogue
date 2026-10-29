import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { VisitStats as VisitStatsData } from '../types';

interface Props {
  onError: (e: unknown) => boolean;
}

const n = (v: number) => v.toLocaleString('en-IN');

export default function VisitStats({ onError }: Props) {
  const [stats, setStats] = useState<VisitStatsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      adminApi
        .stats()
        .then((s) => {
          if (!cancelled) setStats(s);
        })
        .catch((e) => {
          if (!cancelled) onError(e);
        });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [onError]);

  if (!stats) return null;

  return (
    <section className="visit-stats" aria-label="Catalogue visitors">
      <div className="visit-stats-grid">
        <article className="stat-card stat-card-primary">
          <p className="stat-value">{n(stats.uniqueVisitors)}</p>
          <h2 className="stat-label">Unique visitors</h2>
          <p className="stat-hint">Phones or browsers that opened the catalogue</p>
        </article>
        <article className="stat-card">
          <p className="stat-value">{n(stats.today.uniqueVisitors)}</p>
          <h2 className="stat-label">Today</h2>
          <p className="stat-hint">
            {n(stats.today.opens)} open{stats.today.opens === 1 ? '' : 's'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-value">{n(stats.week.uniqueVisitors)}</p>
          <h2 className="stat-label">Last 7 days</h2>
          <p className="stat-hint">
            {n(stats.week.opens)} open{stats.week.opens === 1 ? '' : 's'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-value">{n(stats.totalOpens)}</p>
          <h2 className="stat-label">Total opens</h2>
          <p className="stat-hint">Including return visits</p>
        </article>
      </div>
      <p className="visit-stats-note muted">
        Each phone or browser is counted once as a unique visitor. Refreshing the page is not counted
        again for 30 minutes. Counts start from when this feature was added.
      </p>
    </section>
  );
}
