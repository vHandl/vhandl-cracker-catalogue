import { useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogue, pingVisit } from '../api';
import type { Catalogue, Product } from '../types';
import { BRAND_FILTERS, categoryIcon, matchesBrand, rupee, type BrandFilter } from '../utils';
import VideoModal from '../components/VideoModal';
import { useBackClose } from '../components/useBackClose';
import { ArrowRightIcon, BagIcon, CloseIcon, SearchIcon } from '../components/Icons';
import CatalogueGrid from './CatalogueGrid';
import ShopHeader from './ShopHeader';
import MyOrders from './MyOrders';
import OrderSheet from './OrderSheet';
import { useMyOrders } from './useMyOrders';
import { useSelection } from './useSelection';
export default function CustomerApp() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
  const [video, setVideo] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const { orders, addOrder } = useMyOrders();
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const chipsRef = useRef<HTMLElement | null>(null);
  const { selection, setQty, toggle, clear, groups, itemCount, total } = useSelection(catalogue);

  // Phone Back button closes pop-ups instead of leaving the page.
  useBackClose(sheetOpen, () => setSheetOpen(false));
  useBackClose(video !== null, () => setVideo(null));
  useBackClose(ordersOpen, () => setOrdersOpen(false));
  function load() {
    setError('');
    getCatalogue()
      .then((c) => {
        setCatalogue(c);
        document.title = `${c.shop.name} – Catalogue`;
        pingVisit();
      })
      .catch((e: Error) => setError(e.message));
  }
  useEffect(load, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.categories
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => {
          if (!matchesBrand(p.brand, brandFilter)) return false;
          if (!q) return true;
          return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
        }),
      }))
      .filter((c) => c.products.length > 0);
  }, [catalogue, q, brandFilter]);

  const brandLabel = BRAND_FILTERS.find((b) => b.id === brandFilter)?.label ?? 'All';
  const hasFilters = Boolean(q) || brandFilter !== 'all';
  function clearFilters() {
    setQuery('');
    setBrandFilter('all');
  }

  // Highlight the category chip for the section currently under the sticky bar.
  useEffect(() => {
    if (!catalogue) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      let current: number | null = null;
      for (const row of document.querySelectorAll<HTMLElement>('.ag-row[row-id^="cat-"]')) {
        if (row.getBoundingClientRect().top <= 260) current = Number(row.getAttribute('row-id')?.slice(4));
      }
      setActiveCat((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(update, 500);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [catalogue, visible]);

  // Keep the active chip visible inside the horizontally scrolling chip bar.
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector<HTMLElement>('.chip.active');
    if (!box || !chip) return;
    const left = chip.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollTo({ left: left - box.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [activeCat]);

  if (error) {
    return (
      <div className="center-screen">
        <h2>Could not load the catalogue</h2>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-primary" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!catalogue) {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
        <p className="muted">Loading catalogue…</p>
      </div>
    );
  }

  function jumpTo(id: number) {
    setQuery('');
    setActiveCat(id);
    // The grid renders asynchronously (and re-renders after the search is cleared), so poll briefly for the row.
    let tries = 0;
    const find = () => {
      const row = document.querySelector(`.ag-row[row-id="cat-${id}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (tries++ < 20) setTimeout(find, 50);
    };
    setTimeout(find, 50);
  }

  return (
    <div className="app">
      <ShopHeader shop={catalogue.shop} orderCount={orders.length} onOpenOrders={() => setOrdersOpen(true)} />

      <ol className="steps" aria-label="How to order">
        <li>
          <b>1</b>
          <span>Pick your items</span>
        </li>
        <li>
          <b>2</b>
          <span>Set quantity</span>
        </li>
        <li>
          <b>3</b>
          <span>Submit &amp; share</span>
        </li>
      </ol>

      <div className="toolbar">
        <div className="search">
          <SearchIcon className="search-icon" width={20} height={20} />
          <input
            type="search"
            placeholder="Search crackers by name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search items"
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <CloseIcon width={16} height={16} />
            </button>
          )}
        </div>
        <div className="brand-filter">
          <span className="brand-filter-label" id="brand-filter-label">
            Brand
          </span>
          <nav className="chips brand-chips" aria-labelledby="brand-filter-label">
            {BRAND_FILTERS.filter((b) => b.id !== 'all').map((b) => (
              <button
                type="button"
                key={b.id}
                className={`chip ${brandFilter === b.id ? 'active' : ''}`}
                onClick={() => setBrandFilter((prev) => (prev === b.id ? 'all' : b.id))}
                aria-pressed={brandFilter === b.id}
              >
                {b.label}
              </button>
            ))}
          </nav>
        </div>
        <nav className="chips" aria-label="Categories" ref={chipsRef}>
          {catalogue.categories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`chip ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => jumpTo(c.id)}
            >
              <span className="chip-icon" aria-hidden>
                {categoryIcon(c.name)}
              </span>
              {c.name}
            </button>
          ))}
        </nav>
      </div>

      <main className="catalogue">
        {visible.length === 0 && (
          <div className="empty">
            <p>
              {q
                ? `No items match “${query}”.`
                : brandFilter !== 'all'
                  ? `No ${brandLabel} items are available right now.`
                  : 'No items are available right now.'}
            </p>
            {hasFilters && (
              <button type="button" className="btn btn-outline" onClick={clearFilters}>
                {q && brandFilter !== 'all' ? 'Clear filters' : q ? 'Clear search' : 'Show all brands'}
              </button>
            )}
          </div>
        )}
        {visible.length > 0 && (
          <CatalogueGrid
            categories={visible}
            selection={selection}
            onToggle={toggle}
            onQty={setQty}
            onVideo={setVideo}
          />
        )}
        <p className="footnote">Prices shown are per unit. Your total is only an estimate.</p>
      </main>

      {itemCount > 0 && (
        <div className="bottom-bar">
          <div className="bar-left">
            <span className="bar-icon">
              <BagIcon width={22} height={22} />
              <b className="bar-badge">{itemCount}</b>
            </span>
            <span className="bottom-info">
              <span>Estimated total</span>
              <strong>{rupee(total)}</strong>
            </span>
          </div>
          <button type="button" className="btn btn-gold" onClick={() => setSheetOpen(true)}>
            View list
            <ArrowRightIcon width={18} height={18} />
          </button>
        </div>
      )}

      {video && video.videoUrl && (
        <VideoModal title={video.name} url={video.videoUrl} onClose={() => setVideo(null)} />
      )}

      {sheetOpen && (
        <OrderSheet
          shop={catalogue.shop}
          groups={groups}
          total={total}
          itemCount={itemCount}
          setQty={setQty}
          clearSelection={clear}
          onOrderPlaced={addOrder}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {ordersOpen && <MyOrders shop={catalogue.shop} orders={orders} onClose={() => setOrdersOpen(false)} />}
    </div>
  );
}
