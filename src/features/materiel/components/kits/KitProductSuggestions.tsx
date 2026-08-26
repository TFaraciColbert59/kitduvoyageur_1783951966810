'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { useToast } from '@/contexts/ToastContext';
import { addToCart } from '@/lib/cart';
import { ShoppingBag, Plus, Sparkles, Check, ChevronDown } from 'lucide-react';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

const CURATED_SUGGESTIONS: ProductSuggestion[] = [
  {
    id: 'sug-1',
    name: 'Tente Dôme Ultralight 2P',
    slug: 'tente-dome-ultralight-2p',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=600&auto=format&fit=crop',
    priceEur: 189.0,
    category: 'Bivouac',
    weightG: 1250,
  },
  {
    id: 'sug-2',
    name: 'Gourde Filtrante 1L PureFlow',
    slug: 'gourde-filtrante-1l-pureflow',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop',
    priceEur: 42.5,
    category: 'Hydratation',
    weightG: 220,
  },
  {
    id: 'sug-3',
    name: 'Matelas Autogonflant ThermoLite R3.5',
    slug: 'matelas-autogonflant-thermolite',
    image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=600&auto=format&fit=crop',
    priceEur: 85.0,
    category: 'Bivouac',
    weightG: 490,
  },
  {
    id: 'sug-4',
    name: 'Lampe Frontale 450 Lumens USB-C',
    slug: 'lampe-frontale-450-lumens',
    image: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?q=80&w=600&auto=format&fit=crop',
    priceEur: 34.9,
    category: 'Accessoires',
    weightG: 85,
  },
  {
    id: 'sug-5',
    name: 'Sac à Dos Expédition 45+10L',
    slug: 'sac-a-dos-expedition-45-10l',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop',
    priceEur: 145.0,
    category: 'Portage',
    weightG: 1100,
  },
  {
    id: 'sug-6',
    name: 'Réchaud Titane Micro-Burner',
    slug: 'rechaud-titane-micro-burner',
    image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=600&auto=format&fit=crop',
    priceEur: 29.9,
    category: 'Cuisine',
    weightG: 48,
  },
  {
    id: 'sug-7',
    name: 'Duvet Grand Froid -5°C Confort',
    slug: 'duvet-grand-froid-confort',
    image: 'https://images.unsplash.com/photo-1517824806704-9040b037703b?q=80&w=600&auto=format&fit=crop',
    priceEur: 210.0,
    category: 'Bivouac',
    weightG: 890,
  },
  {
    id: 'sug-8',
    name: 'Trousse de Premiers Soins Trekking',
    slug: 'trousse-premiers-soins-trekking',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?q=80&w=600&auto=format&fit=crop',
    priceEur: 24.5,
    category: 'Accessoires',
    weightG: 180,
  },
];

const CATEGORIES = ['Tous', 'Bivouac', 'Hydratation', 'Portage', 'Accessoires'] as const;
const INITIAL_VISIBLE_COUNT = 4;

/** W-K-10 KitProductSuggestions — Suggestions de matériel avec pagination « Charger plus ». */
export function KitProductSuggestions({ products = [] }: { products?: ProductSuggestion[] }) {
  const { toast } = useToast();
  const [selectedCat, setSelectedCat] = useState<string>('Tous');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

  const allProducts = products.length > 0 ? products : CURATED_SUGGESTIONS;

  const filtered = selectedCat === 'Tous'
    ? allProducts
    : allProducts.filter((p) => p.category?.toLowerCase() === selectedCat.toLowerCase());

  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleAddToCart = (p: ProductSuggestion, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart(
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: 'Sélection LKDV',
        priceEur: p.priceEur,
        weightG: p.weightG,
        image: p.image,
        imageAlt: p.name,
        category: p.category,
      },
      1
    );

    window.dispatchEvent(new Event('storage'));
    setAddedIds((prev) => new Set(prev).add(p.id));
    toast(`« ${p.name} » ajouté au panier ! 🛒`, 'success');

    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }, 2000);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 4);
  };

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="suggestions-title" className="p-4 sm:p-5 flex flex-col gap-3.5">
      {/* En-tête de section */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Eyebrow>Boutique & Recommandations</Eyebrow>
          <h3 id="suggestions-title" className="font-display font-bold text-[20px] text-[#17402C] mt-0.5">
            Matériel recommandé pour vos kits
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17402C] bg-[#17402C]/08 px-3 py-1 rounded-full border border-[#17402C]/15">
          <Sparkles size={13} />
          <span>Sélection Expert</span>
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCat(cat);
                setVisibleCount(INITIAL_VISIBLE_COUNT);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-[#17402C] text-white '
                  : 'bg-white/[0.08] text-[#365233] hover:bg-white/20 border border-white/20'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grille de cartes produits paginée */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {visibleProducts.map((prod) => {
          const isAdded = addedIds.has(prod.id);
          return (
            <div
              key={prod.id}
              className="glass-sub-card p-2.5 rounded-2xl flex flex-col justify-between gap-2 transition-all hover:border-white/60 group relative"
            >
              <Link href={`/produit/${prod.slug}`} className="block">
                <div className="relative h-28 w-full rounded-xl overflow-hidden bg-white/10 border border-white/20 mb-1.5">
                  <Image
                    src={prod.image}
                    alt={prod.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  {prod.category && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#17402C]/80 text-white text-[9px] font-bold backdrop-blur-xs">
                      {prod.category}
                    </span>
                  )}
                </div>

                <p className="font-semibold text-xs text-[#17402C] line-clamp-2 leading-tight group-hover:text-[#365233] transition-colors">
                  {prod.name}
                </p>
              </Link>

              <div className="pt-1 border-t border-white/15 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-[#17402C]">{prod.priceEur.toFixed(2)} €</span>
                  <span className="text-[#5A7064]">{prod.weightG ? `${prod.weightG}g` : ''}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleAddToCart(prod, e)}
                  className={`w-full h-7 rounded-full text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                    isAdded
                      ? 'bg-[#365233] text-white'
                      : 'glass-capsule-btn primary'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check size={11} strokeWidth={3} />
                      <span>Ajouté</span>
                    </>
                  ) : (
                    <>
                      <Plus size={11} />
                      <span>Au panier</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bouton Charger Plus */}
      {hasMore && (
        <div className="pt-1 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="glass-capsule-btn secondary text-xs font-bold flex items-center gap-1.5 h-8 px-4"
          >
            <span>Charger plus ({filtered.length - visibleCount} restants)</span>
            <ChevronDown size={13} />
          </button>
        </div>
      )}
    </GlassCard>
  );
}
