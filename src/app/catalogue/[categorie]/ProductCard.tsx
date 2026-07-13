'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import WeightGauge from '@/components/WeightGauge';
import Icon from '@/components/ui/AppIcon';
import { addToCart } from '@/lib/cart';

interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  weightG: number;
  priceEur: number;
  stock: number;
  image: string;
  imageAlt: string;
  badge?: string;
  description: string;
}

export default function ProductCard({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      priceEur: product.priceEur,
      weightG: product.weightG,
      image: product.image,
      imageAlt: product.imageAlt,
      category: product.category,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link href={`/produit/${product.slug}`} className="group block">
      <article className="topo-card overflow-hidden h-full flex flex-col">
        <div className="relative h-48 overflow-hidden">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.badge && (
            <div className="absolute top-2 left-2">
              <span className="text-[10px] font-mono px-2 py-0.5 bg-primary text-white rounded font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                {product.badge}
              </span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${product.stock > 10 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : product.stock > 0 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-500 bg-red-50 border-red-200'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {product.stock > 10 ? 'En stock' : product.stock > 0 ? `${product.stock} restants` : 'Rupture'}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
            {product.brand}
          </p>
          <h2 className="font-display font-700 text-foreground text-sm leading-tight mb-2 flex-1" style={{ fontFamily: 'var(--font-display)' }}>
            {product.name}
          </h2>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>

          <WeightGauge weightG={product.weightG} maxG={5000} size="sm" />

          <div className="flex items-center justify-between mt-3">
            <span className="font-mono font-700 text-foreground text-base" style={{ fontFamily: 'var(--font-mono)' }}>
              {product.priceEur.toFixed(2)} €
            </span>
            <button
              onClick={handleAdd}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                added ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90'
              }`}
              aria-label={`Ajouter ${product.name} au panier`}
            >
              <Icon name={added ? 'CheckIcon' : 'ShoppingBagIcon'} size={12} variant="outline" />
              {added ? 'Ajouté !' : 'Ajouter'}
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}
