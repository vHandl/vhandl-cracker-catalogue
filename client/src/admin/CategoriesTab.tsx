import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';
import { TrashIcon } from '../components/Icons';
import type { AdminCategory } from '../types';

interface Props {
  onError: (e: unknown) => boolean;
}

export default function CategoriesTab({ onError }: Props) {
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adminApi
      .categories()
      .then(setCats)
      .catch((e) => {
        if (!onError(e)) setError(e instanceof Error ? e.message : 'Could not load categories.');
      });
  }, [onError]);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      if (!onError(e)) setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <section className="panel">
      <h2>Categories</h2>
      <p className="muted">The order here is the order customers see. Lower numbers come first.</p>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(async () => {
            await adminApi.saveCategory({ name: newName.trim() });
            setNewName('');
          });
        }}
      >
        <input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={60}
        />
        <button className="btn btn-primary" disabled={!newName.trim()}>
          Add
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      <ul className="admin-list">
        {cats.map((c) => (
          <CategoryRow
            key={c.id}
            cat={c}
            onSave={(name, sortOrder) => run(() => adminApi.saveCategory({ id: c.id, name, sortOrder }))}
            onDelete={() => {
              if (window.confirm(`Delete category "${c.name}"?`)) run(() => adminApi.deleteCategory(c.id));
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({
  cat,
  onSave,
  onDelete,
}: {
  cat: AdminCategory;
  onSave: (name: string, sortOrder: number) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(cat.name);
  const [order, setOrder] = useState(String(cat.sortOrder));
  const dirty = name.trim() !== cat.name || Number(order) !== cat.sortOrder;

  useEffect(() => {
    setName(cat.name);
    setOrder(String(cat.sortOrder));
  }, [cat]);

  return (
    <li className="admin-item">
      <div className="cat-edit">
        <input
          className="cat-order"
          type="number"
          inputMode="numeric"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          aria-label="Display order"
        />
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Category name" />
      </div>
      <div className="admin-item-actions">
        <small className="muted">{cat.productCount} items</small>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!dirty || !name.trim()}
          onClick={() => onSave(name.trim(), Number(order) || 0)}
        >
          Save
        </button>
        <button
          type="button"
          className="icon-action icon-action-danger"
          title="Delete"
          aria-label={`Delete ${cat.name}`}
          onClick={onDelete}
        >
          <TrashIcon width={18} height={18} />
        </button>
      </div>
    </li>
  );
}
