import { useCallback, useEffect, useState } from 'react';
import type { Order } from '../types';

const KEY = 'cc_orders_v1';
const MAX_ORDERS = 30; // keep the most recent ones on this device

function isOrder(o: unknown): o is Order {
  const x = o as Partial<Order> | null;
  return !!x && typeof x.token === 'string' && typeof x.id === 'number' && Array.isArray(x.items);
}

function load(): Order[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(isOrder) : [];
  } catch {
    return [];
  }
}

/** Orders placed from this phone/computer, newest first. Kept in the browser's local storage. */
export function useMyOrders() {
  const [orders, setOrders] = useState<Order[]>(load);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => {
      const next = [order, ...prev.filter((o) => o.id !== order.id)].slice(0, MAX_ORDERS);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked: the order still shows until the page is closed */
      }
      return next;
    });
  }, []);

  // Stay in sync when another tab places an order.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setOrders(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { orders, addOrder };
}
