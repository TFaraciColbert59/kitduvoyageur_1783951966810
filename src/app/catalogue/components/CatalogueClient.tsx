'use client';

import React, { useState } from 'react';


import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';



// ── Types ──────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  activity: string[];
  weight_g: number;
  price_eur: number;
  stock: number;
  image: string;
  image_alt: string;
  badge?: string;
}

type _SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'weight-asc' | 'weight-desc';

// ── Product Card ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProductCard_({ product, onAddToCart }: { product: Product; onAddToCart: (id: string) => void }) {
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdded(true);
    onAddToCart(product.id);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article className="product-card group" aria-label={`${product.name} — ${product.price_eur} € — ${product.weight_g} g`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <AppImage
          src={product.image}
          alt={product.image_alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.3) 0%, transparent 50%)' }} />
        {product.badge && (
          <div className="absolute top-3 left-3">
            <span className="tag-badge" style={{ background: 'var(--primary)', color: 'white' }}>{product.badge}</span>
          </div>
        )}
        {product.stock <= 5 && (
          <div className="absolute top-3 right-3">
            <span className="tag-badge tag-alert">Stock limité</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: 'var(--font-mono)' }}>
              {product.brand}
            </p>
            <h3 className="font-display font-700 text-foreground text-sm leading-tight mt-0.5 line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>
              {product.name}
            </h3>
          </div>
        </div>
        <span className="tag-badge tag-activity text-[10px] mt-2 mb-3 inline-block">{product.category}</span>
        <div className="mb-3">
          <WeightGauge weightG={product.weight_g} maxG={2000} size="sm" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-data text-lg font-600 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            {product.price_eur} €
          </span>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all duration-200 min-h-[36px] ${
              added ? 'bg-secondary text-white' : product.stock === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'
            }`}
            aria-label={added ? 'Ajouté au panier' : `Ajouter ${product.name} au panier`}
          >
            <Icon name={added ? 'CheckIcon' : 'PlusIcon'} size={14} variant="outline" />
            {added ? 'Ajouté' : product.stock === 0 ? 'Épuisé' : 'Ajouter'}
          </button>
        </div>
      </div>
    </article>
  );
}

function _SkeletonCard() {
  return (
    <div className="topo-card overflow-hidden" aria-hidden="true">
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
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CatalogueClient() {
  return null;
}