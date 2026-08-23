'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { addToCart } from '@/lib/cart';
import {
  Plus,
  Check,
  Trash2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';
import type { KitListItem } from '@/features/materiel/services/getKits';

export interface KitBuilderItem {
  id: string;
  name: string;
  category: string;
  weight_g: number;
  image: string;
  isFromShop: boolean;
  shopProduct?: ProductSuggestion;
  inventoryItem?: InventoryItem;
}

interface OptimizeResult {
  analysis: string;
  removals: { item: string; reason: string }[];
  replacements: { item: string; with: string; reason: string }[];
  additions: { item: string; category?: string; weight_g_estimate?: number; reason: string }[];
  after_weight_kg: number;
  after_price_eur_estimate: number;
  co2_kg_saved_estimate: number;
  score: number;
}

interface Props {
  inventory: InventoryItem[];
  products?: ProductSuggestion[];
  kits?: KitListItem[];
  initialKitItems?: InventoryItem[];
}

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  normalizedCategory: string;
  weight_g: number;
  image: string;
  isFromShop: boolean;
  priceEur?: number;
  inventoryItem?: InventoryItem;
  shopProduct?: ProductSuggestion;
}

const CANONICAL_CATEGORIES = [
  'Tous',
  'Bivouac & Tentes',
  'Portage & Sacs',
  'Hydratation & Eau',
  'Cuisine & Réchauds',
  'Vêtements & Vestes',
  'Lampes & Navigation',
  'Sécurité & Soins',
  'Accessoires & Outils',
] as const;

function normalizeCategory(cat: string | null | undefined): string {
  if (!cat) return 'Accessoires & Outils';
  const c = cat.toLowerCase();
  if (c.includes('bivouac') || c.includes('couchage') || c.includes('tente') || c.includes('matelas') || c.includes('duvet')) {
    return 'Bivouac & Tentes';
  }
  if (c.includes('portage') || c.includes('sac')) {
    return 'Portage & Sacs';
  }
  if (c.includes('eau') || c.includes('filtre') || c.includes('gourde') || c.includes('hydrat')) {
    return 'Hydratation & Eau';
  }
  if (c.includes('cuis') || c.includes('rechaud') || c.includes('popote') || c.includes('repas')) {
    return 'Cuisine & Réchauds';
  }
  if (c.includes('vêt') || c.includes('veste') || c.includes('textile') || c.includes('habit')) {
    return 'Vêtements & Vestes';
  }
  if (c.includes('lampe') || c.includes('eclair') || c.includes('gps') || c.includes('navig') || c.includes('frontale')) {
    return 'Lampes & Navigation';
  }
  if (c.includes('secu') || c.includes('soin') || c.includes('secours') || c.includes('pharma')) {
    return 'Sécurité & Soins';
  }
  return 'Accessoires & Outils';
}

/** Résolveur d'images réelles haute définition selon la nature du produit */
function getEquipmentImageUrl(name: string, category?: string | null, photoUrl?: string | null): string {
  if (photoUrl && photoUrl.startsWith('http')) return photoUrl;
  const n = name.toLowerCase();
  const c = (category || '').toLowerCase();

  // Bivouac / Tentes / Couchage
  if (n.includes('tente') || n.includes('abri')) return 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=400&auto=format&fit=crop';
  if (n.includes('matelas') || n.includes('tapis')) return 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=400&auto=format&fit=crop';
  if (n.includes('duvet') || n.includes('couchage') || n.includes('sac de couchage')) return 'https://images.unsplash.com/photo-1517824806704-9040b037703b?q=80&w=400&auto=format&fit=crop';

  // Portage / Sacs
  if (n.includes('sac à dos') || n.includes('sac a dos') || n.includes('portage') || c.includes('portage') || n.includes('sac')) return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop';

  // Eau / Filtres / Gourde
  if (n.includes('gourde') || n.includes('filtre') || n.includes('eau') || n.includes('flasque')) return 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=400&auto=format&fit=crop';

  // Cuisine / Réchauds
  if (n.includes('rechaud') || n.includes('réchaud') || n.includes('gaz') || n.includes('popote') || n.includes('cuis')) return 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=400&auto=format&fit=crop';

  // Lampes / Éclairage
  if (n.includes('lampe') || n.includes('frontale') || n.includes('eclair') || n.includes('lumiere')) return 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?q=80&w=400&auto=format&fit=crop';

  // GPS / Navigation
  if (n.includes('gps') || n.includes('garmin') || n.includes('boussole') || n.includes('montre') || n.includes('navig')) return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';

  // Vêtements / Vestes
  if (n.includes('veste') || n.includes('doudoune') || n.includes('polaire') || n.includes('pantalon') || c.includes('vêtement')) return 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop';

  // Sécurité / Soins
  if (n.includes('secours') || n.includes('trousse') || n.includes('soin') || n.includes('survie') || n.includes('pharma')) return 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=400&auto=format&fit=crop';

  // Bâtons / Outils / Accessoires
  if (n.includes('baton') || n.includes('bâton')) return 'https://images.unsplash.com/photo-1486915309851-b0cc1f8a0084?q=80&w=400&auto=format&fit=crop';
  if (n.includes('couteau') || n.includes('outil') || n.includes('multifonction')) return 'https://images.unsplash.com/photo-1589782182703-2aaa69037b5b?q=80&w=400&auto=format&fit=crop';

  return 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=400&auto=format&fit=crop';
}

