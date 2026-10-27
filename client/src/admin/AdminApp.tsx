import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, adminAuth, adminLogin, getCatalogue } from '../api';
import type { Shop } from '../types';
import OrdersTab from './OrdersTab';
import ProductsTab from './ProductsTab';
import CategoriesTab from './CategoriesTab';
import ShopTab from './ShopTab';

type Tab = 'orders' | 'products' | 'categories' | 'shop';

const TABS: { id: Tab; label: string }[] = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'shop', label: 'Shop details' },
];

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(!!adminAuth.get());

  useEffect(() => {
    document.title = 'Admin – Cracker Catalogue';
  }, []);

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;
  return (
    <Dashboard
      onLogout={() => {
        adminAuth.clear();
        setLoggedIn(false);
      }}
    />
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await adminLogin(password);
      adminAuth.set(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark" aria-hidden>
          🎆
        </div>
        <h1>Shop admin</h1>
        <p className="muted">Enter the admin password to manage products and find orders.</p>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
        <Link className="link-btn center" to="/">
          Back to catalogue
        </Link>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [shop, setShop] = useState<Shop | null>(null);

  const loadShop = useCallback(() => {
    getCatalogue()
      .then((c) => setShop(c.shop))
      .catch(() => undefined);
  }, []);
  useEffect(loadShop, [loadShop]);

  /** Child tabs call this with any error; returns true if it was a session problem. */
  const onError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return true;
      }
      return false;
    },
    [onLogout]
  );

  return (
    <div className="admin">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow">Admin portal</span>
          <h1>{shop?.name ?? 'Shop'}</h1>
        </div>
        <div className="admin-header-actions">
          <Link className="btn btn-light btn-sm" to="/">
            View catalogue
          </Link>
          <button type="button" className="btn btn-light btn-sm" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {tab === 'orders' && <OrdersTab shop={shop} onError={onError} />}
        {tab === 'products' && <ProductsTab onError={onError} />}
        {tab === 'categories' && <CategoriesTab onError={onError} />}
        {tab === 'shop' && shop && <ShopTab shop={shop} onSaved={loadShop} onError={onError} />}
      </main>
    </div>
  );
}
