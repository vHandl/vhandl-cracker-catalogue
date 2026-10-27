import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import QtyStepper from '../components/QtyStepper';
import { ApiError, submitOrder } from '../api';
import type { Order, Shop } from '../types';
import { categoryIcon, cleanPhone, rupee, shopMapsHref } from '../utils';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SendIcon, WhatsAppIcon } from '../components/Icons';
import PdfDownloadButton from './PdfDownloadButton';
import type { SelectedGroup } from './useSelection';

interface Props {
  shop: Shop;
  groups: SelectedGroup[];
  total: number;
  itemCount: number;
  setQty: (id: number, qty: number) => void;
  clearSelection: () => void;
  /** Called once the shop has accepted the order (used to remember it on this device). */
  onOrderPlaced: (order: Order) => void;
  onClose: () => void;
}

type Step = 'review' | 'details' | 'done';

const CONFETTI = ['#ffc83d', '#ff5c8a', '#ff8a1f', '#7c5cff', '#12b76a', '#ffffff'].flatMap((c, i) => [
  { c, x: `${8 + i * 15}%`, d: `${(i * 0.37) % 2}s` },
  { c, x: `${14 + i * 15}%`, d: `${(i * 0.53 + 0.9) % 2.4}s` },
]);

const PROFILE_KEY = 'cc_customer_v1';

function loadProfile(): { name: string; phone: string } {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return { name: String(p.name || ''), phone: String(p.phone || '') };
  } catch {
    return { name: '', phone: '' };
  }
}

export default function OrderSheet({
  shop,
  groups,
  total,
  itemCount,
  setQty,
  clearSelection,
  onOrderPlaced,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('review');
  const [order, setOrder] = useState<Order | null>(null);

  if (step === 'done' && order) {
    return <DoneStep shop={shop} order={order} onClose={onClose} />;
  }

  if (step === 'details') {
    return (
      <DetailsStep
        total={total}
        itemCount={itemCount}
        groups={groups}
        onBack={() => setStep('review')}
        onClose={onClose}
        onSubmitted={(o) => {
          setOrder(o);
          onOrderPlaced(o);
          clearSelection();
          setStep('done');
        }}
      />
    );
  }

  return (
    <Modal
      title="My selected items"
      onClose={onClose}
      footer={
        itemCount > 0 && (
          <>
            <div className="total-row">
              <span>Estimated total</span>
              <strong>{rupee(total)}</strong>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('details')}>
              Continue
              <ArrowRightIcon width={18} height={18} />
            </button>
          </>
        )
      }
    >
      {itemCount === 0 ? (
        <div className="empty">
          <p>You have not selected any items yet.</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Browse items
          </button>
        </div>
      ) : (
        <GroupedList groups={groups} setQty={setQty} editable />
      )}
    </Modal>
  );
}

