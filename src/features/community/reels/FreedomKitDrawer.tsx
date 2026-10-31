'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Check,
  MapPin,
  Sparkles,
  Layers,
  LayoutGrid,
  Bookmark,
  Tent,
  Package,
  Droplets,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useToast } from '@/contexts/ToastContext';
import { useDragDismiss } from '@/hooks/gestures';
import { SubCapsuleTabs } from '@/components/ui/CapsuleTabs';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { createClient } from '@/lib/supabase/client';
import type { KitSheetData } from '@/features/kits/types';

export interface FreedomKitDrawerProps {
  isOpen: boolean;
  kitId: string;
  initialName?: string;
  onClose: () => void;
}

export interface RealProductItem {
  id: string;
  name: string;
  brand?: string | null;
  category: string;
  image: string;
  weight_g: number;
  price_eur?: number | null;
}

const FALLBACK_REAL_PRODUCTS: RealProductItem[] = [
  {
    id: '82fa4b02-71c5-4871-8b48-93dbb442d2d0',
    name: 'Tente de Camping 2 Personnes Pro Ultralight',
    brand: 'BigBuy Outdoor',
    category: 'Bivouac / Sommeil',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/tente-de-camping-2-personnes-categorie-bigbuy/01.jpg',
    weight_g: 2000,
    price_eur: 75,
  },
  {
    id: '72c47eb4-b821-4ec0-be80-48a5922d2829',
    name: 'Tente Abri / Bâche de Survie Réfléchissante',
    brand: 'BigBuy Outdoor',
    category: 'Bivouac / Sommeil',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/tente-abri-bache-de-survie-categorie-bigbuy/01.jpg',
    weight_g: 500,
    price_eur: 35,
  },
  {
    id: '5f941fb5-ef05-45c1-a57c-fdf376bea25f',
    name: 'Sac de Couchage Compressible Grand Froid',
    brand: 'Tineo Outdoor',
    category: 'Bivouac / Sommeil',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/sac-de-couchage-enfant-tineo-summer-tifruits-6-mois-coton/01.jpg',
    weight_g: 700,
    price_eur: 32,
  },
  {
    id: 'a33c85dd-7f10-4eda-b33d-cf7f13e5417c',
    name: 'Sac à Dos de Randonnée Ergonomique 45L',
    brand: 'BigBuy Outdoor',
    category: 'Équipement du sac',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/sac-a-dos-de-randonnee-categorie-bigbuy/01.jpg',
    weight_g: 800,
    price_eur: 55,
  },
  {
    id: 'e65a2dd0-509d-41ae-bc32-148dbd45849a',
    name: 'Organiseur de Sac & Housses de Compression Étanches',
    brand: 'Luggan Outdoor',
    category: 'Équipement du sac',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/organiseur-voyage-suitcase-organiser-luggan-innovagoods-6-pieces/01.jpg',
    weight_g: 100,
    price_eur: 12,
  },
  {
    id: '649ebc6b-9e65-4256-8c31-983a7617a38d',
    name: 'Poncho Imperméable Respirant Coupe-Vent',
    brand: 'BigBuy Outdoor',
    category: 'Vêtements / Protection',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/sac-a-dos-de-randonnee-categorie-bigbuy/01.jpg',
    weight_g: 150,
    price_eur: 12,
  },
  {
    id: 'fbf49688-757f-4bb5-86ec-f347e8d95f1b',
    name: 'Gourde Thermos Isotherme Acier Inoxydable',
    brand: 'BigBuy Outdoor',
    category: 'Hydratation',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/tasse-thermos-avec-couvercle-fc-barcelona-acier-inoxydable/01.jpg',
    weight_g: 150,
    price_eur: 14,
  },
  {
    id: '3f812f18-7b26-4a5d-8d07-a70ff6b46f0f',
    name: 'Système d’Hydratation Flasque Souple & Filtre',
    brand: 'BigBuy Outdoor',
    category: 'Hydratation',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/sac-a-dos-hydratation-bouteille-deau-spider-man-410-ml/01.jpg',
    weight_g: 220,
    price_eur: 45,
  },
  {
    id: '0ce62ae3-6398-48d4-be3a-de2ff265c26f',
    name: 'Lampe Frontale LED Rechargeable Spot 400',
    brand: 'Black Diamond',
    category: 'Sécurité / Éclairage',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/lampe-frontale-led-rechargeable-black-diamond-spot-400/01.jpg',
    weight_g: 90,
    price_eur: 75,
  },
  {
    id: 'e4c51d60-99ad-46e2-bf10-7a2ff701e61f',
    name: 'Trousse Premiers Secours & Répulsif Montagne',
    brand: 'Relec Pro',
    category: 'Sécurité / Éclairage',
    image: 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/product-images/anti-moustique-relec-373445-spray-repulsif/01.jpg',
    weight_g: 100,
    price_eur: 10,
  },
];

