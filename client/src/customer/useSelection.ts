import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Catalogue, Category, Product, Selection } from '../types';

const KEY = 'cc_selection_v1';

function load(): Selection {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out: Selection = {};
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      const qty = Number(v);
      if (Number.isInteger(id) && Number.isInteger(qty) && qty > 0) out[id] = qty;
    }
    return out;
  } catch {
    return {};
  }
}

export interface SelectedGroup {
  category: Category;
  lines: { product: Product; qty: number; lineTotal: number }[];
  subtotal: number;
}

export function useSelection(catalogue: Catalogue | null) {
  const [selection, setSelection] = useState<Selection>(load);

  // Drop items that no longer exist in the catalogue (e.g. shop removed them) or are now out of stock.
  useEffect(() => {
    if (!catalogue) return;
    const valid = new Set(
      catalogue.categories.flatMap((c) => c.products.filter((p) => !p.outOfStock).map((p) => p.id))
    );
    setSelection((prev) => {
      const next: Selection = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (valid.has(Number(k))) next[Number(k)] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [catalogue]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(selection));
    } catch {
      /* storage full / private mode */
    }
  }, [selection]);

  const setQty = useCallback((id: number, qty: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (qty > 0) next[id] = Math.min(9999, Math.floor(qty));
      else delete next[id];
      return next;
    });
  }, []);

  const toggle = useCallback((id: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelection({}), []);

  const groups: SelectedGroup[] = useMemo(() => {
    if (!catalogue) return [];
    const result: SelectedGroup[] = [];
    for (const category of catalogue.categories) {
      const lines = category.products
        .filter((p) => selection[p.id])
        .map((product) => ({
          product,
          qty: selection[product.id],
          lineTotal: Math.round(product.price * selection[product.id] * 100) / 100,
        }));
      if (lines.length) {
        result.push({
          category,
          lines,
          subtotal: Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
        });
      }
    }
    return result;
  }, [catalogue, selection]);

  const itemCount = groups.reduce((s, g) => s + g.lines.length, 0);
  const total = Math.round(groups.reduce((s, g) => s + g.subtotal, 0) * 100) / 100;

  return { selection, setQty, toggle, clear, groups, itemCount, total };
}
