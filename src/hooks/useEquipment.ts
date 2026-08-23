'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCart, addToCart as addCartItem, removeFromCart as removeCartItem, updateQuantity as updateCartQty, CartItem } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { newId } from '@/lib/uuid';
import { Kit } from '@/types/kit';

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

export const FALLBACK_AUTHENTIC_PRODUCTS: UnifiedProduct[] = [
  {
    id: 'prod-osprey-farpoint-40',
    slug: 'osprey-farpoint-40-achat',
    name: 'Osprey Farpoint 40',
    brand: 'Osprey',
    category: 'Sacs à dos',
    category_main: 'Sacs à dos',
    weight_g: 1420,
    price_eur: 179,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    image_alt: 'Sac à dos Osprey Farpoint 40',
    rating: 4.8,
    review_count: 312,
    essentiality: 'indispensable',
    description: 'Le sac de voyage cabine par excellence, ultra polyvalent et confortable pour les treks et escapades.',
    stock: 15,
    is_active: true,
  },
  {
    id: 'prod-osprey-atmos-65',
    slug: 'osprey-atmos-ag-65-achat',
    name: 'Osprey Atmos AG 65',
    brand: 'Osprey',
    category: 'Sacs à dos',
    category_main: 'Sacs à dos',
    weight_g: 2180,
    price_eur: 349,
    image: 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80',
    image_alt: 'Sac à dos Osprey Atmos AG 65',
    rating: 4.9,
    review_count: 198,
    essentiality: 'recommande',
    description: 'Portage lourd avec suspension Anti-Gravity 3D pour les grandes expéditions en autonomie.',
    stock: 8,
    is_active: true,
  },
  {
    id: 'prod-msr-hubba-2p',
    slug: 'msr-hubba-hubba-nx-2-achat',
    name: 'MSR Hubba Hubba NX 2P',
    brand: 'MSR',
    category: 'Couchage',
    category_main: 'Couchage',
    weight_g: 1720,
    price_eur: 549,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    image_alt: 'Tente MSR Hubba Hubba NX 2 places',
    rating: 4.9,
    review_count: 198,
    essentiality: 'indispensable',
    description: 'La tente autoportante ultralégère référence pour 2 personnes en 3 saisons.',
    stock: 12,
    is_active: true,
  },
  {
    id: 'prod-sea-summit-spark-1',
    slug: 'sea-to-summit-spark-sp1-achat',
    name: 'Sea to Summit Spark SP1',
    brand: 'Sea to Summit',
    category: 'Couchage',
    category_main: 'Couchage',
    weight_g: 490,
    price_eur: 299,
    image: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80',
    image_alt: 'Sac de couchage Sea to Summit Spark SP1',
    rating: 4.7,
    review_count: 156,
    essentiality: 'indispensable',
    description: 'Duvet d\'oie 850+ loft ultraléger pour bivouacs estivaux et fastpacking.',
    stock: 10,
    is_active: true,
  },
  {
    id: 'prod-thermarest-neoair',
    slug: 'thermarest-neoair-xlite-achat',
    name: 'Therm-a-Rest NeoAir XLite',
    brand: 'Therm-a-Rest',
    category: 'Couchage',
    category_main: 'Couchage',
    weight_g: 340,
    price_eur: 219,
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80',
    image_alt: 'Matelas gonflable Therm-a-Rest NeoAir XLite',
    rating: 4.9,
    review_count: 312,
    essentiality: 'indispensable',
    description: 'R-value 4.2 pour seulement 340g, isolation thermique et confort de couchage absolu.',
    stock: 20,
    is_active: true,
  },
  {
    id: 'prod-patagonia-torrentshell',
    slug: 'patagonia-torrentshell-3l-achat',
    name: 'Patagonia Torrentshell 3L',
    brand: 'Patagonia',
    category: 'Vêtements',
    category_main: 'Vêtements',
    weight_g: 394,
    price_eur: 179,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80',
    image_alt: 'Veste imperméable Patagonia Torrentshell 3L',
    rating: 4.8,
    review_count: 245,
    essentiality: 'indispensable',
    description: 'Membrane H2No Performance Standard 3 couches 100% nylon recyclé, imperméabilité durable.',
    stock: 14,
    is_active: true,
  },
  {
    id: 'prod-petzl-actik',
    slug: 'petzl-actik-core-achat',
    name: 'Petzl Actik Core 450lm',
    brand: 'Petzl',
    category: 'Éclairage',
    category_main: 'Éclairage',
    weight_g: 85,
    price_eur: 49,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    image_alt: 'Lampe frontale Petzl Actik Core',
    rating: 4.6,
    review_count: 423,
    essentiality: 'indispensable',
    description: 'Lampe frontale rechargeable 450 lumens multi-faisceaux avec éclairage rouge.',
    stock: 25,
    is_active: true,
  },
  {
    id: 'prod-sawyer-mini',
    slug: 'sawyer-mini-achat',
    name: 'Filtre Sawyer Mini',
    brand: 'Sawyer',
    category: 'Hydratation',
    category_main: 'Hydratation',
    weight_g: 57,
    price_eur: 39,
    image: 'https://images.unsplash.com/photo-1527181152855-fc03fc7949c8?w=600&q=80',
    image_alt: 'Filtre à eau Sawyer Mini',
    rating: 4.8,
    review_count: 389,
    essentiality: 'indispensable',
    description: 'Filtre 0.1 micron absolu, élimine 99.99999% des bactéries et protozoaires.',
    stock: 30,
    is_active: true,
  },
  {
    id: 'prod-msr-pocketrocket-2',
    slug: 'msr-pocketrocket-2-achat',
    name: 'MSR PocketRocket 2',
    brand: 'MSR',
    category: 'Cuisine',
    category_main: 'Cuisine',
    weight_g: 73,
    price_eur: 49,
    image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=600&q=80',
    image_alt: 'Réchaud gaz MSR PocketRocket 2',
    rating: 4.9,
    review_count: 278,
    essentiality: 'indispensable',
    description: 'Réchaud à gaz ultracompact et puissant (1L bouilli en 3.5 min).',
    stock: 18,
    is_active: true,
  },
  {
    id: 'prod-garmin-inreach',
    slug: 'garmin-inreach-mini-2-achat',
    name: 'Garmin inReach Mini 2',
    brand: 'Garmin',
    category: 'Navigation',
    category_main: 'Navigation',
    weight_g: 100,
    price_eur: 399,
    image: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80',
    image_alt: 'Balise satellite Garmin inReach Mini 2',
    rating: 4.9,
    review_count: 145,
    essentiality: 'recommande',
    description: 'Balise de communication satellite bidirectionnelle avec SOS interactif mondial 24/7.',
    stock: 6,
    is_active: true,
  },
  {
    id: 'prod-opinel-n8',
    slug: 'opinel-n8-inox-achat',
    name: 'Couteau Opinel N°8 Inox',
    brand: 'Opinel',
    category: 'Autre',
    category_main: 'Autre',
    weight_g: 45,
    price_eur: 14.5,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=600&q=80',
    image_alt: 'Couteau de poche Opinel N°8 Inox',
    rating: 4.9,
    review_count: 512,
    essentiality: 'indispensable',
    description: 'Lame inox Sandvik 12C27 et manche en hêtre verni, virole de sécurité Virobloc.',
    stock: 50,
    is_active: true,
  },
  {
    id: 'prod-care-plus-first-aid',
    slug: 'care-plus-first-aid-kit-mountaineer-achat',
    name: 'Trousse Care Plus Mountaineer',
    brand: 'Care Plus',
    category: 'Sécurité',
    category_main: 'Sécurité',
    weight_g: 450,
    price_eur: 49.9,
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&q=80',
    image_alt: 'Trousse de premiers secours Care Plus',
    rating: 4.7,
    review_count: 88,
    essentiality: 'indispensable',
    description: 'Kit de secours médical complet pour haute montagne et expéditions engagées.',
    stock: 12,
    is_active: true,
  },
  {
    id: 'prod-anker-10000',
    slug: 'anker-powercore-10000-achat',
    name: 'Batterie Anker PowerCore 10 000',
    brand: 'Anker',
    category: 'Autre',
    category_main: 'Autre',
    weight_g: 180,
    price_eur: 29.99,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80',
    image_alt: 'Batterie externe Anker 10000mAh',
    rating: 4.8,
    review_count: 640,
    essentiality: 'recommande',
    description: 'Compacte et légère, charge rapide PowerIQ pour téléphones, montres et frontales.',
    stock: 22,
    is_active: true,
  },
];

