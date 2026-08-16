import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCart, addToCart } from '@/lib/cart';
import { useRouter } from 'next/navigation';

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  category_main?: string;
  weight_g: number;
  weight_grams?: number;
  price_eur: number;
  image: string;
  image_alt: string;
  essentiality?: string;
  score_kdv?: number;
}

interface GearItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  weight_g: number;
  purchase_price: number;
  image: string;
  product_id?: string;
  quantity?: number; // Virtual for grouping
}

/**
 * Hook to fetch shop products and the authenticated user's gear items.
 * Provides helpers for adding items to inventory and to the cart.
 */
export default function useOwnedEquipment(user: any, setCartCount: (n: number) => void) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // Load shop products
    let { data: prodData } = await supabase.from('shop_products').select('*');
    if (!prodData || prodData.length === 0) {
      const fallback = await supabase.from('shop_products').select('*').eq('is_active', true);
      prodData = fallback.data;
    }
    if (prodData) setProducts(prodData as ShopProduct[]);

    // Load user's gear items
    if (user) {
      const { data: gearData } = await supabase.from('gear_items').select('*').eq('user_id', user.id);
      if (gearData) setGearItems(gearData as GearItem[]);
    }

    // Sync cart count
    setCartCount(getCart().reduce((acc, i) => acc + i.quantity, 0));
    setLoading(false);
  }, [user, supabase, setCartCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshCart = useCallback(() => {
    setCartCount(getCart().reduce((acc, i) => acc + i.quantity, 0));
  }, [setCartCount]);

  const handleAddToInventory = useCallback(
    async (p: ShopProduct) => {
      if (!user) {
        router.push('/connexion');
        return;
      }
      const { error } = await supabase.from('gear_items').insert({
        user_id: user.id,
        name: p.name,
        brand: p.brand,
        category: p.category_main || p.category || 'Autre',
        purchase_price: p.price_eur,
        weight_g: p.weight_g || p.weight_grams || 0,
        image: p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
        condition: 'neuf',
        source: 'catalogue',
        product_id: p.id,
      });
      if (!error) {
        const { data: refreshed } = await supabase.from('gear_items').select('*').eq('user_id', user.id);
        if (refreshed) setGearItems(refreshed as GearItem[]);
        refreshCart();
      }
    },
    [user, supabase, router, refreshCart]
  );

  const handleAddToCart = useCallback(
    (title: string, category: string) => {
      const product =
        products.find(
          (p) => p.name.toLowerCase().includes(title.toLowerCase()) || p.category?.toLowerCase() === category.toLowerCase()
        ) || products[0];
      if (product) {
        addToCart({
          id: product.id,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          category: product.category,
          priceEur: product.price_eur,
          weightG: product.weight_g || 0,
          image: product.image,
          imageAlt: product.image_alt || product.name,
        });
        refreshCart();
      }
    },
    [products, refreshCart]
  );

  return { products, gearItems, loading, handleAddToInventory, handleAddToCart, refreshCart };
}
