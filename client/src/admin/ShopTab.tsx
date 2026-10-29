import { useState } from 'react';
import { adminApi } from '../api';
import type { Shop } from '../types';
import ImageField from './ImageField';
import VisitStats from './VisitStats';

interface Props {
  shop: Shop;
  onSaved: () => void;
  onError: (e: unknown) => boolean;
}

export default function ShopTab({ shop, onSaved, onError }: Props) {
  const [f, setF] = useState<Shop>({
    ...shop,
    locationName: shop.locationName ?? '',
    address2: shop.address2 ?? '',
    mapsUrl2: shop.mapsUrl2 ?? '',
    locationName2: shop.locationName2 ?? '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Shop, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setSaved(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.saveShop(f);
      setSaved(true);
      onSaved();
    } catch (err) {
      if (!onError(err)) setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <VisitStats onError={onError} />
      <section className="panel">
        <h2>Shop details</h2>
        <p className="muted">Shown at the top of the catalogue and on every PDF.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Shop name</span>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Phone number</span>
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} inputMode="tel" />
            </label>
            <label className="field">
              <span>WhatsApp number (with country code)</span>
              <input
                value={f.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                maxLength={30}
                inputMode="numeric"
                placeholder="919876543210"
              />
            </label>
          </div>
          <div className="store-block">
            <h3>First store</h3>
            <p className="muted">Shown at the top of the catalogue. Customers can pick this as a pickup location.</p>
            <label className="field">
              <span>Location name (optional)</span>
              <input
                value={f.locationName ?? ''}
                onChange={(e) => set('locationName', e.target.value)}
                maxLength={80}
                placeholder="e.g. Sivakasi"
              />
            </label>
            <label className="field">
              <span>Address</span>
              <textarea value={f.address} onChange={(e) => set('address', e.target.value)} rows={2} maxLength={300} />
            </label>
            <label className="field">
              <span>Google Maps link</span>
              <input
                value={f.mapsUrl ?? ''}
                onChange={(e) => set('mapsUrl', e.target.value)}
                maxLength={1000}
                inputMode="url"
                placeholder="https://maps.app.goo.gl/..."
              />
            </label>
            <p className="muted">Paste a Google Maps share link. A map button appears in front of the address in the catalogue.</p>
          </div>

          <div className="store-block">
            <h3>Second store (optional)</h3>
            <p className="muted">
              Once an address or Maps link is saved, this location appears below the first one and customers choose a
              pickup store when they submit an order.
            </p>
            <label className="field">
              <span>Location name (optional)</span>
              <input
                value={f.locationName2 ?? ''}
                onChange={(e) => set('locationName2', e.target.value)}
                maxLength={80}
                placeholder="e.g. Chennai"
              />
            </label>
            <label className="field">
              <span>Address</span>
              <textarea
                value={f.address2 ?? ''}
                onChange={(e) => set('address2', e.target.value)}
                rows={2}
                maxLength={300}
              />
            </label>
            <label className="field">
              <span>Google Maps link</span>
              <input
                value={f.mapsUrl2 ?? ''}
                onChange={(e) => set('mapsUrl2', e.target.value)}
                maxLength={1000}
                inputMode="url"
                placeholder="https://maps.app.goo.gl/..."
              />
            </label>
          </div>

          <ImageField label="Logo (optional)" value={f.logoUrl} onChange={(url) => set('logoUrl', url)} onError={onError} />
          {error && <div className="alert alert-error">{error}</div>}
          {saved && <div className="alert alert-success">Saved.</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </form>
      </section>
    </>
  );
}