const INITIAL_AUTHENTIC_GUEST_EQUIPMENT: UserEquipmentItem[] = [
  {
    id: 'gear-osprey-40',
    user_id: 'guest',
    product_id: 'prod-osprey-farpoint-40',
    name: 'Osprey Farpoint 40',
    brand: 'Osprey',
    category: 'Sacs & Portage',
    weight_g: 1420,
    purchase_price: 179,
    condition: 'excellent',
    source: 'achat',
    usage_count: 24,
    notes: 'Réglage dorsal ajusté. Housse de pluie rangée dans la poche inférieure.',
    is_favorite: true,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    ref_code: 'OSP-FP40-2024',
  },
  {
    id: 'gear-msr-hubba',
    user_id: 'guest',
    product_id: 'prod-msr-hubba-2p',
    name: 'MSR Hubba Hubba NX 2P',
    brand: 'MSR',
    category: 'Couchage & Tentes',
    weight_g: 1720,
    purchase_price: 549,
    condition: 'excellent',
    source: 'achat',
    usage_count: 18,
    notes: 'Double toit réimperméabilisé en mai. Arceaux DAC impeccables.',
    is_favorite: true,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
  },
  {
    id: 'gear-sea-summit-spark',
    user_id: 'guest',
    product_id: 'prod-sea-summit-spark-1',
    name: 'Sea to Summit Spark SP1',
    brand: 'Sea to Summit',
    category: 'Couchage & Tentes',
    weight_g: 490,
    purchase_price: 299,
    condition: 'excellent',
    source: 'achat',
    usage_count: 14,
    notes: 'Duvet stocké non compressé dans son sac de rangement aéré.',
    is_favorite: true,
    image: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80',
  },
  {
    id: 'gear-thermarest-neoair',
    user_id: 'guest',
    product_id: 'prod-thermarest-neoair',
    name: 'Therm-a-Rest NeoAir XLite',
    brand: 'Therm-a-Rest',
    category: 'Couchage & Tentes',
    weight_g: 340,
    purchase_price: 219,
    condition: 'bon',
    source: 'achat',
    usage_count: 32,
    notes: 'Valve WingLock vérifiée. Kit rustines dans la pochette.',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80',
  },
  {
    id: 'gear-patagonia-jacket',
    user_id: 'guest',
    product_id: 'prod-patagonia-torrentshell',
    name: 'Patagonia Torrentshell 3L',
    brand: 'Patagonia',
    category: 'Vêtements & Vestes',
    weight_g: 394,
    purchase_price: 179,
    condition: 'excellent',
    source: 'achat',
    usage_count: 16,
    notes: 'Taille M. Traitement DWR Nikwax renouvelé.',
    is_favorite: true,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80',
  },
  {
    id: 'gear-petzl-actik',
    user_id: 'guest',
    product_id: 'prod-petzl-actik',
    name: 'Petzl Actik Core 450lm',
    brand: 'Petzl',
    category: 'Lampes & Éclairage',
    weight_g: 85,
    purchase_price: 49,
    condition: 'bon',
    source: 'achat',
    usage_count: 45,
    notes: 'Batterie Core rechargeable micro-USB. 34% de charge.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  },
  {
    id: 'gear-sawyer-mini',
    user_id: 'guest',
    product_id: 'prod-sawyer-mini',
    name: 'Filtre Sawyer Mini',
    brand: 'Sawyer',
    category: 'Eau & Filtres',
    weight_g: 57,
    purchase_price: 39,
    condition: 'excellent',
    source: 'achat',
    usage_count: 22,
    notes: 'Nettoyé à contre-courant après chaque sortie. Seringue incluse.',
    image: 'https://images.unsplash.com/photo-1527181152855-fc03fc7949c8?w=600&q=80',
  },
  {
    id: 'gear-msr-rechaud',
    user_id: 'guest',
    product_id: 'prod-msr-pocketrocket-2',
    name: 'MSR PocketRocket 2',
    brand: 'MSR',
    category: 'Cuisine & Réchauds',
    weight_g: 73,
    purchase_price: 49,
    condition: 'excellent',
    source: 'achat',
    usage_count: 28,
    notes: 'Boîtier rigide de transport inclus.',
    image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=600&q=80',
  },
  {
    id: 'gear-garmin-inreach',
    user_id: 'guest',
    product_id: 'prod-garmin-inreach',
    name: 'Garmin inReach Mini 2',
    brand: 'Garmin',
    category: 'Navigation & GPS',
    weight_g: 100,
    purchase_price: 399,
    condition: 'neuf',
    source: 'achat',
    usage_count: 8,
    notes: 'Abonnement satellite actif. Synchronisé avec l\'app Garmin Explore.',
    is_favorite: true,
    image: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80',
  },
  {
    id: 'gear-opinel-8',
    user_id: 'guest',
    product_id: 'prod-opinel-n8',
    name: 'Couteau Opinel N°8 Inox',
    brand: 'Opinel',
    category: 'Accessoires & Outils',
    weight_g: 45,
    purchase_price: 14.5,
    condition: 'bon',
    source: 'achat',
    usage_count: 60,
    notes: 'Lame affûtée.',
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=600&q=80',
  },
  {
    id: 'gear-careplus-kit',
    user_id: 'guest',
    product_id: 'prod-care-plus-first-aid',
    name: 'Trousse Care Plus Mountaineer',
    brand: 'Care Plus',
    category: 'Sécurité & Soins',
    weight_g: 450,
    purchase_price: 49.9,
    condition: 'excellent',
    source: 'achat',
    usage_count: 12,
    notes: 'Date de péremption des pansements vérifiée le 12 août 2026.',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&q=80',
  },
  {
    id: 'gear-anker-powerbank',
    user_id: 'guest',
    product_id: 'prod-anker-10000',
    name: 'Batterie Anker PowerCore 10 000',
    brand: 'Anker',
    category: 'Accessoires & Outils',
    weight_g: 180,
    purchase_price: 29.99,
    condition: 'excellent',
    source: 'achat',
    usage_count: 35,
    notes: 'Permet 2.5 recharges de smartphone et 4 recharges de frontale.',
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80',
  },
];

function getGuestGear(): UserEquipmentItem[] {
  if (typeof window === 'undefined') return INITIAL_AUTHENTIC_GUEST_EQUIPMENT;
  try {
    const raw = localStorage.getItem(GUEST_GEAR_STORAGE_KEY);
    if (!raw) {
      saveGuestGear(INITIAL_AUTHENTIC_GUEST_EQUIPMENT);
      return INITIAL_AUTHENTIC_GUEST_EQUIPMENT;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_AUTHENTIC_GUEST_EQUIPMENT;
  } catch {
    return INITIAL_AUTHENTIC_GUEST_EQUIPMENT;
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
  } catch { /* ignore */ }
}

export function useEquipment() {
  const { user } = useAuth();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState<UnifiedProduct[]>(FALLBACK_AUTHENTIC_PRODUCTS);
  const [equipment, setEquipment] = useState<UserEquipmentItem[]>(INITIAL_AUTHENTIC_GUEST_EQUIPMENT);
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
      // 1. Chargement réel depuis Supabase shop_products
      const { data: prodData, error: prodErr } = await supabase
        .from('shop_products')
        .select('*')
        .order('name', { ascending: true });

      if (!prodErr && prodData && prodData.length > 0) {
        const formattedProducts: UnifiedProduct[] = prodData.map((p: any) => ({
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
      } else {
        setProducts(FALLBACK_AUTHENTIC_PRODUCTS);
      }

      // 2. Chargement de l'équipement possédé
      if (user && user.id) {
        const { data: gearData, error: gearErr } = await supabase
          .from('gear_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!gearErr && gearData && gearData.length > 0) {
          setEquipment(gearData as UserEquipmentItem[]);
        } else {
          setEquipment(getGuestGear());
        }

        // Load kits for the user
        const { data: kitData, error: kitErr } = await supabase
          .from('kits')
          .select('*')
          .eq('user_id', user.id);
        if (!kitErr && kitData && kitData.length > 0) {
          setKits(kitData as Kit[]);
        } else {
          setKits([]);
        }
      } else {
        setEquipment(getGuestGear());
        setKits(getGuestKits());
      }

      syncCart();
    } catch (err: any) {
      console.warn('Chargement fallback équipement:', err);
      setProducts(FALLBACK_AUTHENTIC_PRODUCTS);
      setEquipment(getGuestGear());
      setKits(getGuestKits());
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
      const generatedId = newId();
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
          console.warn('Erreur suppression gear_item:', err);
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
          console.warn('Erreur update gear_item:', err);
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
      Promise.resolve(supabase.from('kits').insert({ ...kit, user_id: user.id })).catch((e: unknown) => console.warn('Kit insert error', e));
    }
  }, [user, supabase, kits]);

  const updateKit = useCallback((updatedKit: Kit) => {
    setKits((prev) => prev.map((k) => (k.id === updatedKit.id ? updatedKit : k)));
    if (!user) saveGuestKits(kits.map((k) => (k.id === updatedKit.id ? updatedKit : k)));
    if (user && user.id) {
      Promise.resolve(supabase.from('kits').update(updatedKit).eq('id', updatedKit.id)).catch((e: unknown) => console.warn('Kit update error', e));
    }
  }, [user, supabase, kits]);

  const removeKit = useCallback((kitId: string) => {
    setKits((prev) => prev.filter((k) => k.id !== kitId));
    if (!user) saveGuestKits(kits.filter((k) => k.id !== kitId));
    if (user && user.id) {
      Promise.resolve(supabase.from('kits').delete().eq('id', kitId)).catch((e: unknown) => console.warn('Kit delete error', e));
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
