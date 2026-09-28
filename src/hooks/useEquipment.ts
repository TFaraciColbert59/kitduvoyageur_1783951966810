'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCart, addToCart as addCartItem, removeFromCart as removeCartItem, updateQuantity as updateCartQty, CartItem } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { newId } from '@/lib/uuid';
import { Kit } from '@/types/kit';

/**
 * Regle du module : aucune donnee n'est inventee.
 *
 * `shop_products` utilise 0 et la chaine vide comme sentinelles « non renseigne »
 * (`brand TEXT NOT NULL DEFAULT ''`, `price_eur NUMERIC(10,2) NOT NULL DEFAULT 0`,
 * `rating NUMERIC(3,1) NOT NULL DEFAULT 0`, `weight_g INTEGER NOT NULL DEFAULT 0`,
 * `image TEXT NOT NULL DEFAULT ''`). Les remplacer par 4,8 / 12 avis / 10 en
 * stock / 0 g / une photo generique transformerait un trou de donnee en
 * mensonge affiche. Elles deviennent donc `null` ici, et l'appelant affiche
 * « indisponible » ou « a verifier ».
 *
 * `stock` et `review_count` font exception : 0 y est une information reelle
 * (rupture de stock, aucun avis), pas un trou.
 */

export type ProductEssentiality = 'indispensable' | 'recommande' | 'optionnel';

export interface UnifiedProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string | null;
  category_main?: string | null;
  weight_g: number | null;
  weight_grams?: number | null;
  price_eur: number | null;
  image: string | null;
  image_alt?: string | null;
  rating?: number | null;
  review_count?: number | null;
  essentiality?: ProductEssentiality | null;
  score_kdv?: number | null;
  description?: string | null;
  stock?: number | null;
  is_active?: boolean | null;
}

export interface UserEquipmentItem {
  id: string;
  user_id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  weight_g: number | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  image?: string | null;
  condition?: 'neuf' | 'excellent' | 'bon' | 'moyen' | 'usé' | 'à_réparer' | 'à_remplacer' | null;
  source?: 'achat' | 'kit' | 'manuel' | 'occasion' | 'catalogue' | null;
  product_id?: string | null;
  quantity?: number;
  notes?: string | null;
  is_favorite?: boolean;
  is_listed_for_sale?: boolean;
  acquired_at?: string | null;
  expiry_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  last_used_date?: string | null;
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
const GUEST_KITS_STORAGE_KEY = 'lkdv_guest_kits';

/** Prix/compte strictement positif, ou `null`. */
export function normalizeShopPrice(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Poids strictement positif, ou `null`. Un article de 0 g n'existe pas. */
export function normalizeShopWeight(value: unknown): number | null {
  const parsed = normalizeShopPrice(value);
  return parsed === null ? null : parsed;
}

/** Entier positif ou nul : 0 est une information reelle (stock, avis). */
export function normalizeShopCount(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/** Note sur 5 strictement positive, ou `null` si le schema porte la sentinelle 0. */
export function normalizeShopRating(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0 || parsed > 5) {
    return null;
  }
  return parsed;
}

/** Booleen lu tel quel, ou `null` si la colonne est absente. */
function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** Chaine non vide apres trim, ou `null`. La chaine vide du schema reste vide. */
export function normalizeShopText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalise `essentiality` vers l'union de types. Le schema stocke
 * « Recommandé » / « Indispensable » / « Optionnel » : une valeur hors
 * nomenclature est renvoyee `null` plutot que devinee.
 */
export function normalizeEssentiality(value: unknown): ProductEssentiality | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toLowerCase()) {
    case 'indispensable':
      return 'indispensable';
    case 'recommandé':
    case 'recommande':
    case 'recommended':
      return 'recommande';
    case 'optionnel':
    case 'optional':
      return 'optionnel';
    default:
      return null;
  }
}

