import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, ApiError, type BulkProblem } from '../api';
import Modal from '../components/Modal';
import { useBackClose } from '../components/useBackClose';
import type { AdminCategory, AdminProduct } from '../types';
import ImageField from './ImageField';
import ProductsGrid from './ProductsGrid';

interface Props {
  onError: (e: unknown) => boolean;
}

const EMPTY: Omit<AdminProduct, 'id' | 'categoryName'> = {
  code: '',
  brand: '',
  name: '',
  categoryId: 0,
  price: 0,
  unit: 'box',
  videoUrl: '',
  imageUrl: '',
  active: true,
  outOfStock: false,
};

export default function ProductsTab({ onError }: Props) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [q, setQ] = useState('');
  /** '' = all categories, otherwise a category id. */
  const [catFilter, setCatFilter] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Partial<AdminProduct> | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [clearKey, setClearKey] = useState(0);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(() => {
    Promise.all([adminApi.products(), adminApi.categories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
        setError('');
      })
      .catch((e) => {
        if (!onError(e)) setError(e instanceof Error ? e.message : 'Could not load products.');
      });
  }, [onError]);
  useEffect(load, [load]);

  // Ignore a stale filter (e.g. the category was deleted meanwhile).
  const activeCat = categories.some((c) => String(c.id) === catFilter) ? Number(catFilter) : null;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (activeCat === null || p.categoryId === activeCat) &&
        (!t || p.name.toLowerCase().includes(t) || p.code.toLowerCase().includes(t))
    );
  }, [products, q, activeCat]);

  // The grid unmounts when nothing matches, so drop any selection it was holding.
  useEffect(() => {
    if (filtered.length === 0) setSelectedIds([]);
  }, [filtered.length]);

  const edit = useCallback((p: AdminProduct) => setEditing(p), []);

  const remove = useCallback(
    async (p: AdminProduct) => {
      if (!window.confirm(`Delete "${p.name}"? Past orders keep their own copy of this item.`)) return;
      try {
        await adminApi.deleteProduct(p.id);
        setNotice('');
        load();
      } catch (e) {
        if (!onError(e)) setError(e instanceof Error ? e.message : 'Delete failed.');
      }
    },
    [load, onError]
  );

  /** Show / hide / delete every ticked row in the grid. */
  async function bulkAction(action: 'show' | 'hide' | 'delete' | 'outofstock' | 'instock') {
    const n = selectedIds.length;
    if (n === 0) return;
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${n} product${n === 1 ? '' : 's'}? Past orders keep their own copy of these items.`)
    ) {
      return;
    }
    setBusyAction(true);
    setError('');
    try {
      const r = await adminApi.bulkProductAction(action, selectedIds);
      const verb = {
        show: 'shown in the catalogue',
        hide: 'hidden from the catalogue',
        delete: 'deleted',
        outofstock: 'marked out of stock',
        instock: 'marked available',
      }[action];
      setNotice(`${r.changed} product${r.changed === 1 ? '' : 's'} ${verb}.`);
      setSelectedIds([]);
      setClearKey((k) => k + 1);
      load();
    } catch (e) {
      if (!onError(e)) setError(e instanceof Error ? e.message : 'Could not complete that action.');
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          Products ({filtered.length === products.length ? products.length : `${filtered.length} of ${products.length}`})
        </h2>
        <div className="admin-item-actions">
          <button type="button" className="btn btn-outline" onClick={() => setBulkOpen(true)}>
            Bulk upload (CSV)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={categories.length === 0}
            onClick={() => setEditing({ ...EMPTY, categoryId: categories[0]?.id ?? 0 })}
          >
            + Add product
          </button>
        </div>
      </div>
      {categories.length === 0 && <div className="alert alert-info">Add a category first (Categories tab).</div>}
      <div className="admin-filters">
        <input
          className="admin-search"
          type="search"
          placeholder="Search by name or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="admin-search admin-filter-select"
          aria-label="Filter by category"
          value={activeCat === null ? '' : String(activeCat)}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.productCount})
            </option>
          ))}
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {selectedIds.length > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Actions for selected products">
          <strong>{selectedIds.length} selected</strong>
          <div className="bulk-bar-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={busyAction} onClick={() => bulkAction('show')}>
              Show in catalogue
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busyAction} onClick={() => bulkAction('hide')}>
              Hide from catalogue
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busyAction} onClick={() => bulkAction('outofstock')}>
              Mark out of stock
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busyAction} onClick={() => bulkAction('instock')}>
              Mark available
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busyAction} onClick={() => bulkAction('delete')}>
              Delete
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busyAction} onClick={() => setClearKey((k) => k + 1)}>
              Clear selection
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="muted">No products found.</p>
      ) : (
        <ProductsGrid
          products={filtered}
          onEdit={edit}
          onDelete={remove}
          onSelectionChange={setSelectedIds}
          clearSelectionKey={clearKey}
        />
      )}

      {editing && (
        <ProductForm
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onError={onError}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          onClose={() => setBulkOpen(false)}
          onDone={(msg) => {
            setBulkOpen(false);
            setNotice(msg);
            load();
          }}
          onError={onError}
        />
      )}
    </section>
  );
}

const CSV_TEMPLATE =
  'code,name,category,price,brand,unit,video_url,image_url\r\n' +
  'SPA001,Sparklers 10cm (10 pcs),Sparklers,55,Standard,box,,\r\n' +
  'FPT001,Flower Pots Big (10 pcs),Flower Pots,220,Standard,box,,\r\n' +
  'GIF001,Mixed gift item,,150,,box,,\r\n';

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function BulkUploadModal({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (e: unknown) => boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [problems, setProblems] = useState<BulkProblem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  useBackClose(true, onClose);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError('');
    setProblems([]);
    try {
      const r = await adminApi.bulkUploadProducts(await file.text());
      const cats = r.categoriesCreated.length ? ` New categories: ${r.categoriesCreated.join(', ')}.` : '';
      onDone(`${r.created} product${r.created === 1 ? '' : 's'} added.${cats}`);
    } catch (e) {
      if (!onError(e)) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
        if (e instanceof ApiError && e.details) {
          setProblems(e.details);
          setTotalProblems(e.totalProblems ?? e.details.length);
        }
      }
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Bulk upload products"
      onClose={onClose}
      variant="dialog"
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!file || busy} onClick={upload}>
          {busy ? 'Uploading…' : 'Upload products'}
        </button>
      }
    >
      <p className="muted small">
        Upload a <b>.csv</b> file with a header row. Required columns: <b>code</b>, <b>name</b>, <b>price</b>. Optional:
        category, brand, unit, video_url, image_url, out_of_stock (yes/no).
      </p>
      <ul className="muted small bulk-rules">
        <li>Each item code must be unique, in the file and in the existing catalogue.</li>
        <li>Price cannot be less than 0.</li>
        <li>A blank category puts the item in &ldquo;Misc&rdquo;. New categories are created automatically.</li>
        <li>All uploaded products are shown in the catalogue.</li>
        <li>If any row has a problem, nothing is uploaded.</li>
      </ul>
      <p>
        <button type="button" className="btn btn-outline btn-sm" onClick={downloadTemplate}>
          Download template
        </button>
      </p>
      <label className="field">
        <span>CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError('');
            setProblems([]);
          }}
        />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      {problems.length > 0 && (
        <ul className="bulk-problems">
          {problems.map((p, i) => (
            <li key={i}>
              <b>Line {p.line}</b>
              {p.code && <span className="card-code">{p.code}</span>} {p.message}
            </li>
          ))}
          {totalProblems > problems.length && (
            <li className="muted">…and {totalProblems - problems.length} more problems.</li>
          )}
        </ul>
      )}
    </Modal>
  );
}

function ProductForm({
  initial,
  categories,
  onClose,
  onSaved,
  onError,
}: {
  initial: Partial<AdminProduct>;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => boolean;
}) {
  const [f, setF] = useState({
    code: initial.code ?? '',
    brand: initial.brand ?? '',
    name: initial.name ?? '',
    categoryId: initial.categoryId ?? categories[0]?.id ?? 0,
    price: String(initial.price ?? ''),
    unit: initial.unit ?? 'box',
    videoUrl: initial.videoUrl ?? '',
    imageUrl: initial.imageUrl ?? '',
    active: initial.active ?? true,
    outOfStock: initial.outOfStock ?? false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useBackClose(true, onClose);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.saveProduct({ ...f, price: Number(f.price), id: initial.id });
      onSaved();
    } catch (err) {
      if (!onError(err)) setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial.id ? 'Edit product' : 'Add product'}
      onClose={onClose}
      variant="dialog"
      footer={
        <button type="submit" form="product-form" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      }
    >
      <form id="product-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field">
            <span>Product code</span>
            <input
              value={f.code}
              onChange={(e) => set('code', e.target.value)}
              required={!!initial.id}
              maxLength={30}
              placeholder={initial.id ? '' : 'Leave blank to auto-generate'}
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={f.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Product name</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
        </label>
        <label className="field">
          <span>Brand (optional)</span>
          <input value={f.brand} onChange={(e) => set('brand', e.target.value)} maxLength={60} placeholder="e.g. Standard, Ayyan" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Price (₹)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={f.price}
              onChange={(e) => set('price', e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Per (unit)</span>
            <input value={f.unit} onChange={(e) => set('unit', e.target.value)} maxLength={20} placeholder="box, packet, piece" />
          </label>
        </div>
        <label className="field">
          <span>Video URL (optional)</span>
          <input
            type="url"
            value={f.videoUrl}
            onChange={(e) => set('videoUrl', e.target.value)}
            placeholder="YouTube, Vimeo or .mp4 link"
          />
        </label>
        <ImageField
          label="Product image (optional)"
          value={f.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          onError={onError}
        />
        <label className="check-row">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
          <span>Show this product in the catalogue</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={f.outOfStock} onChange={(e) => set('outOfStock', e.target.checked)} />
          <span>Mark as Out of Stock</span>
        </label>
        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </Modal>
  );
}
