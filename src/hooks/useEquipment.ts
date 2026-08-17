'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCart, addToCart as addCartItem, removeFromCart as removeCartItem, updateQuantity as updateCartQty, CartItem } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface UnifiedProduct {
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
  image_alt?: string;
  rating?: number;
  review_count?: number;
  essentiality?: 'indispensable' | 'recommande' | 'optionnel';
  score_kdv?: number;
  description?: string;
  stock?: number;
  is_active?: boolean;
}

export interface UserEquipmentItem {
  id: string;
  user_id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  weight_g: number;
  purchase_price?: number | null;
  purchase_date?: string | null;
  image?: string | null;
  condition?: 'neuf' | 'excellent' | 'bon' | 'moyen' | 'usé' | 'à_réparer' | 'à_remplacer';
  source?: 'achat' | 'kit' | 'manuel' | 'occasion' | 'catalogue';
  product_id?: string | null;
  quantity?: number;
  notes?: string | null;
  is_favorite?: boolean;
  is_listed_for_sale?: boolean;
  acquired_at?: string | null;
  expiry_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  usage_count?: number;
  serial_number?: string | null;
  tags?: string[] | null;
  loan_status?: 'disponible' | 'prêté' | string | null;
  loan_to_name?: string | null;
  compartment?: string | null;
  wear_percentage?: number | null;
  size_label?: string | null;
  materials?: string | null;
  sole_type?: string | null;
  waterproof_rating?: string | null;
  ref_code?: string | null;
}

const GUEST_GEAR_STORAGE_KEY = 'lkdv_guest_equipment';

