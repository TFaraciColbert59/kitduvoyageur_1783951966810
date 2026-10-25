'use client';

import { useState, useEffect } from 'react';
import { getCart } from '@/lib/cart';

/**
 * useCartCount — Source de vérité réactive pour le badge du panier.
 * Synchronisé automatiquement avec le localStorage et l'événement 'cart-updated'.
 * Renvoie 0 lorsque le panier est vide.
 */
export function useCartCount(): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const items = getCart();
      const total = Array.isArray(items)
        ? items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
        : 0;
      setCount(total);
    };

    updateCount();

    window.addEventListener('cart-updated', updateCount);
    window.addEventListener('storage', updateCount);

    return () => {
      window.removeEventListener('cart-updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, []);

  return count;
}