const USAGE_LOCATIONS = [
  { name: 'Arête des Cosmiques · Mont-Blanc', alt: '3 842 m', sessions: 18, coords: [6.887, 45.877] },
  { name: 'Cirque de Gavarnie · Pyrénées', alt: '2 400 m', sessions: 14, coords: [-0.007, 42.695] },
  { name: 'Gorges du Verdon · Provence', alt: '950 m', sessions: 9, coords: [6.388, 43.742] },
  { name: 'Plateau de l’Aubrac · Massif Central', alt: '1 280 m', sessions: 7, coords: [3.033, 44.621] },
  { name: 'Tre Cime di Lavaredo · Dolomites', alt: '2 999 m', sessions: 12, coords: [12.300, 46.618] },
  { name: 'Fitz Roy · Patagonie', alt: '3 405 m', sessions: 5, coords: [-73.043, -49.271] },
  { name: 'Yosemite Valley · Sierra Nevada', alt: '1 219 m', sessions: 8, coords: [-119.593, 37.745] },
  { name: 'Annapurna Circuit · Himalaya', alt: '5 416 m', sessions: 6, coords: [83.882, 28.797] },
];

/**
 * Product Detail Drawer réutilisant l'ergonomie et le design de KitCard (page compte)
 */
function FreedomProductDetailDrawer({
  product,
  products,
  kitName,
  totalKitWeight,
  onClose,
  onSelectProduct,
}: {
  product: RealProductItem;
  products: RealProductItem[];
  kitName: string;
  totalKitWeight: number;
  onClose: () => void;
  onSelectProduct: (prod: RealProductItem) => void;
}) {
  const { haptic } = useHapticFeedback();
  const currentIndex = Math.max(0, products.findIndex((p) => p.id === product.id));

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'handle',
    threshold: 70,
    velocityThreshold: 300,
  });

  const goProduct = (delta: number) => {
    haptic('selection');
    const nextIdx = (currentIndex + delta + products.length) % products.length;
    onSelectProduct(products[nextIdx]);
  };

  const weightPercent =
    totalKitWeight > 0 && product.weight_g
      ? Math.round((product.weight_g / totalKitWeight) * 100)
      : null;

  return (
    <div
      className="freedom-drawer-backdrop !z-[10010]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche produit : ${product.name}`}
    >
      <div className="freedom-drawer-scrim" onClick={onClose} />
      <motion.div
        {...dragProps}
        style={{ y }}
        className="freedom-drawer-sheet !h-[76vh] !max-h-[82dvh] !z-[10011] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée pour fermer en glissant vers le bas */}
        <div
          className="freedom-drawer-grab cursor-grab active:cursor-grabbing"
          {...handleProps}
          onClick={onClose}
          aria-label="Fermer la fiche produit"
        >
          <span />
        </div>

        {/* Détails du produit inspiré de KitCard */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          {/* Visuel du produit avec flèches précédent / suivant */}
          <div className="relative overflow-hidden rounded-2xl bg-black/5 border border-white/60 aspect-[4/3] flex items-center justify-center shadow-inner">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- product detail image
              <img
                src={product.image}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <Package size={48} className="text-black/20" />
            )}

            {products.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goProduct(-1)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-white/80 border border-white/90 text-[#17402C] shadow-md backdrop-blur-md transition active:scale-90"
                  aria-label="Produit précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => goProduct(1)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-white/80 border border-white/90 text-[#17402C] shadow-md backdrop-blur-md transition active:scale-90"
                  aria-label="Produit suivant"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                  {currentIndex + 1}/{products.length}
                </span>
              </>
            )}
          </div>

          {/* Titres & Badges */}
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-[#172B24] leading-tight">
              {product.name}
            </h3>
            {product.brand && (
              <p className="text-xs font-semibold text-[#56665D]">
                {product.brand} · {product.category}
              </p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="rounded-full bg-[#17402C]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#17402C]">
                {product.category}
              </span>
              <span className="rounded-full bg-[#96BA8E]/25 px-2.5 py-0.5 text-[10px] font-bold text-[#17402C]">
                Recommandé
              </span>
              <span className="rounded-full bg-[#C9A34A]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#6B5217]">
                Vital
              </span>
            </div>
          </div>

          <p className="text-xs text-[#56665D]">
            Dans {kitName} · 1 pièce
            {weightPercent ? ` · ${weightPercent} % du poids du kit` : ''}
          </p>

          {/* Caractéristiques */}
          <div className="space-y-2 pt-1">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#56665D]">
              Caractéristiques
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-black/5 p-2.5">
                <span className="block text-[10px] text-black/50">Poids</span>
                <b className="text-[#172B24] font-mono">
                  {product.weight_g >= 1000
                    ? `${(product.weight_g / 1000).toFixed(2)} kg`
                    : `${product.weight_g} g`}
                </b>
              </div>
              <div className="rounded-xl bg-black/5 p-2.5">
                <span className="block text-[10px] text-black/50">Quantité</span>
                <b className="text-[#172B24]">×1</b>
              </div>
              <div className="rounded-xl bg-black/5 p-2.5">
                <span className="block text-[10px] text-black/50">État</span>
                <b className="text-[#172B24]">Excellent</b>
              </div>
              {product.price_eur ? (
                <div className="rounded-xl bg-black/5 p-2.5">
                  <span className="block text-[10px] text-black/50">Prix estimé</span>
                  <b className="text-[#172B24] font-mono">{product.price_eur} €</b>
                </div>
              ) : null}
            </div>
          </div>

          {/* Notes techniques */}
          <div className="space-y-1 pt-1">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#56665D]">
              Notes terrain
            </h4>
            <p className="text-xs text-[#56665D] leading-relaxed">
              Matériel éprouvé sur les sorties haute altitude et bivouacs 4 saisons.
              Validé pour résistance au vent, compacité et étanchéité.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Full Drawer Carte en vue monde : aucun bouton nulle part,
 * uniquement la poignée en haut pour fermer et les points sur la carte.
 */
function FreedomKitUsageMapFullDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { haptic } = useHapticFeedback();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'handle',
    threshold: 75,
    velocityThreshold: 350,
  });

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    let mapInstance: any = null;
    let isCancelled = false;

    import('maplibre-gl').then(({ Map, Marker }) => {
      if (isCancelled || !mapContainerRef.current) return;

      try {
        const style = createMapStyle('satellite');
        mapInstance = new Map({
          container: mapContainerRef.current,
          style: style,
          center: [15, 30],
          zoom: 1.8,
          attributionControl: false,
        });

        mapInstance.on('load', () => {
          if (isCancelled) return;
          setMapLoaded(true);
          // Affiche UNIQUEMENT les points du kit sur la carte, strictement aucun texte ni label
          for (const loc of USAGE_LOCATIONS) {
            const markerDiv = document.createElement('div');
            markerDiv.className = 'relative flex items-center justify-center pointer-events-none select-none';
            markerDiv.innerHTML = `
              <span class="absolute size-4.5 rounded-full bg-lkv-success opacity-50 animate-ping"></span>
              <span class="relative size-3 rounded-full bg-lkv-success border-2 border-white shadow-live-dot"></span>
            `;
            new Marker({ element: markerDiv })
              .setLngLat([loc.coords[0], loc.coords[1]])
              .addTo(mapInstance);
          }
        });
      } catch (err) {
        console.warn('[FreedomKitUsageMapFullDrawer] MapLibre fallback:', err);
      }
    });

    return () => {
      isCancelled = true;
      mapInstance?.remove();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop !z-[10010]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Carte des utilisations du kit dans le monde"
    >
      <div className="freedom-drawer-scrim" onClick={onClose} />
      <motion.div
        {...dragProps}
        style={{ y }}
        className="freedom-drawer-sheet !h-[94vh] !max-h-[96dvh] !z-[10011] overflow-hidden flex flex-col p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée UNIQUE pour fermer en glissant vers le bas (Strictement aucun autre bouton) */}
        <div
          className="freedom-drawer-grab cursor-grab active:cursor-grabbing !z-30 shrink-0"
          {...handleProps}
          onClick={onClose}
          aria-label="Fermer la carte"
        >
          <span />
        </div>

        {/* Vue monde plein drawer avec UNIQUEMENT les points d'utilisation du kit */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-[#15231c]">
          <div ref={mapContainerRef} className="size-full" />

          {/* Points fallback si WebGL indisponible (uniquement les points, aucun texte) */}
          {!mapLoaded && (
            <div className="absolute inset-0 pointer-events-none">
              {USAGE_LOCATIONS.map((loc, idx) => {
                const xPercent = ((loc.coords[0] + 180) / 360) * 100;
                const yPercent = ((90 - loc.coords[1]) / 180) * 100;
                return (
                  <div
                    key={idx}
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                  >
                    <div className="relative flex items-center justify-center">
                      <span className="absolute size-4.5 rounded-full bg-lkv-success opacity-50 animate-ping" />
                      <span className="relative size-3 rounded-full bg-lkv-success border-2 border-white shadow-live-dot" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export const FreedomKitDrawer: React.FC<FreedomKitDrawerProps> = ({
  isOpen,
  kitId,
  initialName,
  onClose,
}) => {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const { toast } = useToast();

  const [kitData, setKitData] = useState<KitSheetData | null>(null);
  const [products, setProducts] = useState<RealProductItem[]>(FALLBACK_REAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('Pas trié');
  const [showUsageMap, setShowUsageMap] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RealProductItem | null>(null);
  const [isAdded, setIsAdded] = useState(false);

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'handle',
    threshold: 75,
    velocityThreshold: 350,
  });

  // Load kit details from DB and products from shop_products
  useEffect(() => {
    if (!isOpen) return;

    let alive = true;
    const supabase = createClient();

    // 1. Fetch real kit from DB
    fetch(`/api/kits/${kitId}/sheet`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive) return;
        if (data) setKitData(data);
      })
      .catch(() => {});

    // 2. Fetch real products from shop_products with image
    const loadProducts = async () => {
      try {
        const { data: sp } = await supabase
          .from('shop_products')
          .select('id, name, brand, category, image, weight_g, price_eur')
          .not('image', 'is', null)
          .neq('image', '')
          .limit(20);

        if (!alive) return;
        if (sp && sp.length > 0) {
          const mapped: RealProductItem[] = sp.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: p.category || 'Équipement',
            image: p.image,
            weight_g: p.weight_g || 150,
            price_eur: p.price_eur,
          }));
          setProducts(mapped);
        }
      } catch (err) {
        console.warn('[FreedomKitDrawer] Error loading products:', err);
      }
    };
    void loadProducts();

    return () => {
      alive = false;
    };
  }, [isOpen, kitId]);

  if (!isOpen) return null;

  const kitName = kitData?.kit?.name || initialName || 'Kit Aventure Outdoor';
  const lineageRoot = kitData?.kit?.parent_name || 'Souche Fondatrice LKDV';
  const generation = kitData?.kit?.generation ? `Génération ${kitData.kit.generation}` : 'Génération 1';

  // Available categories for selector
  const rawCategories = Array.from(new Set(products.map((p) => p.category)));

  // Build items for real SubCapsuleTabs selector (icônes seules, identique à celui de la page compte)
  const categorySelectorItems = [
    { id: 'all', label: '', icon: <LayoutGrid size={15} /> },
    ...rawCategories.slice(0, 4).map((cat) => {
      const lower = cat.toLowerCase();
      const icon = lower.includes('bivouac') || lower.includes('sommeil') ? (
        <Tent size={15} />
      ) : lower.includes('sac') || lower.includes('équipement') ? (
        <Package size={15} />
      ) : lower.includes('hydrat') ? (
        <Droplets size={15} />
      ) : lower.includes('sécu') || lower.includes('éclair') ? (
        <Shield size={15} />
      ) : (
        <Layers size={15} />
      );

      return {
        id: cat,
        label: '',
        icon,
      };
    }),
  ];

  const activeCategoryIndex =
    selectedCategory === 'Pas trié'
      ? 0
      : Math.max(0, categorySelectorItems.findIndex((item) => item.id === selectedCategory));

  const displayedProducts =
    selectedCategory === 'Pas trié'
      ? products
      : products.filter((p) => p.category === selectedCategory);

  // Group displayed products by category if "Pas trié"
  const groupedProducts: Record<string, RealProductItem[]> = {};
  if (selectedCategory === 'Pas trié') {
    for (const p of displayedProducts) {
      if (!groupedProducts[p.category]) groupedProducts[p.category] = [];
      groupedProducts[p.category].push(p);
    }
  } else {
    groupedProducts[selectedCategory] = displayedProducts;
  }

  const totalKitWeight = products.reduce((acc, p) => acc + (p.weight_g || 0), 0);

  const handleAddToMyKits = () => {
    haptic('success');
    setIsAdded(true);

    try {
      const saved = JSON.parse(localStorage.getItem('lkdv_saved_kits') || '[]');
      if (!saved.includes(kitId)) {
        saved.push(kitId);
        localStorage.setItem('lkdv_saved_kits', JSON.stringify(saved));
      }
    } catch (e) {
      console.warn('[Freedom] Local storage write error:', e);
    }

    // Show notification leading directly to the kit drawer in the compte page
    toast(
      'Kit ajouté à vos kits ! Tapez pour voir dans votre compte →',
      'success',
    );

    // Navigate to compte page with kits drawer open
    setTimeout(() => {
      onClose();
      router.push('/compte?tab=kits');
    }, 900);
  };

  return (
    <>
      <div
        className="freedom-drawer-container"
        role="dialog"
        aria-modal="true"
        aria-label={`Détails du kit ${kitName}`}
      >
        {/* Background Scrim */}
        <div className="freedom-drawer-scrim" onClick={onClose} />

        {/* Drawer Card with fluid drag dismiss */}
        <motion.div
          {...dragProps}
          style={{ y }}
          className="freedom-drawer-card relative flex flex-col h-[78vh] max-h-[82dvh] overflow-hidden"
        >
          {/* Pull Grab Bar */}
          <div
            className="freedom-drawer-grab cursor-grab active:cursor-grabbing"
            {...handleProps}
            onClick={onClose}
            aria-label="Fermer le kit"
          >
            <span />
          </div>

          {/* Header: Title + Lineage Only (No close cross 'X') */}
          <div className="px-4 pb-3 border-b border-black/5 shrink-0" {...handleProps}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#17402C]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#17402C]">
                <Sparkles size={11} className="text-[#17402C]" />
                Lignée LKDV · {generation}
              </span>
              <span className="text-[11px] font-medium text-black/50 truncate">
                {lineageRoot}
              </span>
            </div>

            <h2 className="text-lg font-extrabold text-[#172B24] leading-snug">
              {kitName}
            </h2>

            {/* Button: Voir où ce kit a été utilisé (ouvre le full drawer carte en vue monde) */}
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setShowUsageMap(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#17402C]/20 bg-[#17402C]/5 px-3 py-1.5 text-xs font-semibold text-[#17402C] transition active:scale-95"
              >
                <Compass size={13} />
                <span>Voir où ce kit a été utilisé</span>
              </button>
            </div>
          </div>

          {/* Products List Separated by Category — scrolls freely all the way to the bottom */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-20">
            {Object.entries(groupedProducts).map(([catName, catItems]) => (
              <div key={catName} className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#17402C] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#17402C]" />
                  <span>{catName}</span>
                  <span className="text-black/40 font-normal">({catItems.length})</span>
                </div>

                <div className="space-y-2">
                  {catItems.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setSelectedProduct(prod);
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 p-2.5 shadow-xs backdrop-blur-xl transition hover:border-[#17402C]/30 hover:bg-white/95 active:scale-[0.98] text-left cursor-pointer"
                      aria-label={`Détails du produit ${prod.name}`}
                    >
                      {/* Product Image from DB */}
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-black/5 border border-black/5 shadow-inner">
                        {prod.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- DB product storage image
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-black/30">
                            <Layers size={18} />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#172B24] truncate leading-tight">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-black/50 truncate mt-0.5">
                          {prod.brand || prod.category}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#172B24]">
                            {prod.weight_g >= 1000
                              ? `${(prod.weight_g / 1000).toFixed(2)} kg`
                              : `${prod.weight_g} g`}
                          </span>
                          {prod.price_eur ? (
                            <span className="text-[10px] font-medium text-black/60">
                              {prod.price_eur} €
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Floating Real Mini Selector in Bottom Right (identique à celui de la page compte) */}
          <div className="absolute right-14 bottom-3.5 z-20">
            <SubCapsuleTabs
              items={categorySelectorItems}
              activeIndex={activeCategoryIndex}
              onIndexChange={(idx) => {
                const item = categorySelectorItems[idx];
                setSelectedCategory(item ? item.id === 'all' ? 'Pas trié' : item.id : 'Pas trié');
              }}
              ariaLabel="Filtrer par catégorie"
              placement="inline"
            />
          </div>

          {/* Floating Bookmark Pill in Bottom Right */}
          <button
            type="button"
            onClick={handleAddToMyKits}
            aria-label="Enregistrer dans mes kits"
            className={`absolute right-3.5 bottom-3.5 z-20 flex size-9 items-center justify-center rounded-full border border-white/80 shadow-glass-control backdrop-blur-2xl transition active:scale-90 ${
              isAdded
                ? 'bg-[#17402C] text-white'
                : 'bg-white/85 text-[#17402C] hover:bg-white'
            }`}
          >
            {isAdded ? (
              <Check size={16} strokeWidth={2.4} />
            ) : (
              <Bookmark size={16} strokeWidth={2} />
            )}
          </button>
        </motion.div>
      </div>

      {/* Product Detail Drawer réutilisant l'existant de la page compte */}
      <AnimatePresence>
        {selectedProduct && (
          <FreedomProductDetailDrawer
            product={selectedProduct}
            products={displayedProducts}
            kitName={kitName}
            totalKitWeight={totalKitWeight}
            onClose={() => setSelectedProduct(null)}
            onSelectProduct={setSelectedProduct}
          />
        )}
      </AnimatePresence>

      {/* Full Drawer Carte en vue monde (aucun bouton, seulement poignée haut & points) */}
      <AnimatePresence>
        {showUsageMap && (
          <FreedomKitUsageMapFullDrawer
            isOpen={showUsageMap}
            onClose={() => setShowUsageMap(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default FreedomKitDrawer;
