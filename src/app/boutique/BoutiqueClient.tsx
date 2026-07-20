'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionType = 'achat' | 'location' | 'occasion' | 'enchere';

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  weight_g: number;
  price_eur: number;
  image: string;
  image_alt: string;
  rating: number;
  review_count: number;
  available: boolean;
  transaction_type: TransactionType;
  price_per_day?: number;
  original_price?: number;
  condition?: string;
  starting_bid?: number;
  ends_at?: string;
  savings?: number;
}

interface OptimizedKit {
  product: ShopProduct;
  chosen_type: TransactionType;
  chosen_price: number;
  savings: number;
}

const TRANSACTION_BADGE: Record<TransactionType, { label: string; cls: string; dot: string }> = {
  achat:    { label: 'ACHAT',    cls: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30', dot: 'bg-emerald-500' },
  location: { label: 'LOCATION', cls: 'bg-purple-500/15 text-purple-600 border border-purple-500/30',   dot: 'bg-purple-500' },
  occasion: { label: 'OCCASION', cls: 'bg-yellow-500/15 text-yellow-700 border border-yellow-500/30',   dot: 'bg-yellow-500' },
  enchere:  { label: 'ENCHÈRE',  cls: 'bg-orange-500/15 text-orange-600 border border-orange-500/30',   dot: 'bg-orange-500' },
};

const CATEGORIES = ['Tout', 'Sacs à dos', 'Tentes', 'Couchage', 'Vêtements', 'Chaussures', 'Cuisine', 'Éclairage', 'Sécurité', 'Eau', 'Navigation', 'Électronique', 'Accessoires'];

const PRESET_KITS = [
  { label: 'Kit Islande', budget: 300, weight: 10, icon: '🇮🇸' },
  { label: 'Kit Trek Léger', budget: 200, weight: 7, icon: '🏔️' },
  { label: 'Kit Désert', budget: 250, weight: 9, icon: '🏜️' },
  { label: 'Kit Minimaliste', budget: 150, weight: 5, icon: '🎒' },
];

// ─── Mock data (used when Supabase has no products) ───────────────────────────

const MOCK_PRODUCTS: ShopProduct[] = [
  { id: '1', slug: 'osprey-farpoint-40', name: 'Osprey Farpoint 40', brand: 'Osprey', category: 'Sacs à dos', weight_g: 1420, price_eur: 179, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image_alt: 'Sac à dos Osprey Farpoint 40 gris anthracite', rating: 4.8, review_count: 312, available: true, transaction_type: 'achat', savings: 0 },
  { id: '2', slug: 'osprey-farpoint-40-loc', name: 'Osprey Farpoint 40', brand: 'Osprey', category: 'Sacs à dos', weight_g: 1420, price_eur: 9, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image_alt: 'Sac à dos Osprey Farpoint 40 gris anthracite en location', rating: 4.7, review_count: 89, available: true, transaction_type: 'location', price_per_day: 9, savings: 0 },
  { id: '3', slug: 'osprey-farpoint-40-occ', name: 'Osprey Farpoint 40', brand: 'Osprey', category: 'Sacs à dos', weight_g: 1420, price_eur: 112, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image_alt: 'Sac à dos Osprey Farpoint 40 occasion très bon état', rating: 4.6, review_count: 45, available: true, transaction_type: 'occasion', original_price: 179, condition: 'Très bon état', savings: 67 },
  { id: '4', slug: 'osprey-farpoint-40-enc', name: 'Osprey Farpoint 40', brand: 'Osprey', category: 'Sacs à dos', weight_g: 1420, price_eur: 78, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image_alt: 'Sac à dos Osprey Farpoint 40 enchère en cours', rating: 4.5, review_count: 12, available: true, transaction_type: 'enchere', starting_bid: 78, savings: 101 },
  { id: '5', slug: 'msr-hubba-hubba', name: 'MSR Hubba Hubba NX 2P', brand: 'MSR', category: 'Tentes', weight_g: 1720, price_eur: 549, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', image_alt: 'Tente MSR Hubba Hubba NX 2 places orange montée en montagne', rating: 4.9, review_count: 198, available: true, transaction_type: 'achat', savings: 0 },
  { id: '6', slug: 'msr-hubba-hubba-loc', name: 'MSR Hubba Hubba NX 2P', brand: 'MSR', category: 'Tentes', weight_g: 1720, price_eur: 18, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', image_alt: 'Tente MSR Hubba Hubba NX 2 places en location', rating: 4.8, review_count: 67, available: true, transaction_type: 'location', price_per_day: 18, savings: 0 },
  { id: '7', slug: 'msr-hubba-hubba-occ', name: 'MSR Hubba Hubba NX 2P', brand: 'MSR', category: 'Tentes', weight_g: 1720, price_eur: 320, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', image_alt: 'Tente MSR Hubba Hubba NX occasion bon état', rating: 4.7, review_count: 23, available: true, transaction_type: 'occasion', original_price: 549, condition: 'Bon état', savings: 229 },
  { id: '8', slug: 'sea-to-summit-spark', name: 'Sea to Summit Spark SP1', brand: 'Sea to Summit', category: 'Couchage', weight_g: 490, price_eur: 299, image: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', image_alt: 'Sac de couchage Sea to Summit Spark SP1 ultra léger bleu', rating: 4.7, review_count: 156, available: true, transaction_type: 'achat', savings: 0 },
  { id: '9', slug: 'sea-to-summit-spark-loc', name: 'Sea to Summit Spark SP1', brand: 'Sea to Summit', category: 'Couchage', weight_g: 490, price_eur: 12, image: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', image_alt: 'Sac de couchage Sea to Summit Spark SP1 en location', rating: 4.6, review_count: 34, available: true, transaction_type: 'location', price_per_day: 12, savings: 0 },
  { id: '10', slug: 'petzl-actik-core', name: 'Petzl Actik Core', brand: 'Petzl', category: 'Éclairage', weight_g: 85, price_eur: 49, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', image_alt: 'Lampe frontale Petzl Actik Core rouge sur fond blanc', rating: 4.6, review_count: 423, available: true, transaction_type: 'achat', savings: 0 },
  { id: '11', slug: 'petzl-actik-occ', name: 'Petzl Actik Core', brand: 'Petzl', category: 'Éclairage', weight_g: 85, price_eur: 28, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', image_alt: 'Lampe frontale Petzl Actik Core occasion', rating: 4.4, review_count: 18, available: true, transaction_type: 'occasion', original_price: 49, condition: 'Très bon état', savings: 21 },
  { id: '12', slug: 'nemo-tensor', name: 'NEMO Tensor Insulated', brand: 'NEMO', category: 'Couchage', weight_g: 510, price_eur: 189, image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', image_alt: 'Matelas gonflable NEMO Tensor Insulated orange déplié', rating: 4.8, review_count: 201, available: true, transaction_type: 'achat', savings: 0 },
  { id: '13', slug: 'nemo-tensor-occ', name: 'NEMO Tensor Insulated', brand: 'NEMO', category: 'Couchage', weight_g: 510, price_eur: 95, image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', image_alt: 'Matelas gonflable NEMO Tensor occasion', rating: 4.6, review_count: 14, available: true, transaction_type: 'occasion', original_price: 189, condition: 'Comme neuf', savings: 94 },
  { id: '14', slug: 'black-diamond-spot', name: 'Black Diamond Spot 400', brand: 'Black Diamond', category: 'Éclairage', weight_g: 91, price_eur: 39, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', image_alt: 'Lampe frontale Black Diamond Spot 400 lumens noire', rating: 4.5, review_count: 287, available: true, transaction_type: 'achat', savings: 0 },
  { id: '15', slug: 'katadyn-befree', name: 'Katadyn BeFree 1L', brand: 'Katadyn', category: 'Eau', weight_g: 56, price_eur: 44, image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', image_alt: 'Filtre à eau Katadyn BeFree 1 litre bleu transparent', rating: 4.7, review_count: 334, available: true, transaction_type: 'achat', savings: 0 },
  { id: '16', slug: 'garmin-inreach-mini', name: 'Garmin inReach Mini 2', brand: 'Garmin', category: 'Navigation', weight_g: 100, price_eur: 349, image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', image_alt: 'Communicateur satellite Garmin inReach Mini 2 orange', rating: 4.9, review_count: 178, available: true, transaction_type: 'achat', savings: 0 },
  { id: '17', slug: 'garmin-inreach-loc', name: 'Garmin inReach Mini 2', brand: 'Garmin', category: 'Navigation', weight_g: 100, price_eur: 15, image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', image_alt: 'Communicateur satellite Garmin inReach Mini 2 en location', rating: 4.8, review_count: 42, available: true, transaction_type: 'location', price_per_day: 15, savings: 0 },
  { id: '18', slug: 'arc-teryx-beta', name: "Arc'teryx Beta AR", brand: "Arc'teryx", category: 'Vêtements', weight_g: 485, price_eur: 699, image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', image_alt: "Veste de randonnée Arc'teryx Beta AR rouge imperméable", rating: 4.9, review_count: 89, available: true, transaction_type: 'achat', savings: 0 },
  { id: '19', slug: 'arc-teryx-beta-occ', name: "Arc'teryx Beta AR", brand: "Arc'teryx", category: 'Vêtements', weight_g: 485, price_eur: 380, image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', image_alt: "Veste Arc'teryx Beta AR occasion très bon état", rating: 4.7, review_count: 31, available: true, transaction_type: 'occasion', original_price: 699, condition: 'Très bon état', savings: 319 },
  { id: '20', slug: 'arc-teryx-beta-enc', name: "Arc'teryx Beta AR", brand: "Arc'teryx", category: 'Vêtements', weight_g: 485, price_eur: 290, image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', image_alt: "Veste Arc'teryx Beta AR enchère en cours", rating: 4.6, review_count: 8, available: true, transaction_type: 'enchere', starting_bid: 290, savings: 409 },
];

// ─── Dual Range Slider ────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  accentColor?: string;
}

function PremiumSlider({ label, unit, value, min, max, step, onChange, formatValue, accentColor = 'var(--primary)' }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : `${value} ${unit}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
        <span
          className="font-mono text-lg font-700 transition-all duration-150"
          style={{ fontFamily: 'var(--font-mono)', color: accentColor }}
        >
          {display}
        </span>
      </div>
      <div className="relative h-8 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-[3px] rounded-full" style={{ background: 'var(--border)' }} />
        {/* Track fill */}
        <div
          className="absolute left-0 h-[3px] rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, background: accentColor }}
        />
        {/* Range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-8"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={display}
        />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-75 pointer-events-none"
          style={{
            left: `calc(${pct}% - 10px)`,
            background: accentColor,
            boxShadow: `0 0 0 4px ${accentColor}25, 0 2px 8px rgba(0,0,0,0.2)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
          {min} {unit}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, isOptimized = false }: { product: ShopProduct; isOptimized?: boolean }) {
  const [added, setAdded] = useState(false);
  const badge = TRANSACTION_BADGE[product.transaction_type];

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.transaction_type === 'achat' || product.transaction_type === 'occasion') {
      addToCart({
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        category: product.category,
        priceEur: product.price_eur,
        weightG: product.weight_g,
        image: product.image,
        imageAlt: product.image_alt,
      });
    } else if (product.transaction_type === 'enchere') {
      window.location.href = '/encheres';
      return;
    } else if (product.transaction_type === 'location') {
      window.location.href = '/location';
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const actionLabel = () => {
    switch (product.transaction_type) {
      case 'enchere':  return 'Enchérir';
      case 'location': return 'Réserver';
      case 'occasion': return 'Acheter';
      default:         return product.available ? 'Ajouter' : 'Épuisé';
    }
  };

  const priceDisplay = () => {
    if (product.transaction_type === 'location') return `${product.price_eur} €/j`;
    if (product.transaction_type === 'enchere')  return `dès ${product.price_eur} €`;
    return `${product.price_eur} €`;
  };

  return (
    <article
      className={`topo-card group overflow-hidden transition-all duration-300 ${isOptimized ? 'ring-2 ring-primary/40' : ''}`}
      aria-label={`${product.name} — ${priceDisplay()}`}
    >
      <Link href={`/produit/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <AppImage
            src={product.image}
            alt={product.image_alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.25) 0%, transparent 50%)' }} />

          {/* Transaction badge */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full font-700 tracking-widest ${badge.cls}`} style={{ fontFamily: 'var(--font-mono)' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>

          {/* Savings badge */}
          {product.savings && product.savings > 0 ? (
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-700 bg-primary text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                −{product.savings} €
              </span>
            </div>
          ) : null}

          {/* Optimized badge */}
          {isOptimized && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-700 bg-primary text-white flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
                ✨ OPTIMISÉ
              </span>
            </div>
          )}
        </div>

        <div className="px-4 pt-4">
          <div className="mb-1">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
              {product.brand}
            </p>
            <h3 className="font-display font-700 text-foreground text-sm leading-tight mt-0.5 line-clamp-2 hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
              {product.name}
            </h3>
          </div>

          <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground mt-1 mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            {product.category}
          </span>
        </div>
      </Link>

      <div className="px-4 pb-4">
        {/* Weight gauge */}
        <div className="mb-3">
          <WeightGauge weightG={product.weight_g} maxG={3000} size="sm" />
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex">
            {[1,2,3,4,5].map((s) => (
              <svg key={s} className={`w-3 h-3 ${s <= Math.round(product.rating) ? 'text-yellow-400' : 'text-muted'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            {product.rating} ({product.review_count})
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-mono text-lg font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              {priceDisplay()}
            </span>
            {product.original_price && (
              <span className="font-mono text-xs text-muted-foreground line-through ml-2" style={{ fontFamily: 'var(--font-mono)' }}>
                {product.original_price} €
              </span>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!product.available && product.transaction_type === 'achat'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all duration-200 min-h-[36px] ${
              added
                ? 'bg-secondary text-white'
                : !product.available && product.transaction_type === 'achat' ?'bg-muted text-muted-foreground cursor-not-allowed' :'bg-primary text-white hover:bg-primary/90 active:scale-95'
            }`}
          >
            <Icon name={added ? 'CheckIcon' : 'PlusIcon'} size={14} variant="outline" />
            {added ? 'Ajouté' : actionLabel()}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Optimization Result Card ─────────────────────────────────────────────────

function OptimizationResultCard({ item }: { item: OptimizedKit }) {
  const badge = TRANSACTION_BADGE[item.chosen_type];
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        <AppImage src={item.product.image} alt={item.product.image_alt} fill className="object-cover" sizes="48px" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-600 text-sm text-foreground truncate" style={{ fontFamily: 'var(--font-display)' }}>
          {item.product.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-700 tracking-widest ${badge.cls}`} style={{ fontFamily: 'var(--font-mono)' }}>
            {badge.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            {item.product.weight_g >= 1000 ? `${(item.product.weight_g / 1000).toFixed(2)} kg` : `${item.product.weight_g} g`}
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
          {item.chosen_price} €
        </p>
        {item.savings > 0 && (
          <p className="font-mono text-[10px] text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
            −{item.savings} €
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Filter Bottom Sheet ───────────────────────────────────────────────

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  budget: number;
  setBudget: (v: number) => void;
  maxWeight: number;
  setMaxWeight: (v: number) => void;
  activeCategory: string;
  setActiveCategory: (v: string) => void;
  activeTypes: Set<TransactionType>;
  toggleType: (t: TransactionType) => void;
}

function MobileFilterSheet({
  open, onClose, budget, setBudget, maxWeight, setMaxWeight,
  activeCategory, setActiveCategory, activeTypes, toggleType,
}: MobileFilterSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 bg-[#1a1a1a] rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-bold text-white text-lg">Filtres</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Budget */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-white/60 text-sm">Budget max</span>
            <span className="text-[#E4501C] font-mono font-bold">{budget} €</span>
          </div>
          <input type="range" min={0} max={1500} step={10} value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-[#E4501C]" />
        </div>

        {/* Weight */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-white/60 text-sm">Poids max</span>
            <span className="text-blue-400 font-mono font-bold">{maxWeight} kg</span>
          </div>
          <input type="range" min={1} max={25} step={0.5} value={maxWeight}
            onChange={(e) => setMaxWeight(Number(e.target.value))}
            className="w-full accent-blue-400" />
        </div>

        {/* Transaction types */}
        <div className="mb-6">
          <p className="text-white/60 text-sm mb-3">Type de transaction</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TRANSACTION_BADGE) as [TransactionType, typeof TRANSACTION_BADGE[TransactionType]][]).map(([type, cfg]) => (
              <button key={type} onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  activeTypes.has(type) ? cfg.cls : 'bg-transparent text-white/40 border-white/20'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTypes.has(type) ? cfg.dot : 'bg-white/30'}`} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <p className="text-white/60 text-sm mb-3">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  activeCategory === cat
                    ? 'bg-[#E4501C] text-white border-[#E4501C]'
                    : 'bg-transparent text-white/60 border-white/20 hover:border-white/40'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose}
          className="w-full py-3.5 bg-[#E4501C] text-white rounded-2xl font-bold text-sm">
          Appliquer les filtres
        </button>
      </div>
    </div>
  );
}

// ─── Mobile Product Card ──────────────────────────────────────────────────────

function MobileProductCard({ product }: { product: ShopProduct }) {
  const [added, setAdded] = useState(false);
  const badge = TRANSACTION_BADGE[product.transaction_type];

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.transaction_type === 'achat' || product.transaction_type === 'occasion') {
      addToCart({
        id: product.id, slug: product.slug, name: product.name, brand: product.brand,
        category: product.category, priceEur: product.price_eur, weightG: product.weight_g,
        image: product.image, imageAlt: product.image_alt,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } else if (product.transaction_type === 'enchere') {
      window.location.href = '/encheres';
    } else if (product.transaction_type === 'location') {
      window.location.href = '/location';
    }
  };

  const priceDisplay = () => {
    if (product.transaction_type === 'location') return `${product.price_eur} €/j`;
    if (product.transaction_type === 'enchere') return `dès ${product.price_eur} €`;
    return `${product.price_eur} €`;
  };

  const actionLabel = () => {
    switch (product.transaction_type) {
      case 'enchere': return 'Enchérir';
      case 'location': return 'Réserver';
      case 'occasion': return 'Acheter';
      default: return product.available ? 'Ajouter' : 'Épuisé';
    }
  };

  return (
    <article className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 overflow-hidden">
      <Link href={`/produit/${product.slug}`} className="flex-shrink-0">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted">
          <AppImage src={product.image} alt={product.image_alt} fill sizes="80px" className="object-cover" />
          {product.savings && product.savings > 0 ? (
            <div className="absolute top-1 right-1">
              <span className="text-[8px] font-mono px-1 py-0.5 rounded-full font-bold bg-[#E4501C] text-white">−{product.savings}€</span>
            </div>
          ) : null}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full font-bold border ${badge.cls}`}>{badge.label}</span>
        </div>
        <Link href={`/produit/${product.slug}`}>
          <p className="font-mono text-[10px] text-muted-foreground">{product.brand}</p>
          <h3 className="font-display font-bold text-foreground text-sm leading-tight line-clamp-1">{product.name}</h3>
        </Link>
        <p className="text-[10px] text-muted-foreground mt-0.5">{product.weight_g >= 1000 ? `${(product.weight_g/1000).toFixed(1)} kg` : `${product.weight_g} g`}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <span className="font-mono font-bold text-foreground text-base">{priceDisplay()}</span>
        {product.original_price && (
          <span className="font-mono text-[10px] text-muted-foreground line-through">{product.original_price} €</span>
        )}
        <button
          onClick={handleAdd}
          disabled={!product.available && product.transaction_type === 'achat'}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] min-w-[72px] ${
            added ? 'bg-secondary text-white' :
            !product.available && product.transaction_type === 'achat' ? 'bg-muted text-muted-foreground cursor-not-allowed' :
            'bg-primary text-white hover:bg-primary/90 active:scale-95'
          }`}
        >
          {added ? '✓' : actionLabel()}
        </button>
      </div>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoutiqueClient() {
  const [budget, setBudget] = useState(300);
  const [maxWeight, setMaxWeight] = useState(10);
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [activeTypes, setActiveTypes] = useState<Set<TransactionType>>(new Set(['achat', 'location', 'occasion', 'enchere']));
  const [products, setProducts] = useState<ShopProduct[]>(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState<OptimizedKit[] | null>(null);
  const [activePresetKit, setActivePresetKit] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Trigger card animation on slider change
  useEffect(() => {
    const t = setTimeout(() => setAnimKey((k) => k + 1), 50);
    return () => clearTimeout(t);
  }, [budget, maxWeight, activeCategory]);

  // Try to load from Supabase, fall back to mock
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        // Add a 5-second timeout to prevent infinite skeleton state
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const fetchPromise = supabase
          .from('shop_products')
          .select('id, slug, name, brand, category, category_main, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, price_per_day, original_price, condition, starting_bid, ends_at, savings, score_kdv, essentiality, cabin_compatible, versatility_10, product_id')
          .order('score_kdv', { ascending: false })
          .limit(200);

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        if (result && 'data' in result && result.data && result.data.length > 0) {
          setProducts(result.data as ShopProduct[]);
        }
        // else: keep mock data (already set as default state)
      } catch {
        // keep mock data
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Filtered products ──
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const withinBudget = p.price_eur <= budget;
      const withinWeight = p.weight_g <= maxWeight * 1000;
      const matchCat = activeCategory === 'Tout' || p.category === activeCategory;
      const matchType = activeTypes.has(p.transaction_type);
      return withinBudget && withinWeight && matchCat && matchType;
    });
  }, [products, budget, maxWeight, activeCategory, activeTypes]);

  // ── Dynamic summary stats ──
  const stats = useMemo(() => {
    const totalWeight = filtered.reduce((sum, p) => sum + p.weight_g, 0);
    const totalPrice = filtered.reduce((sum, p) => sum + p.price_eur, 0);
    const totalSavings = filtered.reduce((sum, p) => sum + (p.savings || 0), 0);
    return {
      count: filtered.length,
      totalWeight: totalWeight / 1000,
      totalPrice,
      totalSavings,
      budgetUsed: Math.min(totalPrice, budget),
      weightUsed: Math.min(totalWeight / 1000, maxWeight),
    };
  }, [filtered, budget, maxWeight]);

  // ── Toggle transaction type ──
  const toggleType = useCallback((type: TransactionType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // ── Apply preset kit ──
  const applyPreset = useCallback((preset: typeof PRESET_KITS[0]) => {
    setBudget(preset.budget);
    setMaxWeight(preset.weight);
    setActivePresetKit(preset.label);
    setOptimizedResult(null);
  }, []);

  // ── Optimization algorithm ──
  const runOptimization = useCallback(async () => {
    setOptimizing(true);
    setOptimizedResult(null);
    await new Promise((r) => setTimeout(r, 1200));

    // Group products by name, pick cheapest option per group
    const groups = new Map<string, ShopProduct[]>();
    products.forEach((p) => {
      const key = p.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });

    const result: OptimizedKit[] = [];
    let remainingBudget = budget;
    let remainingWeight = maxWeight * 1000;

    // Sort groups by weight ascending (lightest first)
    const sortedGroups = Array.from(groups.entries()).sort(([, a], [, b]) => a[0].weight_g - b[0].weight_g);

    for (const [, variants] of sortedGroups) {
      if (result.length >= 6) break;
      // Pick cheapest variant that fits
      const sorted = [...variants].sort((a, b) => a.price_eur - b.price_eur);
      const best = sorted.find((p) => p.price_eur <= remainingBudget && p.weight_g <= remainingWeight);
      if (best) {
        const maxPrice = Math.max(...variants.map((v) => v.price_eur));
        result.push({
          product: best,
          chosen_type: best.transaction_type,
          chosen_price: best.price_eur,
          savings: maxPrice - best.price_eur,
        });
        remainingBudget -= best.price_eur;
        remainingWeight -= best.weight_g;
      }
    }

    setOptimizedResult(result);
    setOptimizing(false);
  }, [products, budget, maxWeight]);

  const optimizationStats = useMemo(() => {
    if (!optimizedResult) return null;
    return {
      total: optimizedResult.reduce((s, i) => s + i.chosen_price, 0),
      weight: optimizedResult.reduce((s, i) => s + i.product.weight_g, 0) / 1000,
      savings: optimizedResult.reduce((s, i) => s + i.savings, 0),
    };
  }, [optimizedResult]);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        budget={budget}
        setBudget={(v) => { setBudget(v); setActivePresetKit(null); setOptimizedResult(null); }}
        maxWeight={maxWeight}
        setMaxWeight={(v) => { setMaxWeight(v); setActivePresetKit(null); setOptimizedResult(null); }}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        activeTypes={activeTypes}
        toggleType={toggleType}
      />

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden">
        {/* Mobile hero — compact */}
        <div className="pt-16 pb-4 px-4" style={{ background: 'var(--dark-bg)' }}>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-1">Boutique</p>
          <h1 className="font-display font-bold text-white text-2xl leading-tight">
            Équipement <span style={{ color: 'var(--primary)' }}>optimisé</span>
          </h1>
          {/* Preset kits horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide">
            {PRESET_KITS.map((kit) => (
              <button key={kit.label} onClick={() => applyPreset(kit)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  activePresetKit === kit.label ? 'bg-primary text-white border-primary' : 'bg-white/10 text-white/70 border-white/20'
                }`}>
                <span>{kit.icon}</span>{kit.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile sticky filter bar */}
        <div className="sticky top-[52px] z-30 flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: 'var(--dark-bg)' }}>
          <button onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-bold border border-white/20 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filtrer
          </button>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
            {CATEGORIES.slice(0, 8).map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  activeCategory === cat ? 'bg-[#E4501C] text-white border-[#E4501C]' : 'bg-transparent text-white/60 border-white/20'
                }`}>
                {cat}
              </button>
            ))}
          </div>
          <span className="flex-shrink-0 font-mono text-xs text-white/50">{stats.count}</span>
        </div>

        {/* Mobile product list */}
        <div className="px-4 py-4 space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🎒</p>
              <p className="font-display font-bold text-foreground mb-1">Aucun équipement</p>
              <p className="text-muted-foreground text-sm mb-4">Ajustez vos filtres pour voir plus d&apos;options.</p>
              <button onClick={() => setMobileFilterOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">
                Modifier les filtres
              </button>
            </div>
          ) : (
            filtered.map((product) => (
              <MobileProductCard key={product.id} product={product} />
            ))
          )}
        </div>

        {/* Mobile optimize FAB */}
        <div className="fixed left-4 right-4 z-30" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 12px)' }}>
          <button onClick={runOptimization} disabled={optimizing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white shadow-xl transition-all active:scale-[0.98]"
            style={{ background: optimizing ? 'var(--muted)' : 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
            {optimizing ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Optimisation…</>
            ) : (
              <><span>✨</span>Optimiser mon kit</>
            )}
          </button>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (unchanged) ── */}
      <div className="hidden md:block">
        {/* ── Hero ── */}
        <section className="pt-24 pb-8 px-4" style={{ background: 'var(--dark-bg)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <p className="font-mono text-xs text-primary uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                  Travel Operating System
                </p>
                <h1 className="font-display font-800 text-white text-4xl lg:text-5xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Trouvez le meilleur<br />
                  <span style={{ color: 'var(--primary)' }}>équipement pour vous</span>
                </h1>
                <p className="text-white/60 mt-3 text-base max-w-xl">
                  Pas une boutique. Un moteur d&apos;optimisation. Définissez vos contraintes, le système trouve la meilleure solution.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_KITS.map((kit) => (
                  <button key={kit.label} onClick={() => applyPreset(kit)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-600 transition-all duration-200 border ${
                      activePresetKit === kit.label ? 'bg-primary text-white border-primary' : 'bg-white/8 text-white/70 border-white/15 hover:bg-white/15 hover:text-white'
                    }`}>
                    <span>{kit.icon}</span><span>{kit.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Dual Sliders ── */}
        <section className="sticky top-16 z-30 border-b border-border shadow-lg" style={{ background: 'var(--dark-bg)' }}>
          <div className="max-w-7xl mx-auto px-4 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
              <PremiumSlider label="Budget maximal" unit="€" value={budget} min={0} max={1500} step={10}
                onChange={(v) => { setBudget(v); setActivePresetKit(null); setOptimizedResult(null); }}
                accentColor="var(--primary)" />
              <PremiumSlider label="Poids maximal" unit="kg" value={maxWeight} min={1} max={25} step={0.5}
                onChange={(v) => { setMaxWeight(v); setActivePresetKit(null); setOptimizedResult(null); }}
                formatValue={(v) => `${v} kg`} accentColor="var(--info)" />
            </div>
          </div>
        </section>

        {/* ── Dynamic Summary Card ── */}
        <section className="px-4 py-6" style={{ background: 'var(--dark-bg)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="font-mono font-800 text-3xl text-white transition-all duration-300" style={{ fontFamily: 'var(--font-mono)' }}>{stats.count}</p>
                <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Équipements compatibles</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="font-mono font-800 text-3xl transition-all duration-300" style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{stats.budgetUsed.toFixed(0)} €</p>
                <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mt-1" style={{ fontFamily: 'var(--font-mono)' }}>/ {budget} € budget</p>
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (stats.budgetUsed / budget) * 100)}%`, background: 'var(--primary)' }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="font-mono font-800 text-3xl transition-all duration-300" style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{stats.weightUsed.toFixed(1)} kg</p>
                <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mt-1" style={{ fontFamily: 'var(--font-mono)' }}>/ {maxWeight} kg poids</p>
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (stats.weightUsed / maxWeight) * 100)}%`, background: 'var(--info)' }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="font-mono font-800 text-3xl text-emerald-400 transition-all duration-300" style={{ fontFamily: 'var(--font-mono)' }}>{stats.totalSavings > 0 ? `${stats.totalSavings} €` : '—'}</p>
                <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Économie réalisée</p>
              </div>
            </div>
          </div>
        </section>

        <TopoSeparator />

        {/* ── Main content ── */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mr-1 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>Type :</span>
              {(Object.entries(TRANSACTION_BADGE) as [TransactionType, typeof TRANSACTION_BADGE[TransactionType]][]).map(([type, cfg]) => (
                <button key={type} onClick={() => toggleType(type)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-600 transition-all duration-200 border whitespace-nowrap flex-shrink-0 ${
                    activeTypes.has(type) ? cfg.cls : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTypes.has(type) ? cfg.dot : 'bg-muted-foreground'}`} />
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`category-pill text-xs py-1.5 px-3 whitespace-nowrap flex-shrink-0 ${activeCategory === cat ? 'active' : ''}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <p className="font-mono text-sm text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="font-700 text-foreground">{stats.count}</span> équipements dans vos contraintes
            </p>
            <button onClick={runOptimization} disabled={optimizing}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-600 text-sm transition-all duration-200 text-white shadow-lg active:scale-95"
              style={{ background: optimizing ? 'var(--muted)' : 'linear-gradient(135deg, var(--primary), var(--accent))', color: optimizing ? 'var(--muted-foreground)' : 'white' }}>
              {optimizing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Optimisation en cours…</>
              ) : (
                <><span>✨</span>Optimiser automatiquement</>
              )}
            </button>
          </div>

          {optimizedResult && optimizationStats && (
            <div className="mb-10 rounded-2xl border border-primary/30 overflow-hidden" style={{ background: 'var(--card)' }}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h2 className="font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Kit optimisé pour vous</h2>
                </div>
                <button onClick={() => setOptimizedResult(null)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Fermer">
                  <Icon name="XMarkIcon" size={20} variant="outline" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {optimizedResult.map((item) => (<OptimizationResultCard key={item.product.id} item={item} />))}
                </div>
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-background">
                  <div className="text-center">
                    <p className="font-mono font-700 text-xl text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{optimizationStats.total} €</p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Budget final</p>
                  </div>
                  <div className="text-center border-x border-border">
                    <p className="font-mono font-700 text-xl" style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{optimizationStats.weight.toFixed(1)} kg</p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Poids total</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono font-700 text-xl text-emerald-600" style={{ fontFamily: 'var(--font-mono)' }}>{optimizationStats.savings} €</p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Économie réalisée</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="topo-card overflow-hidden" aria-hidden="true">
                  <div className="skeleton aspect-[4/3]" />
                  <div className="p-4 space-y-3">
                    <div className="skeleton h-3 w-20 rounded" />
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="flex justify-between items-center">
                      <div className="skeleton h-5 w-16 rounded" />
                      <div className="skeleton h-8 w-20 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎒</div>
              <h3 className="font-display font-700 text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aucun équipement dans ces contraintes</h3>
              <p className="text-muted-foreground mb-6">Augmentez votre budget ou votre poids maximal pour voir plus d&apos;options.</p>
              <button onClick={() => { setBudget(500); setMaxWeight(15); setActiveCategory('Tout'); }} className="btn-primary">Réinitialiser les filtres</button>
            </div>
          ) : (
            <div key={animKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((product) => (
                <ProductCard key={`${product.id}-${animKey}`} product={product}
                  isOptimized={optimizedResult?.some((r) => r.product.id === product.id) ?? false} />
              ))}
            </div>
          )}
        </main>

        <TopoSeparator />
        <Footer />
      </div>
    </div>
  );
}