function getGuestGear(): UserEquipmentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_GEAR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGuestGear(items: UserEquipmentItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_GEAR_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function useEquipment() {
  const { user } = useAuth();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [equipment, setEquipment] = useState<UserEquipmentItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronisation du panier local
  const syncCart = useCallback(() => {
    setCartItems(getCart());
  }, []);

  // Chargement des données unifiées
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Chargement réel depuis Supabase shop_products (catalogue unique)
      const { data: prodData, error: prodErr } = await supabase
        .from('shop_products')
        .select('*')
        .order('name', { ascending: true });

      if (prodErr) {
        console.warn('shop_products fetch warning:', prodErr);
      }

      const formattedProducts: UnifiedProduct[] = (prodData || []).map((p: any) => ({
        id: p.id,
        slug: p.slug || p.id,
        name: p.name,
        brand: p.brand || 'Le Kit du Voyageur',
        category: p.category_main || p.category || 'Autre',
        category_main: p.category_main || p.category,
        weight_g: Number(p.weight_g || p.weight_grams || 0),
        price_eur: Number(p.price_eur || 0),
        image: p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
        image_alt: p.image_alt || p.name,
        rating: Number(p.rating || 4.8),
        review_count: Number(p.review_count || 12),
        essentiality: p.essentiality || 'recommande',
        score_kdv: p.score_kdv,
        description: p.description_why || p.description,
        stock: p.stock ?? 10,
        is_active: p.is_active !== false,
      }));

      setProducts(formattedProducts);

      // 2. Chargement de l'équipement possédé (table riche gear_items)
      if (user && user.id) {
        const { data: gearData, error: gearErr } = await supabase
          .from('gear_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!gearErr && gearData) {
          setEquipment(gearData as UserEquipmentItem[]);
        }
      } else {
        setEquipment(getGuestGear());
      }

      syncCart();
    } catch (err: any) {
      console.error('Erreur chargement équipement:', err);
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, syncCart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Synchronisation du panier sur les changements d'onglet/fenêtre
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'kdv_cart') syncCart();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [syncCart]);

  // Détection si un produit est déjà possédé dans l'inventaire
  const isOwned = useCallback(
    (productOrId: string | { id?: string; name?: string; slug?: string }) => {
      const targetId = typeof productOrId === 'string' ? productOrId : productOrId.id;
      const targetName = typeof productOrId === 'object' ? productOrId.name?.toLowerCase().trim() : '';

      return equipment.some((item) => {
        if (targetId && (item.product_id === targetId || item.id === targetId)) return true;
        if (targetName && item.name.toLowerCase().trim() === targetName) return true;
        return false;
      });
    },
    [equipment]
  );

  // Récupérer l'élément d'équipement possédé correspondant
  const getOwnedItem = useCallback(
    (productOrId: string | { id?: string; name?: string }) => {
      const targetId = typeof productOrId === 'string' ? productOrId : productOrId.id;
      const targetName = typeof productOrId === 'object' ? productOrId.name?.toLowerCase().trim() : '';

      return equipment.find((item) => {
        if (targetId && (item.product_id === targetId || item.id === targetId)) return true;
        if (targetName && item.name.toLowerCase().trim() === targetName) return true;
        return false;
      });
    },
    [equipment]
  );

  // Détection si un produit est dans le panier
  const isInCart = useCallback(
    (productOrId: string | { id?: string; slug?: string }) => {
      const targetId = typeof productOrId === 'string' ? productOrId : productOrId.id;
      const targetSlug = typeof productOrId === 'object' ? productOrId.slug : undefined;
      return cartItems.some((item) => item.id === targetId || (targetSlug && item.slug === targetSlug));
    },
    [cartItems]
  );

  // Quantité d'un produit dans le panier
  const getCartQuantity = useCallback(
    (productId: string) => {
      const found = cartItems.find((item) => item.id === productId || item.slug === productId);
      return found ? found.quantity : 0;
    },
    [cartItems]
  );

  // Nombre total d'articles dans le panier
  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Calcul du poids total possédé (en grammes)
  const totalPackWeight = useMemo(() => {
    return equipment.reduce((acc, item) => acc + (Number(item.weight_g) || 0) * (item.quantity || 1), 0);
  }, [equipment]);

  // AJOUT AU PANIER (Action d'achat du catalogue)
  const addToCart = useCallback(
    (product: Partial<UnifiedProduct> & { name: string; id: string }, quantity: number = 1) => {
      triggerHaptic('selection');
      const updated = addCartItem(
        {
          id: product.id,
          slug: product.slug || product.id,
          name: product.name,
          brand: product.brand || 'Le Kit du Voyageur',
          category: product.category_main || product.category || 'Équipement',
          priceEur: Number(product.price_eur || 0),
          weightG: Number(product.weight_g || product.weight_grams || 0),
          image: product.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
          imageAlt: product.image_alt || product.name,
        },
        quantity
      );
      setCartItems(updated);
    },
    [triggerHaptic]
  );

  // RETRAIT DU PANIER
  const removeFromCart = useCallback(
    (productId: string) => {
      triggerHaptic('light');
      const updated = removeCartItem(productId);
      setCartItems(updated);
    },
    [triggerHaptic]
  );

  // MODIFICATION QUANTITÉ PANIER
  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      triggerHaptic('light');
      const updated = updateCartQty(productId, quantity);
      setCartItems(updated);
    },
    [triggerHaptic]
  );

  // AJOUT À L'ÉQUIPEMENT (Mon Matériel)
  const addToEquipment = useCallback(
    async (
      product: Partial<UnifiedProduct> & { name: string },
      overrides?: Partial<UserEquipmentItem>
    ) => {
      triggerHaptic('selection');
      const generatedId = crypto.randomUUID();
      const newItem: UserEquipmentItem = {
        id: generatedId,
        user_id: user?.id || 'guest',
        product_id: product.id || null,
        name: product.name,
        brand: overrides?.brand || product.brand || null,
        model: overrides?.model || null,
        category: overrides?.category || product.category_main || product.category || 'Autre',
        weight_g: overrides?.weight_g ?? product.weight_g ?? 0,
        purchase_price: overrides?.purchase_price ?? product.price_eur ?? null,
        image: overrides?.image || product.image || null,
        condition: overrides?.condition || 'excellent',
        source: overrides?.source || (product.id ? 'catalogue' : 'manuel'),
        quantity: overrides?.quantity || 1,
        notes: overrides?.notes || null,
        is_favorite: overrides?.is_favorite || false,
        acquired_at: overrides?.acquired_at || new Date().toISOString().split('T')[0],
        next_maintenance_date: overrides?.next_maintenance_date || null,
        last_maintenance_date: overrides?.last_maintenance_date || null,
        expiry_date: overrides?.expiry_date || null,
        usage_count: overrides?.usage_count || 0,
        loan_status: overrides?.loan_status || 'disponible',
        loan_to_name: overrides?.loan_to_name || null,
        compartment: overrides?.compartment || null,
      };

      // Mise à jour optimiste
      setEquipment((prev) => [newItem, ...prev]);
      if (!user) {
        saveGuestGear([newItem, ...equipment]);
      }

      // Persistance Supabase pour utilisateur authentifié
      if (user && user.id) {
        try {
          const { data, error: insertErr } = await supabase
            .from('gear_items')
            .insert({
              id: generatedId,
              user_id: user.id,
              product_id: newItem.product_id,
              name: newItem.name,
              brand: newItem.brand,
              category: newItem.category,
              weight_g: newItem.weight_g,
              purchase_price: newItem.purchase_price,
              image: newItem.image,
              condition: newItem.condition,
              source: newItem.source,
              quantity: newItem.quantity,
              notes: newItem.notes,
              is_favorite: newItem.is_favorite,
              acquired_at: newItem.acquired_at,
              next_maintenance_date: newItem.next_maintenance_date,
              last_maintenance_date: newItem.last_maintenance_date,
              expiry_date: newItem.expiry_date,
              usage_count: newItem.usage_count,
              loan_status: newItem.loan_status,
              loan_to_name: newItem.loan_to_name,
              compartment: newItem.compartment,
            })
            .select('*')
            .maybeSingle();

          if (insertErr) {
            console.warn('Note insertion gear_items:', insertErr.message || insertErr);
          } else if (data) {
            setEquipment((prev) => [data as UserEquipmentItem, ...prev.filter((i) => i.id !== generatedId)]);
          }
        } catch (err) {
          console.warn('Exception ajout gear_item:', err);
        }
      }
    },
    [user, supabase, equipment, triggerHaptic]
  );

  // SUPPRESSION DE L'ÉQUIPEMENT (Mon Matériel)
  const removeFromEquipment = useCallback(
    async (gearItemIdOrProductId: string) => {
      triggerHaptic('warning');
      const target = equipment.find((i) => i.id === gearItemIdOrProductId || i.product_id === gearItemIdOrProductId);
      const targetId = target ? target.id : gearItemIdOrProductId;

      const updated = equipment.filter((item) => item.id !== targetId && item.product_id !== gearItemIdOrProductId);
      setEquipment(updated);
      if (!user) saveGuestGear(updated);

      if (user && user.id && targetId) {
        try {
          await supabase.from('gear_items').delete().eq('id', targetId).eq('user_id', user.id);
        } catch (err) {
          console.warn('Erreur suppression gear_item:', err);
        }
      }
    },
    [user, supabase, equipment, triggerHaptic]
  );

  // MISE À JOUR ÉQUIPEMENT
  const updateEquipment = useCallback(
    async (gearItemId: string, patch: Partial<UserEquipmentItem>) => {
      triggerHaptic('light');
      const updated = equipment.map((item) => (item.id === gearItemId ? { ...item, ...patch } : item));
      setEquipment(updated);
      if (!user) saveGuestGear(updated);

      if (user && user.id) {
        try {
          await supabase.from('gear_items').update(patch).eq('id', gearItemId).eq('user_id', user.id);
        } catch (err) {
          console.warn('Erreur update gear_item:', err);
        }
      }
    },
    [user, supabase, equipment, triggerHaptic]
  );

  return {
    products,
    equipment,
    cartItems,
    cartCount,
    loading,
    error,
    totalPackWeight,
    isOwned,
    getOwnedItem,
    isInCart,
    getCartQuantity,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
    refresh: loadData,
  };
}
