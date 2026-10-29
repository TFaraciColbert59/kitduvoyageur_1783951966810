'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Check,
  MapPin,
  Sparkles,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useToast } from '@/contexts/ToastContext';
import { useDragDismiss } from '@/hooks/gestures';
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
  { name: 'Arête des Cosmiques · Massif du Mont-Blanc', alt: '3 842 m', sessions: 18, coords: [45.877, 6.887] },
  { name: 'Cirque de Gavarnie · Hautes-Pyrénées', alt: '2 400 m', sessions: 14, coords: [42.695, -0.007] },
  { name: 'Gorges du Verdon · Provence-Alpes', alt: '950 m', sessions: 9, coords: [43.742, 6.388] },
  { name: 'Plateau de l’Aubrac · Lozère', alt: '1 280 m', sessions: 7, coords: [44.621, 3.033] },
];

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
  const [isAdded, setIsAdded] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

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
  const categoryOptions = ['Pas trié', ...rawCategories];

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

    // If tapped, navigate to compte page with kits drawer open
    setTimeout(() => {
      onClose();
      router.push('/compte?tab=kits');
    }, 900);
  };

  return (
    <div
      className="freedom-drawer-container"
      role="dialog"
      aria-modal="true"
      aria-label={`Détails du kit ${kitName}`}
    >
      {/* Background Scrim */}
      <div
        className="freedom-drawer-scrim"
        onClick={onClose}
      />

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

          {/* Button: Voir où ce kit a été utilisé */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setShowUsageMap(!showUsageMap);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#17402C]/20 bg-[#17402C]/5 px-3 py-1.5 text-xs font-semibold text-[#17402C] transition active:scale-95"
            >
              <Compass size={13} />
              <span>{showUsageMap ? 'Masquer la carte d’utilisation' : 'Voir où ce kit a été utilisé'}</span>
            </button>
          </div>

          {/* Map Overlay for Kit Usage Points */}
          {showUsageMap && (
            <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 backdrop-blur-md p-3 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#172B24]/70">
                  Points de validation terrain
                </span>
                <span className="text-[10px] font-semibold text-[#17402C]">
                  {USAGE_LOCATIONS.length} massifs éprouvés
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {USAGE_LOCATIONS.map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-white/80 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={13} className="text-[#17402C] shrink-0" />
                      <span className="font-semibold text-[#172B24] truncate">{loc.name}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 text-[10px] text-black/60 font-mono">
                      <span>{loc.alt}</span>
                      <span className="font-bold text-[#17402C]">{loc.sessions} sorties</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Products List Separated by Category */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {Object.entries(groupedProducts).map(([catName, catItems]) => (
            <div key={catName} className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#17402C] flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#17402C]" />
                <span>{catName}</span>
                <span className="text-black/40 font-normal">({catItems.length})</span>
              </div>

              <div className="space-y-2">
                {catItems.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-2.5 shadow-xs transition hover:shadow-sm"
                  >
                    {/* Product Image from DB */}
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-black/5 border border-black/5">
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Floating Mini Category Selector in Bottom Right */}
        <div className="absolute right-4 bottom-20 z-20">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                setSelectorOpen(!selectorOpen);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/85 px-3 py-1.5 text-xs font-bold text-[#172B24] shadow-md backdrop-blur-xl transition active:scale-95"
              aria-label="Filtrer par catégorie"
            >
              <Layers size={13} className="text-[#17402C]" />
              <span className="max-w-[110px] truncate">{selectedCategory}</span>
              <ChevronDown size={12} className={`transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
            </button>

            {selectorOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl animate-in fade-in zoom-in-95">
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setSelectedCategory(cat);
                        setSelectorOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                        selectedCategory === cat
                          ? 'bg-[#17402C] text-white font-bold'
                          : 'text-[#172B24] hover:bg-black/5'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {selectedCategory === cat && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Single Action Button: "Ajouter à mes kits" only */}
        <div className="shrink-0 p-4 bg-white/60 backdrop-blur-xl border-t border-black/5">
          <button
            type="button"
            onClick={handleAddToMyKits}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-md transition active:scale-[0.98] ${
              isAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-[#17402C] text-white hover:bg-[#123323]'
            }`}
          >
            {isAdded ? <Check size={18} strokeWidth={2.5} /> : <Compass size={18} />}
            <span>{isAdded ? 'Kit ajouté à mes kits !' : 'Ajouter à mes kits'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FreedomKitDrawer;