export type AddToCartOutcome =
  | {
      ok: true;
      item: CartItem;
      /**
       * Le poids reel de l'article est absent du catalogue. `item.weightG` vaut
       * alors 0, qui est la sentinelle du schema — PAS une mesure. Tout total
       * de poids calcule a partir de cet article (voir `totalWeightG` de
       * `@/lib/cart`) est donc un minimum, pas un total : l'appelant doit
       * afficher « poids a verifier » plutot que d'annoncer un poids.
       */
      weightKnown: boolean;
    }
  | { ok: false; reason: 'prix_inconnu' };

/**
 * Construit la ligne de panier d'un produit.
 *
 * `CartItem.priceEur` est requis et non nullable : un prix inconnu ne peut pas
 * entrer au panier sous forme de 0 EUR, l'utilisateur commanderait un article
 * « gratuit » qui ne l'est pas. Le refus est explicite et l'appelant decide
 * quoi afficher.
 *
 * Pour `brand`, `category` et `image`, la chaine vide est la sentinelle « non
 * renseigne » du schema (`TEXT NOT NULL DEFAULT ''`) et le type `CartItem` les
 * rend obligatoires : on reutilise cette sentinelle plutot que d'inventer une
 * marque, une categorie ou une image.
 *
 * Pour `weightG`, `CartItem.weightG` est `number` et hors de perimetre de
 * modification : la sentinelle 0 du schema (`weight_g INTEGER DEFAULT 0`) est
 * reprise, et `weightKnown` dit explicitement a l'appelant que ce 0 n'est pas
 * une mesure. Un poids inconnu ne devient donc jamais un poids affiche.
 */
export function buildCartItemFromProduct(
  product: Partial<UnifiedProduct> & { id: string; name: string },
  quantity: number
): AddToCartOutcome {
  const priceEur = normalizeShopPrice(product.price_eur);
  if (priceEur === null) return { ok: false, reason: 'prix_inconnu' };

  const weightG = normalizeShopWeight(product.weight_g) ?? normalizeShopWeight(product.weight_grams);

  return {
    ok: true,
    weightKnown: weightG !== null,
    item: {
      id: product.id,
      slug: normalizeShopText(product.slug) ?? product.id,
      name: product.name,
      brand: normalizeShopText(product.brand) ?? '',
      category: normalizeShopText(product.category_main) ?? normalizeShopText(product.category) ?? '',
      priceEur,
      weightG: weightG ?? 0,
      image: normalizeShopText(product.image) ?? '',
      imageAlt: normalizeShopText(product.image_alt) ?? product.name,
      quantity,
    },
  };
}

/**
 * Projette une ligne `shop_products` vers `UnifiedProduct` sans jamais combler
 * un trou. Renvoie `null` si la ligne n'est pas exploitable (ni objet, pas
 * d'identifiant ou pas de nom) plutot que de fabriquer une cle.
 */
export function mapShopProductRow(row: unknown): UnifiedProduct | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;

  const id = normalizeShopText(record.id);
  const name = normalizeShopText(record.name);
  if (!id || !name) return null;

  const categoryMain = normalizeShopText(record.category_main);
  const category = normalizeShopText(record.category);

  return {
    id,
    slug: normalizeShopText(record.slug) ?? id,
    name,
    brand: normalizeShopText(record.brand),
    category: categoryMain ?? category,
    category_main: categoryMain ?? category,
    weight_g: normalizeShopWeight(record.weight_g) ?? normalizeShopWeight(record.weight_grams),
    weight_grams: normalizeShopWeight(record.weight_grams),
    price_eur: normalizeShopPrice(record.price_eur),
    image: normalizeShopText(record.image),
    image_alt: normalizeShopText(record.image_alt),
    rating: normalizeShopRating(record.rating),
    review_count: normalizeShopCount(record.review_count),
    essentiality: normalizeEssentiality(record.essentiality),
    score_kdv: normalizeShopCount(record.score_kdv),
    description: normalizeShopText(record.description_why) ?? normalizeShopText(record.description),
    stock: normalizeShopCount(record.stock),
    is_active: readBoolean(record.is_active),
  };
}

