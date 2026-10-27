import { useCallback, useEffect, useState } from 'react';
import { ApiError, adminApi } from '../api';
import type { Order, OrderSummary, Shop } from '../types';
import { categoryIcon, formatDateTime, rupee } from '../utils';
import { DownloadIcon, HashIcon, WhatsAppIcon } from '../components/Icons';

interface Props {
  shop: Shop | null;
  onError: (e: unknown) => boolean;
}

export default function OrdersTab({ shop, onError }: Props) {
  const [token, setToken] = useState('');
  const [found, setFound] = useState<Order[] | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<OrderSummary[]>([]);
  const [listError, setListError] = useState('');

  const loadRecent = useCallback(
    (query: string) => {
      adminApi
        .orders(query)
        .then((r) => {
          setRecent(r.orders);
          setListError('');
        })
        .catch((e) => {
          if (!onError(e)) setListError(e instanceof Error ? e.message : 'Could not load orders.');
        });
    },
    [onError]
  );

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => loadRecent(q), 250);
    return () => clearTimeout(t);
  }, [q, loadRecent]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError('');
    setFound(null);
    if (!/^\d{4}$/.test(token)) {
      setLookupError('Enter the 4-digit token.');
      return;
    }
    setBusy(true);
    try {
      const { orders } = await adminApi.ordersByToken(token);
      if (orders.length === 0) setLookupError(`No order found for token ${token}.`);
      setFound(orders);
    } catch (err) {
      if (!onError(err)) setLookupError(err instanceof ApiError ? err.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openOrder(id: number) {
    try {
      const { order } = await adminApi.order(id);
      setFound([order]);
      setToken(order.token);
      setLookupError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (!onError(err)) setListError(err instanceof Error ? err.message : 'Could not open order.');
    }
  }

  return (
    <div>
      <section className="panel">
        <h2>Find an order by token</h2>
        <form className="token-search" onSubmit={lookup}>
          <input
            className="token-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="0000"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-label="4-digit token"
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || token.length !== 4}>
            {busy ? (
              'Searching…'
            ) : (
              <>
                <HashIcon width={18} height={18} />
                Find order
              </>
            )}
          </button>
        </form>
        {lookupError && <div className="alert alert-error">{lookupError}</div>}
        {found && found.length > 1 && (
          <div className="alert alert-info">
            {found.length} orders share token {token} (it was reused). Newest is shown first – check name and date.
          </div>
        )}
        {found?.map((o) => (
          <OrderDetail key={o.id} order={o} shop={shop} />
        ))}
      </section>

      <section className="panel">
        <h2>Recent orders</h2>
        <input
          className="admin-search"
          type="search"
          placeholder="Search name, phone or token"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {listError && <div className="alert alert-error">{listError}</div>}
        {recent.length === 0 && !listError && <p className="muted">No orders yet.</p>}
        <ul className="order-list">
          {recent.map((o) => (
            <li key={o.id}>
              <button type="button" className="order-row" onClick={() => openOrder(o.id)}>
                <span className="order-token">{o.token}</span>
                <span className="order-who">
                  <strong>{o.customerName}</strong>
                  <small>
                    {o.customerPhone} · {formatDateTime(o.createdAt)}
                  </small>
                </span>
                <span className="order-amt">
                  {rupee(o.total)}
                  <small>{o.itemCount} items</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OrderDetail({ order, shop }: { order: Order; shop: Shop | null }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const groups: { category: string; items: Order['items'] }[] = [];
  for (const it of order.items) {
    let g = groups.find((x) => x.category === it.category);
    if (!g) groups.push((g = { category: it.category, items: [] }));
    g.items.push(it);
  }

  async function makePdf() {
    if (!shop) throw new Error('Shop details not loaded');
    const lib = await import('../pdf'); // loaded on demand to keep the page light
    await new Promise((resolve) => setTimeout(resolve, 60)); // let the loader paint first
    return { lib, pdf: lib.buildOrderPdf(shop, order) };
  }

  /** Runs a PDF action with a loader and a readable error message. */
  async function withPdf(action: (lib: typeof import('../pdf'), pdf: import('../pdf').PdfResult) => Promise<void> | void) {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const { lib, pdf } = await makePdf();
      await action(lib, pdf);
    } catch (e) {
      console.error(e);
      setNote('We could not create the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="order-detail">
      <div className="order-detail-head">
        <div className="order-token big">{order.token}</div>
        <div>
          <strong>{order.customerName}</strong>
          <div className="muted">
            <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a> · {formatDateTime(order.createdAt)}
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.category} className="group">
          <h3 className="group-head">
            <span className="group-icon" aria-hidden>
              {categoryIcon(g.category)}
            </span>
            <span className="group-name">{g.category}</span>
            <span className="group-sub">{rupee(g.items.reduce((s, i) => s + i.lineTotal, 0))}</span>
          </h3>
          <div className="table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((i) => (
                <tr key={i.code}>
                  <td>{i.code}</td>
                  <td>{i.name}</td>
                  <td className="num">{i.qty}</td>
                  <td className="num">{rupee(i.price)}</td>
                  <td className="num">{rupee(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      <div className="total-row">
        <span>Estimated total</span>
        <strong>{rupee(order.total)}</strong>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!shop || busy}
          aria-busy={busy}
          onClick={() => withPdf((lib, pdf) => lib.downloadPdf(pdf))}
        >
          {busy ? <span className="btn-spinner" aria-hidden /> : <DownloadIcon width={18} height={18} />}
          {busy ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button
          type="button"
          className="btn btn-whatsapp"
          disabled={!shop || busy}
          onClick={() =>
            withPdf(async (lib, pdf) => {
              if (!shop) return;
              const outcome = await lib.sharePdf(pdf, shop, order);
              setNote(outcome === 'downloaded' ? 'PDF downloaded. Attach it in WhatsApp.' : '');
            })
          }
        >
          <WhatsAppIcon width={18} height={18} />
          Share on WhatsApp
        </button>
        <a
          className="btn btn-outline"
          href={`https://wa.me/91${order.customerPhone}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Chat with customer
        </a>
      </div>
      {note && <div className="alert alert-info">{note}</div>}
    </article>
  );
}
