import { useState } from 'react';
import { adminApi } from '../api';
import type { Shop } from '../types';
import ImageField from './ImageField';

interface Props {
  shop: Shop;
  onSaved: () => void;
  onError: (e: unknown) => boolean;
}

export default function ShopTab({ shop, onSaved, onError }: Props) {
  const [f, setF] = useState<Shop>(shop);
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
        <ImageField label="Logo (optional)" value={f.logoUrl} onChange={(url) => set('logoUrl', url)} onError={onError} />
        {error && <div className="alert alert-error">{error}</div>}
        {saved && <div className="alert alert-success">Saved.</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  );
}
