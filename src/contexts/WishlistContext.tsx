"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

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

  // Set indexé O(1) ultra-rapide pour vérification instantanée des cœurs
  const idSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const isWishlisted = useCallback((id: string) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    (item: WishlistItem) => {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        const next = exists ? prev.filter((i) => i.id !== item.id) : [...prev, item];
        try {
          localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ items, isWishlisted, toggle, count: items.length }),
    [items, isWishlisted, toggle]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}
