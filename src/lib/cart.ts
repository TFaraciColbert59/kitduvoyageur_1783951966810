'use client';

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceEur: number;
  originalPriceEur?: number; // original price before loyalty discount
  weightG: number;
  image: string;
  imageAlt: string;
  quantity: number;
  category: string;
  loyaltyFree?: boolean; // true if made free by loyalty points
}

const CART_KEY = 'kdv_cart';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  } catch (e) {
    console.error('Failed to save cart to localStorage', e);
  }
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity: number = 1): CartItem[] {
  const cart = getCart();
  const existing = cart.find((i) => i.id === item.id);
  let updated: CartItem[];
  if (existing) {
    updated = cart.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
  } else {
    updated = [...cart, { ...item, quantity }];
  }
  saveCart(updated);
  return updated;
}

export function removeFromCart(id: string): CartItem[] {
  let updated = getCart().filter((i) => i.id !== id);
  saveCart(updated);
  return updated;
}

export function updateQuantity(id: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeFromCart(id);
  let updated = getCart().map((i) => i.id === id ? { ...i, quantity } : i);
  saveCart(updated);
  return updated;
}

export function clearCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new CustomEvent('cart-updated'));
  } catch (e) {
    console.error('Failed to clear cart from localStorage', e);
  }
}

/**
 * Apply loyalty discount to a cart item — makes it free.
 * Stores original price and sets priceEur to 0.
 */
export function applyLoyaltyFree(id: string): CartItem[] {
  const cart = getCart();
  let updated = cart.map((i) => {
    if (i.id === id) {
      return {
        ...i,
        originalPriceEur: i.originalPriceEur ?? i.priceEur,
        priceEur: 0,
        loyaltyFree: true,
      };
    }
    return i;
  });
  saveCart(updated);
  return updated;
}

/**
 * Remove loyalty discount from a cart item — restores original price.
 */
export function removeLoyaltyFree(id: string): CartItem[] {
  const cart = getCart();
  let updated = cart.map((i) => {
    if (i.id === id && i.loyaltyFree) {
      return {
        ...i,
        priceEur: i.originalPriceEur ?? i.priceEur,
        originalPriceEur: undefined,
        loyaltyFree: false,
      };
    }
    return i;
  });
  saveCart(updated);
  return updated;
}

export function getCartTotals(items: CartItem[]) {
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPriceEur = items.reduce((s, i) => s + i.priceEur * i.quantity, 0);
  const totalWeightG = items.reduce((s, i) => s + i.weightG * i.quantity, 0);
  const savedEur = items.reduce((s, i) => {
    if (i.loyaltyFree && i.originalPriceEur) {
      return s + i.originalPriceEur * i.quantity;
    }
    return s;
  }, 0);
  return { totalItems, totalPriceEur, totalWeightG, savedEur };
}