const FALLBACK_SHOP_PRODUCTS: ProductSuggestion[] = [
  {
    id: 'shop-fb-1',
    name: 'Tente Dôme Ultralight 2P',
    slug: 'tente-dome-ultralight-2p',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=400&auto=format&fit=crop',
    priceEur: 189.0,
    category: 'Bivouac & Tentes',
    weightG: 1250,
  },
  {
    id: 'shop-fb-2',
    name: 'Matelas Autogonflant R3.5',
    slug: 'matelas-autogonflant-r3-5',
    image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=400&auto=format&fit=crop',
    priceEur: 85.0,
    category: 'Bivouac & Tentes',
    weightG: 490,
  },
  {
    id: 'shop-fb-3',
    name: 'Sac à Dos Expédition 45+10L',
    slug: 'sac-a-dos-expedition-45-10l',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&auto=format&fit=crop',
    priceEur: 145.0,
    category: 'Portage & Sacs',
    weightG: 1100,
  },
  {
    id: 'shop-fb-4',
    name: 'Gourde Filtrante 1L PureFlow',
    slug: 'gourde-filtrante-1l-pureflow',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=400&auto=format&fit=crop',
    priceEur: 42.5,
    category: 'Hydratation & Eau',
    weightG: 220,
  },
  {
    id: 'shop-fb-5',
    name: 'Réchaud Titane Micro-Burner',
    slug: 'rechaud-titane-micro-burner',
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=400&auto=format&fit=crop',
    priceEur: 29.9,
    category: 'Cuisine & Réchauds',
    weightG: 48,
  },
  {
    id: 'shop-fb-6',
    name: 'Lampe Frontale 450 Lumens USB-C',
    slug: 'lampe-frontale-450-lumens',
    image: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?q=80&w=400&auto=format&fit=crop',
    priceEur: 34.9,
    category: 'Lampes & Navigation',
    weightG: 85,
  },
  {
    id: 'shop-fb-7',
    name: 'Trousse de Premiers Soins Trekking',
    slug: 'trousse-premiers-soins-trekking',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=400&auto=format&fit=crop',
    priceEur: 24.5,
    category: 'Sécurité & Soins',
    weightG: 180,
  },
  {
    id: 'shop-fb-8',
    name: 'Bâtons de Randonnée Carbone (Paire)',
    slug: 'batons-randonnee-carbone',
    image: 'https://images.unsplash.com/photo-1486915309851-b0cc1f8a0084?q=80&w=400&auto=format&fit=crop',
    priceEur: 69.0,
    category: 'Accessoires & Outils',
    weightG: 340,
  },
];

/**
 * W-K-4 KitBuilder :
 * - Microinteractions soignées avec ressorts tactiles (whileTap)
 * - Navigation par catégories animée (AnimatePresence)
 * - Vraies photos produits haute définition
 * - Bouton IA circulaire standardisé
 * - 2 écrans côte-à-côte avec empty state enrichi
 */