/**
 * Lit l'inventaire local d'un visiteur non connecte.
 *
 * Renvoie une liste vide quand rien n'est stocke ou quand le JSON est
 * inexploitable : aucun inventaire d'exemple n'est injecte. Une entree sans
 * identifiant est ecartee plutot que d recevoir une cle fabriquee, sinon
 * l'interface afficherait une ligne sans origine.
 */
export function readGuestGearPayload(raw: string | null): UserEquipmentItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const id = normalizeShopText(record.id);
    const name = normalizeShopText(record.name);
    if (!id || !name) return [];
    return [{ ...(entry as UserEquipmentItem), id, name }];
  });
}

function getGuestGear(): UserEquipmentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return readGuestGearPayload(localStorage.getItem(GUEST_GEAR_STORAGE_KEY));
  } catch {
    return [];
  }
}

function saveGuestGear(items: UserEquipmentItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_GEAR_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible : l'inventaire reste en memoire pour la session.
  }
}

function getGuestKits(): Kit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_KITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestKits(kits: Kit[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(kits));
  } catch { /* stockage indisponible */ }
}

export function useEquipment() {
  const { user } = useAuth();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = useMemo(() => createClient(), []);

  // Etat initial vide : tant que la base n'a pas repondu, l'ecran affiche
  // « chargement » puis « indisponible », jamais un catalogue d'exemple.
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [equipment, setEquipment] = useState<UserEquipmentItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
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
      // 1. Catalogue réel depuis Supabase `shop_products`
      const { data: prodData, error: prodErr } = await supabase
        .from('shop_products')
        .select('*')
        .order('name', { ascending: true });

      const formattedProducts = (prodData ?? [])
        .map(mapShopProductRow)
        .filter((row): row is UnifiedProduct => row !== null);
      setProducts(formattedProducts);

      if (prodErr) {
        setError('Catalogue indisponible.');
      }

      // 2. Équipement possédé. Un utilisateur connecté lit sa base : si elle ne
      //    répond pas on affiche « indisponible », on ne substitue pas un
      //    inventaire d'exemple ni celui d'un autre contexte.
      if (user && user.id) {
        const { data: gearData, error: gearErr } = await supabase
          .from('gear_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!gearErr && gearData) {
          setEquipment(gearData as UserEquipmentItem[]);
        } else {
          setEquipment([]);
          if (gearErr) setError('Équipement indisponible.');
        }

        // Load kits for the user
        const { data: kitData, error: kitErr } = await supabase
          .from('kits')
          .select('*')
          .eq('user_id', user.id);
        if (!kitErr && kitData) {
          setKits(kitData as Kit[]);
        } else {
          setKits([]);
        }
      } else {
        setEquipment(getGuestGear());
        setKits(getGuestKits());
      }

      syncCart();
    } catch {
      // Aucune donnée n'a ete lue : on vide et on le dit plutot que d'afficher
      // un repli qui ferait passer l'ecran pour complet.
      setProducts([]);
      setEquipment([]);
      setKits([]);
      setError('Équipement indisponible.');
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

  // Poids total possédé. Ne somme que les poids connus : un article de poids
  // inconnu ne vaut pas 0 g, il ne compte simplement pas.
  const totalPackWeight = useMemo(() => {
    return equipment.reduce(
      (acc, item) => acc + (normalizeShopWeight(item.weight_g) ?? 0) * (item.quantity ?? 1),
      0
    );
  }, [equipment]);

  // AJOUT AU PANIER (Action d'achat du catalogue)
  const addToCart = useCallback(
    (
      product: Partial<UnifiedProduct> & { name: string; id: string },
      quantity: number = 1
    ): AddToCartOutcome => {
      const outcome = buildCartItemFromProduct(product, quantity);
      if (!outcome.ok) {
        // Prix inconnu : on refuse l'ajout plutot que d'ecrire 0 EUR.
        triggerHaptic('warning');
        return outcome;
      }
      triggerHaptic('selection');
      setCartItems(addCartItem(outcome.item, quantity));
      return outcome;
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
      const generatedId = newId();
      const newItem: UserEquipmentItem = {
        id: generatedId,
        user_id: user?.id || 'guest',
        product_id: product.id || null,
        name: product.name,
        brand: overrides?.brand || product.brand || null,
        model: overrides?.model || null,
        category: overrides?.category || product.category_main || product.category || 'Autre',
        // Poids inconnu reste `null` : la colonne `gear_items.weight_g` est
        // nullable, on ne substitue pas 0 g a un article non pese.
        weight_g: overrides?.weight_g ?? product.weight_g ?? null,
        purchase_price: overrides?.purchase_price ?? product.price_eur ?? null,
        image: overrides?.image || product.image || null,
        // Un article fraichement ajoute n'a pas d'etat verifie : aucune
        // condition n'est affirmee. La colonne reste a son defaut base.
        condition: overrides?.condition ?? null,
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
              // `condition` est volontairement absent : la colonne est
              // `NOT NULL DEFAULT 'bon'` et aucune condition n'a ete verifiee.
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
            console.warn('[useEquipment] insertion gear_items impossible', insertErr.message || insertErr);
          } else if (data) {
            setEquipment((prev) => [data as UserEquipmentItem, ...prev.filter((i) => i.id !== generatedId)]);
          }
        } catch (err) {
          console.warn('[useEquipment] exception ajout gear_item', err);
        }
      }
    },
    [user, supabase, equipment, triggerHaptic]
  );

  // SUPPRESSION DE L'ÉQUIPEMENT (Mon Matériel)
  const removeFromEquipment = useCallback(
    async (gearItemIdOrProductId: string) => {
      triggerHaptic('warning');
      // Optimistic update
      setEquipment((prev) => prev.filter((item) => item.id !== gearItemIdOrProductId && item.product_id !== gearItemIdOrProductId));
      if (!user) {
        const filtered = getGuestGear().filter((item) => item.id !== gearItemIdOrProductId && item.product_id !== gearItemIdOrProductId);
        saveGuestGear(filtered);
      }

      if (user && user.id) {
        try {
          await supabase.from('gear_items').delete().eq('id', gearItemIdOrProductId).or(`product_id.eq.${gearItemIdOrProductId}`);
        } catch (err) {
          console.warn('[useEquipment] suppression gear_item impossible', err);
        }
      }
    },
    [user, supabase, triggerHaptic]
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
          console.warn('[useEquipment] mise a jour gear_item impossible', err);
        }
      }
    },
    [user, supabase, equipment, triggerHaptic]
  );

  // KIT CRUD
  const addKit = useCallback((kit: Kit) => {
    setKits((prev) => [...prev, kit]);
    if (!user) saveGuestKits([...kits, kit]);
    if (user && user.id) {
      Promise.resolve(supabase.from('kits').insert({ ...kit, user_id: user.id })).catch((e: unknown) => console.warn('[useEquipment] insertion kit impossible', e));
    }
  }, [user, supabase, kits]);

  const updateKit = useCallback((updatedKit: Kit) => {
    setKits((prev) => prev.map((k) => (k.id === updatedKit.id ? updatedKit : k)));
    if (!user) saveGuestKits(kits.map((k) => (k.id === updatedKit.id ? updatedKit : k)));
    if (user && user.id) {
      Promise.resolve(supabase.from('kits').update(updatedKit).eq('id', updatedKit.id)).catch((e: unknown) => console.warn('[useEquipment] mise a jour kit impossible', e));
    }
  }, [user, supabase, kits]);

  const removeKit = useCallback((kitId: string) => {
    setKits((prev) => prev.filter((k) => k.id !== kitId));
    if (!user) saveGuestKits(kits.filter((k) => k.id !== kitId));
    if (user && user.id) {
      Promise.resolve(supabase.from('kits').delete().eq('id', kitId)).catch((e: unknown) => console.warn('[useEquipment] suppression kit impossible', e));
    }
  }, [user, supabase, kits]);

  return {
    products,
    equipment,
    kits,
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
    addKit,
    updateKit,
    removeKit,
    refresh: loadData,
  };
}