function GroupedList({
  groups,
  setQty,
  editable,
}: {
  groups: SelectedGroup[];
  setQty?: (id: number, qty: number) => void;
  editable?: boolean;
}) {
  return (
    <div className="grouped">
      {groups.map((g) => (
        <section key={g.category.id} className="group">
          <h3 className="group-head">
            <span className="group-icon" aria-hidden>
              {categoryIcon(g.category.name)}
            </span>
            <span className="group-name">{g.category.name}</span>
            <span className="group-sub">{rupee(g.subtotal)}</span>
          </h3>
          <ul className="lines">
            {g.lines.map(({ product, qty, lineTotal }) => (
              <li key={product.id} className="line">
                <div className="line-info">
                  <span className="card-code">{product.code}</span>
                  <span className="line-name">{product.name}</span>
                  <span className="line-rate">
                    {rupee(product.price)} / {product.unit}
                    {!editable && ` × ${qty}`}
                  </span>
                </div>
                <div className="line-right">
                  {editable && setQty ? (
                    <>
                      <QtyStepper value={qty} onChange={(n) => setQty(product.id, n)} label={`Quantity of ${product.name}`} />
                      <button type="button" className="link-btn danger" onClick={() => setQty(product.id, 0)}>
                        Remove
                      </button>
                    </>
                  ) : null}
                  <strong className="line-total">{rupee(lineTotal)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DetailsStep({
  groups,
  total,
  itemCount,
  onBack,
  onClose,
  onSubmitted,
}: {
  groups: SelectedGroup[];
  total: number;
  itemCount: number;
  onBack: () => void;
  onClose: () => void;
  onSubmitted: (o: Order) => void;
}) {
  const initial = useMemo(loadProfile, []);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length >= 2;
  const phoneOk = cleanPhone(phone).length === 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!nameOk || !phoneOk || busy) return;
    setBusy(true);
    try {
      const { order } = await submitOrder({
        customerName: name.trim(),
        customerPhone: cleanPhone(phone),
        items: groups.flatMap((g) => g.lines.map((l) => ({ productId: l.product.id, qty: l.qty }))),
      });
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: name.trim(), phone: cleanPhone(phone) }));
      } catch {
        /* ignore */
      }
      onSubmitted(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Your details"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <div className="total-row">
            <span>
              {itemCount} item{itemCount === 1 ? '' : 's'} · Estimated total
            </span>
            <strong>{rupee(total)}</strong>
          </div>
          <button type="submit" form="details-form" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? (
              'Submitting…'
            ) : (
              <>
                <SendIcon width={18} height={18} />
                Submit &amp; get my token
              </>
            )}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onBack} disabled={busy}>
            <ArrowLeftIcon width={18} height={18} />
            Back to my items
          </button>
        </>
      }
    >
      <form id="details-form" onSubmit={submit} noValidate>
        <p className="muted">
          The shop will use these to find your list. You will get a <strong>4-digit token</strong> and a PDF you can
          share on WhatsApp.
        </p>

        <label className="field">
          <span>Your name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Ravi Kumar"
            aria-invalid={touched && !nameOk}
          />
          {touched && !nameOk && <em className="field-error">Please enter your name.</em>}
        </label>

        <label className="field">
          <span>Contact number</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={16}
            placeholder="10-digit mobile number"
            aria-invalid={touched && !phoneOk}
          />
          {touched && !phoneOk && <em className="field-error">Please enter a valid 10-digit number.</em>}
        </label>

        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </Modal>
  );
}

function DoneStep({ shop, order, onClose }: { shop: Shop; order: Order; onClose: () => void }) {
  const mapsUrl = shopMapsHref(shop);

  return (
    <Modal
      title="Order submitted"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Done – start a new list
        </button>
      }
    >
      <div className="celebrate">
        <div className="confetti" aria-hidden>
          {CONFETTI.map((c, i) => (
            <i key={i} style={{ '--x': c.x, '--d': c.d, '--c': c.c } as React.CSSProperties} />
          ))}
        </div>
        <div className="check-badge">
          <CheckIcon width={28} height={28} />
        </div>
        <h3>Thank you, {order.customerName.split(' ')[0]}!</h3>
        <p>Your list has been saved with the shop.</p>
        <p className="token-label">Your order token</p>
        <div className="token-digits" aria-label={`Token ${order.token.split('').join(' ')}`}>
          {order.token.split('').map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <p className="token-hint">Keep this number. Show it at the shop if you lose the PDF.</p>
      </div>

      <div className="summary-mini">
        <div>
          <span className="muted">Name</span>
          <strong>{order.customerName}</strong>
        </div>
        <div>
          <span className="muted">Contact</span>
          <strong>{order.customerPhone}</strong>
        </div>
        <div>
          <span className="muted">Estimated total</span>
          <strong>{rupee(order.total)}</strong>
        </div>
      </div>

      <div className="stack">
        <PdfDownloadButton shop={shop} order={order} className="btn-block" />
        <div className="alert alert-info prepack-note">
          <WhatsAppIcon width={20} height={20} />
          <span>
            Before you reach the{' '}
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                shop
              </a>
            ) : (
              'shop'
            )}
            , share this list through WhatsApp to confirm and prepack your order.
          </span>
        </div>
      </div>

      <details className="done-items">
        <summary>View my list</summary>
        <GroupedList
          groups={groupOrder(order)}
        />
      </details>
    </Modal>
  );
}

/** Adapt a saved order into the SelectedGroup shape for read-only display. */
function groupOrder(order: Order): SelectedGroup[] {
  const map = new Map<string, SelectedGroup>();
  let catId = 0;
  for (const it of order.items) {
    let g = map.get(it.category);
    if (!g) {
      g = { category: { id: ++catId, name: it.category, products: [] }, lines: [], subtotal: 0 };
      map.set(it.category, g);
    }
    g.lines.push({
      product: {
        id: g.lines.length + catId * 1000,
        code: it.code,
        name: it.name,
        categoryId: g.category.id,
        price: it.price,
        unit: it.unit,
        videoUrl: null,
        imageUrl: null,
        outOfStock: false,
      },
      qty: it.qty,
      lineTotal: it.lineTotal,
    });
    g.subtotal += it.lineTotal;
  }
  return [...map.values()];
}