export function KitBuilder({
  inventory = [],
  products = [],
  kits = [],
  initialKitItems = [],
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [kitItems, setKitItems] = useState<KitBuilderItem[]>(() =>
    initialKitItems.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category || 'Autre',
      weight_g: i.weight_g || 0,
      image: getEquipmentImageUrl(i.name, i.category, i.photo_url),
      isFromShop: false,
      inventoryItem: i,
    }))
  );
  const [name, setName] = useState('');
  const [season, setSeason] = useState('toute_saison');
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  // État de l'Optimiseur IA intégré
  const [showAi, setShowAi] = useState(false);
  const [aiGoal, setAiGoal] = useState('Alléger le kit');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<OptimizeResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fusionner inventaire et boutique avec vraies images
  const unifiedCatalog = useMemo<CatalogEntry[]>(() => {
    const fromInventory: CatalogEntry[] = inventory.map((i) => ({
      id: `inv-${i.id}`,
      name: i.name,
      category: i.category || 'Équipement',
      normalizedCategory: normalizeCategory(i.category),
      weight_g: i.weight_g || 0,
      image: getEquipmentImageUrl(i.name, i.category, i.photo_url),
      isFromShop: false,
      inventoryItem: i,
    }));

    const rawShop = products.length > 0 ? products : FALLBACK_SHOP_PRODUCTS;
    const fromShop: CatalogEntry[] = rawShop.map((p) => ({
      id: `shop-${p.id}`,
      name: p.name,
      category: p.category || 'Boutique',
      normalizedCategory: normalizeCategory(p.category),
      weight_g: p.weightG || 0,
      image: getEquipmentImageUrl(p.name, p.category, p.image),
      priceEur: p.priceEur,
      isFromShop: true,
      shopProduct: p,
    }));

    return [...fromInventory, ...fromShop];
  }, [inventory, products]);

  // Filtrage par catégorie
  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'Tous') return unifiedCatalog;
    return unifiedCatalog.filter((item) => item.normalizedCategory === selectedCategory);
  }, [unifiedCatalog, selectedCategory]);

  // Ajouter un article au kit
  const handleAddItem = (entry: CatalogEntry) => {
    if (entry.isFromShop) {
      const virtualId = `shop-item-${Date.now()}-${Math.random()}`;
      setKitItems((prev) => [
        ...prev,
        {
          id: virtualId,
          name: entry.name,
          category: entry.category,
          weight_g: entry.weight_g,
          image: entry.image,
          isFromShop: true,
          shopProduct: entry.shopProduct,
        },
      ]);
      toast(`« ${entry.name} » ajouté (Boutique 🛒)`, 'success');
    } else if (entry.inventoryItem) {
      if (kitItems.some((k) => k.id === entry.inventoryItem!.id)) {
        toast(`${entry.name} est déjà dans le kit`, 'info');
        return;
      }
      setKitItems((prev) => [
        ...prev,
        {
          id: entry.inventoryItem!.id,
          name: entry.name,
          category: entry.category,
          weight_g: entry.weight_g,
          image: entry.image,
          isFromShop: false,
          inventoryItem: entry.inventoryItem,
        },
      ]);
      toast(`« ${entry.name} » ajouté`, 'success');
    }
  };

  // Retirer un article
  const removeItem = (id: string) => {
    setKitItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Exécuter l'optimisation IA
  const runAiOptimization = async () => {
    if (kitItems.length === 0) {
      toast('Ajoutez d’abord des articles pour que l’IA puisse optimiser', 'error');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const payloadItems = kitItems.map((i) => ({
        name: i.name,
        category: i.category,
        weight_g: i.weight_g,
        quantity: 1,
      }));

      const targetKitId = kits.find((k) => !k.is_trashed)?.id;
      const res = await fetch('/api/materiel/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_id: targetKitId || undefined,
          goal: aiGoal,
          items: payloadItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erreur analyse IA');
      }

      const text = await res.text();
      let parsed: OptimizeResult | null = null;
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.type === 'chunk' && payload.chunk?.content) {
          parsed = JSON.parse(payload.chunk.content);
        }
      }
      if (!parsed) throw new Error('Réponse IA vide');
      setAiResult(parsed);
      toast('Optimisation IA calculée ✨', 'success');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAiLoading(false);
    }
  };

  // Enregistrer le kit & ajouter les articles boutique au panier
  const save = async () => {
    if (!name.trim()) {
      toast('Veuillez renseigner le nom du kit', 'error');
      return;
    }
    if (kitItems.length === 0) {
      toast('Ajoutez au moins un article à ce kit', 'error');
      return;
    }

    setSaving(true);
    try {
      const shopItemsToOrder = kitItems.filter((i) => i.isFromShop && i.shopProduct);
      if (shopItemsToOrder.length > 0) {
        shopItemsToOrder.forEach((item) => {
          if (item.shopProduct) {
            addToCart(
              {
                id: item.shopProduct.id,
                slug: item.shopProduct.slug,
                name: item.shopProduct.name,
                brand: 'KDV Selection',
                priceEur: item.shopProduct.priceEur,
                weightG: item.shopProduct.weightG,
                image: item.shopProduct.image,
                imageAlt: item.shopProduct.name,
                category: item.shopProduct.category,
              },
              1
            );
          }
        });
        window.dispatchEvent(new Event('storage'));
      }

      const payloadItems = kitItems.map((i) => ({
        product_ownership_id: i.isFromShop ? null : i.id,
        name: i.name,
        category: i.category,
        weight_g: i.weight_g,
        quantity: 1,
        is_checked: false,
      }));

      const res = await fetch('/api/materiel/kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          season,
          description: null,
          items: payloadItems,
        }),
      });

      if (!res.ok) throw new Error('Erreur lors de la création');

      if (shopItemsToOrder.length > 0) {
        toast(
          `Kit « ${name.trim()} » enregistré ! 🛒 ${shopItemsToOrder.length} article(s) à commander ajouté(s) à votre panier.`,
          'success'
        );
      } else {
        toast(`Kit « ${name.trim()} » enregistré avec succès ! ✓`, 'success');
      }

      setName('');
      setKitItems([]);
      router.refresh();
    } catch {
      toast('Erreur lors de l’enregistrement du kit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalWeightG = kitItems.reduce((s, i) => s + i.weight_g, 0);

  return (
    <GlassCard
      as="article"
      tone="sage"
      ariaLabelledBy="kit-builder-title"
      className="p-2.5 sm:p-3 h-full min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar gap-1.5 relative"
    >
      {/* Bouton IA icône circulaire standardisé en haut à droite avec tap feedback */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        onClick={() => setShowAi(!showAi)}
        className="!absolute top-1.5 right-8 md:top-2 md:right-11 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#17402C] focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-1"
        aria-label={showAi ? 'Fermer l’assistant IA' : 'Ouvrir l’assistant IA'}
      >
        <Sparkles size={12} className="md:hidden" aria-hidden="true" />
        <Sparkles size={15} className="hidden md:block" aria-hidden="true" />
      </motion.button>

      {/* En-tête compact */}
      <div className="flex items-center justify-between gap-2 pr-16 md:pr-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-[10px] md:text-xs font-semibold text-[#17402C] font-body">
            Assembleur & IA
          </p>
          <h3
            id="kit-builder-title"
            className="font-display font-bold text-[#17402C] text-[13px] md:text-[15px] leading-tight truncate"
          >
            Créer un kit sur-mesure
          </h3>
        </div>
      </div>

      {/* Module Optimiseur IA escamotable avec animation fluide */}
      <AnimatePresence>
        {showAi && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="p-2 rounded-xl bg-white/[0.08] border border-[#17402C]/20 flex flex-col gap-1.5 shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-1.5">
              <input
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                placeholder="Objectif d’optimisation (ex: Alléger le sac, Randonnée 3j)"
                className="glass-input flex-1 text-[10px] text-[#17402C] h-6 py-0 px-2"
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={runAiOptimization}
                disabled={aiLoading || kitItems.length === 0}
                className="glass-capsule-btn primary shrink-0 h-6 text-[9px] font-bold px-2.5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#17402C]"
              >
                {aiLoading ? 'Analyse…' : 'Optimiser ✨'}
              </motion.button>
            </div>

            {aiError && <p className="text-[9px] text-[#A8443A]">{aiError}</p>}

            {aiResult && (
              <div className="glass-sub-card p-2 rounded-lg flex flex-col gap-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Badge tone="sage">Score {aiResult.score}/100</Badge>
                    <Badge tone="info">Poids optimisé : {aiResult.after_weight_kg.toFixed(1)} kg</Badge>
                  </div>
                  {aiResult.co2_kg_saved_estimate > 0 && (
                    <span className="text-[9px] font-mono text-[#365233]">
                      -{aiResult.co2_kg_saved_estimate}kg CO₂
                    </span>
                  )}
                </div>

                <p className="text-[9px] text-[#17402C] leading-relaxed">{aiResult.analysis}</p>

                {(aiResult.removals.length > 0 || aiResult.replacements.length > 0) && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                    {aiResult.removals.map((r, i) => (
                      <div key={`rem-${i}`} className="flex items-center justify-between gap-1 text-[9px] text-[#A8443A]">
                        <span className="truncate">⚠️ À retirer : <b>{r.item}</b> ({r.reason})</span>
                        <button
                          type="button"
                          onClick={() => {
                            const match = kitItems.find((k) => k.name.toLowerCase().includes(r.item.toLowerCase()));
                            if (match) removeItem(match.id);
                          }}
                          className="px-1.5 py-0.5 rounded bg-[#A8443A]/10 hover:bg-[#A8443A]/20 font-bold shrink-0 text-[8.5px]"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}

                    {aiResult.replacements.map((rep, i) => (
                      <div key={`rep-${i}`} className="flex items-center justify-between gap-1 text-[9px] text-[#365233]">
                        <span className="truncate">💡 Remplacer <b>{rep.item}</b> par <i>{rep.with}</i></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sélecteur de catégories par pilules avec accessibilité tab/tabpanel */}
      <div
        className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 py-0.5"
        role="tablist"
        aria-label="Catégories d'équipement"
      >
        {CANONICAL_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-1 ${
                isActive
                  ? 'bg-[#17402C] text-white shadow-xs'
                  : 'bg-white/[0.08] text-[#365233] hover:bg-white/20 border border-white/20'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* GRILLE CENTRALE AVEC 2 ÉCRANS CÔTE-À-CÔTE (Hauteur considérablement accrue) */}
      <div className="flex-1 min-h-[220px] md:min-h-[280px] max-h-[380px] md:max-h-[440px] grid grid-cols-1 md:grid-cols-12 gap-2 content-stretch">
        {/* ÉCRAN 1 (Gauche, 8 colonnes) : Catalogue Fusionné en Colonnes de 3 */}
        <div className="md:col-span-8 flex flex-col min-h-0 gap-1 overflow-y-auto no-scrollbar pr-0.5">
          <div className="flex items-center justify-between px-1 text-[9px] font-bold text-[#365233] shrink-0">
            <span>Matériel disponible ({filteredCatalog.length})</span>
            <span className="text-[#5A7064]">{selectedCategory}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1"
            >
              {filteredCatalog.length === 0 ? (
                <p className="text-[10px] text-[#5A7064] py-4 text-center">Aucun équipement disponible dans cette catégorie.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {filteredCatalog.map((item) => {
                    const isAdded = !item.isFromShop && item.inventoryItem
                      ? kitItems.some((k) => k.id === item.inventoryItem!.id)
                      : false;

                    return (
                      <div
                        key={item.id}
                        className="glass-sub-card p-1.5 rounded-xl flex items-center justify-between gap-1.5 text-[11px] transition-all hover:border-white/60 group"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Image réelle haute qualité */}
                          <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-white/10 shrink-0 border border-white/20">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="32px"
                              className="object-cover group-hover:scale-105 transition-transform"
                              unoptimized
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#17402C] truncate leading-tight text-[10.5px]">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-1 text-[8px]">
                              {item.isFromShop ? (
                                <>
                                  <span className="text-[#17402C] font-bold">🛒 Boutique</span>
                                  <span className="text-[#5A7064]">· {item.priceEur?.toFixed(2)}€</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[#365233] font-medium">Inventaire</span>
                                  <span className="text-[#5A7064]">· {item.weight_g}g</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Simple bouton plus circulaire avec retour tactile spring */}
                        <motion.button
                          type="button"
                          onClick={() => handleAddItem(item)}
                          disabled={isAdded}
                          whileTap={isAdded ? undefined : { scale: 0.86 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          aria-label={`Ajouter ${item.name} au kit`}
                          className={`h-6 w-6 !rounded-full flex items-center justify-center transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-1 ${
                            isAdded
                              ? 'bg-white/10 text-[#5A7064] cursor-default'
                              : 'glass interactive text-[#17402C] hover:bg-[#17402C] hover:text-white border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]'
                          }`}
                        >
                          {isAdded ? (
                            <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                          ) : (
                            <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                          )}
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ÉCRAN 2 (Droite, 4 colonnes) : Deuxième écran "Kit en cours" */}
        <div className="md:col-span-4 flex flex-col min-h-0 gap-1 pl-0 md:pl-1 md:border-l border-white/15">
          <div className="flex items-center justify-between px-1 text-[9px] font-bold text-[#17402C] shrink-0">
            <span>Kit en cours ({kitItems.length})</span>
            <motion.span
              key={totalWeightG}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="font-mono font-bold text-[#17402C]"
            >
              {(totalWeightG / 1000).toFixed(2)} kg
            </motion.span>
          </div>

          <div
            className="glass-sub-card p-1.5 rounded-xl flex-1 min-h-[90px] overflow-y-auto no-scrollbar flex flex-col gap-1"
            role="list"
            aria-label="Articles du kit en cours d'assemblage"
          >
            {kitItems.length === 0 ? (
              <div className="py-5 text-center text-[10px] text-[#5A7064] flex flex-col items-center justify-center gap-1.5">
                <span className="text-xl opacity-30" aria-hidden="true">🎒</span>
                <span className="font-semibold text-[#365233] text-[10px]">Kit vide</span>
                <span className="text-[8.5px] text-[#5A7064]/80 leading-relaxed">
                  Cliquez sur « <Plus size={9} className="inline align-baseline" aria-hidden="true" /> » à gauche pour assembler.
                </span>
              </div>
            ) : (
              kitItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  role="listitem"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-sub-card p-1 rounded-lg flex items-center justify-between gap-1 text-[10.5px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className="relative h-6 w-6 rounded-md overflow-hidden bg-white/10 shrink-0 border border-white/15">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="24px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#17402C] truncate leading-tight">{item.name}</p>
                      <div className="flex items-center gap-1 text-[8.5px] text-[#5A7064]">
                        <span>{item.weight_g}g</span>
                        {item.isFromShop && <span className="text-[#17402C] font-bold">· 🛒 À commander</span>}
                      </div>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.84 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    onClick={() => removeItem(item.id)}
                    aria-label={`Retirer ${item.name}`}
                    className="text-[#5A7064] hover:text-[#A8443A] p-0.5 shrink-0 focus-visible:ring-1 focus-visible:ring-[#A8443A] rounded"
                  >
                    <Trash2 size={10} aria-hidden="true" />
                  </motion.button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Barre d'enregistrement basse ultra-compacte avec sélecteur pilule */}
      <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/15 shrink-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du kit (ex: Bivouac 3j)"
          className="glass-input text-[10.5px] text-[#17402C] h-7 py-0 px-3 rounded-full flex-1 min-w-[100px] border border-white/30"
        />
        <div className="relative shrink-0">
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="glass interactive h-7 py-0 pl-2.5 pr-6 text-[10px] text-[#17402C] font-bold rounded-full cursor-pointer appearance-none outline-none border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-[#17402C]"
          >
            <option value="toute_saison">🌿 Toutes saisons</option>
            <option value="ete">☀️ Été</option>
            <option value="printemps">🌸 Printemps</option>
            <option value="automne">🍂 Automne</option>
            <option value="hiver">❄️ Hiver</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-2.5 pointer-events-none text-[#17402C]" />
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={save}
          disabled={saving || kitItems.length === 0}
          className="glass-capsule-btn primary h-7 text-[10.5px] font-bold px-3 rounded-full shrink-0 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#17402C]"
        >
          {saving ? '…' : `Enregistrer (${kitItems.length})`}
        </motion.button>
      </div>
    </GlassCard>
  );
}
