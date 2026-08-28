import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getCart, addToCart, removeFromCart, clearCart, CartItem } from '@/lib/cart';

describe('Cart Data Synchronization & Count Integrity', () => {
  let store: Record<string, string> = {};

  beforeAll(() => {
    const localStorageMock = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    (globalThis as any).window = {
      localStorage: localStorageMock,
      dispatchEvent: () => true,
    };
    (globalThis as any).localStorage = localStorageMock;
  });

  beforeEach(() => {
    store = {};
  });

  const mockItem: Omit<CartItem, 'quantity'> = {
    id: 'prod-tente-1',
    slug: 'tente-trek-ultralight',
    name: 'Tente Trek Ultralight 2P',
    brand: 'LKDV',
    priceEur: 189,
    weightG: 1200,
    image: '/assets/gear-tent-small.jpg',
    imageAlt: 'Tente',
    category: 'Tentes',
  };

  it('starts with empty cart and 0 count', () => {
    const cart = getCart();
    expect(cart).toEqual([]);
    const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(count).toBe(0);
  });

  it('correctly increments count when items are added', () => {
    addToCart(mockItem, 2);
    let cart = getCart();
    expect(cart.length).toBe(1);
    expect(cart[0].quantity).toBe(2);

    addToCart({ ...mockItem, id: 'prod-sac-2' }, 1);
    cart = getCart();
    expect(cart.length).toBe(2);
    const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(count).toBe(3);
  });

  it('correctly updates count to 0 after removing items or clearing cart', () => {
    addToCart(mockItem, 2);
    let cart = getCart();
    expect(cart.length).toBe(1);

    removeFromCart(mockItem.id);
    cart = getCart();
    expect(cart.length).toBe(0);
    let count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(count).toBe(0);

    // Test clearCart
    addToCart(mockItem, 5);
    clearCart();
    cart = getCart();
    expect(cart).toEqual([]);
    count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    expect(count).toBe(0);
  });
});
