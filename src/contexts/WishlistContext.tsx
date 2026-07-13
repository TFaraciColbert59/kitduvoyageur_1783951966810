'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface WishlistItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceEur: number;
  weightG: number;
  image: string;
  imageAlt: string;
  category: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  isWishlisted: (id: string) => boolean;
  toggle: (item: WishlistItem) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const WISHLIST_KEY = 'kdv_wishlist';

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const save = (updated: WishlistItem[]) => {
    setItems(updated);
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const isWishlisted = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const toggle = useCallback(
    (item: WishlistItem) => {
      const exists = items.some((i) => i.id === item.id);
      save(exists ? items.filter((i) => i.id !== item.id) : [...items, item]);
    },
    [items]
  );

  return (
    <WishlistContext.Provider value={{ items, isWishlisted, toggle, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}
