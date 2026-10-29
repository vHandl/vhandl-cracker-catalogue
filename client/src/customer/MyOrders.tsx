import { useState } from 'react';
import Modal from '../components/Modal';
import { CheckIcon, CopyIcon, ReceiptIcon } from '../components/Icons';
import type { Order, Shop } from '../types';
import { formatDateTime, pickupLabel, pickupMapsHref, rupee } from '../utils';
import PdfDownloadButton from './PdfDownloadButton';

interface Props {
  shop: Shop;
  orders: Order[];
  onClose: () => void;
}

/** Nothing ordered yet: a friendly placeholder instead of an empty list. */
function NoOrders({ onClose }: { onClose: () => void }) {
  return (
    <div className="no-orders">
      <svg className="no-orders-art" viewBox="0 0 160 140" role="img" aria-label="No orders placed">
        <ellipse cx="80" cy="128" rx="46" ry="7" fill="#ece6f7" />
        <rect x="38" y="14" width="84" height="108" rx="14" fill="#fff" stroke="#d9cff0" strokeWidth="3" />
        <rect x="52" y="34" width="40" height="8" rx="4" fill="#e4dcf5" />
        <rect x="52" y="54" width="56" height="7" rx="3.5" fill="#efe9fa" />
        <rect x="52" y="70" width="48" height="7" rx="3.5" fill="#efe9fa" />
        <rect x="52" y="86" width="32" height="7" rx="3.5" fill="#efe9fa" />
        <circle cx="116" cy="104" r="22" fill="#fff1f2" stroke="#fda4af" strokeWidth="3" />
        <path d="m108 96 16 16m0-16-16 16" stroke="#e11d48" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h3>No orders placed</h3>
      <p>Orders you place from this device will appear here, with your PIN to share with the shop.</p>
      <button type="button" className="btn btn-primary" onClick={onClose}>
        Browse items
      </button>
    </div>
  );
}

/** Copies text; falls back to a hidden textarea for browsers without the async clipboard API. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function groupItems(order: Order) {
  const groups: { category: string; items: Order['items'] }[] = [];
  for (const it of order.items) {
    let g = groups.find((x) => x.category === it.category);
    if (!g) groups.push((g = { category: it.category, items: [] }));
    g.items.push(it);
  }
  return groups;
}

function PickupLink({ shop, order }: { shop: Shop; order: Order }) {
  const mapsUrl = pickupMapsHref(order, shop);
  const label = pickupLabel(order);
  return (
    <p className="alert alert-info my-orders-pickup">
      Pick your order from this{' '}
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          location
        </a>
      ) : (
        'location'
      )}
      {label ? ` (${label})` : ''}
    </p>
  );
}

function OrderCard({ shop, order }: { shop: Shop; order: Order }) {
  const [copied, setCopied] = useState(false);
  const count = order.items.reduce((n, i) => n + i.qty, 0);

  async function copyPin() {
    if (await copyText(order.token)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <article className="my-order">
      <header className="my-order-head">
        <span className="muted">{formatDateTime(order.createdAt)}</span>
        <strong className="my-order-total">{rupee(order.total)}</strong>
      </header>

      <div className="my-order-pin">
        <div>
          <span className="my-order-pin-label">Order PIN</span>
          <div className="pin-digits" aria-label={`PIN ${order.token.split('').join(' ')}`}>
            {order.token.split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={copyPin}>
          {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
          {copied ? 'Copied' : 'Copy PIN'}
        </button>
      </div>
      <p className="my-order-hint">Show this PIN to the shop so they can find your order.</p>
      <PickupLink shop={shop} order={order} />

      <p className="my-order-meta">
        {order.items.length} item{order.items.length === 1 ? '' : 's'} · {count} piece{count === 1 ? '' : 's'} ·{' '}
        {order.customerName}
      </p>

      <details className="done-items">
        <summary>View items</summary>
        {groupItems(order).map((g) => (
          <div key={g.category} className="my-order-group">
            <h4>{g.category}</h4>
            <ul>
              {g.items.map((i) => (
                <li key={i.code}>
                  <span>
                    <span className="card-code">{i.code}</span> {i.name}
                  </span>
                  <span className="my-order-qty">
                    {i.qty} × {rupee(i.price)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>

      <div className="my-order-actions">
        <PdfDownloadButton shop={shop} order={order} label="Download order (PDF)" className="btn-block" />
      </div>
    </article>
  );
}

export default function MyOrders({ shop, orders, onClose }: Props) {
  return (
    <Modal title="My orders" onClose={onClose}>
      {orders.length === 0 ? (
        <NoOrders onClose={onClose} />
      ) : (
        <div className="my-orders">
          <p className="muted my-orders-note">
            <ReceiptIcon width={16} height={16} /> Orders placed from this device. Download the PDF or show the PIN to the shop
            so they can find your order.
          </p>
          {orders.map((o) => (
            <OrderCard key={o.id} shop={shop} order={o} />
          ))}
        </div>
      )}
    </Modal>
  );
}
