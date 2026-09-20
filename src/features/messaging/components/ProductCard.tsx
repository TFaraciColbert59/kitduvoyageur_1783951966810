"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { ProductMessageMeta } from '../types/messaging.types';

interface ProductCardProps {
  meta: ProductMessageMeta;
  isMine: boolean;
}

const formatPrice = (cents?: number | null): string | null => {
  if (cents == null) return null;
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
};

export const ProductCard: React.FC<ProductCardProps> = ({ meta, isMine }) => {
  const href = meta.product_slug ? `/produit/${meta.product_slug}` : '/hub/inventaire';
  const title = meta.name || 'Équipement LKDV';
  const price = formatPrice(meta.price_cents);
  const imgSrc = meta.photo_url || '/assets/images/no_image.png';

  return (
    <Link
      href={href}
      className={`mt-[var(--space-2)] flex max-w-[240px] flex-col overflow-hidden rounded-[var(--lkv-radius-md)] border shadow-elevation-1 transition-transform active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]'
          : 'border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)]'
      }`}
    >
      <div className="relative h-24 w-full bg-[color:var(--lkv-surface-muted)]">
        <Image
          src={imgSrc}
          alt={title}
          fill
          className="object-cover"
          sizes="240px"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
          }}
        />
        <Badge
          tone={isMine ? 'sage' : 'stone'}
          className="absolute left-1.5 top-1.5 uppercase tracking-wider backdrop-blur-[var(--blur-sm)]"
        >
          Équipement
        </Badge>
      </div>
      <div
        className={`flex items-center justify-between gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] ${
          isMine ? 'text-[color:var(--lkv-text-inverted)]' : 'text-[color:var(--lkv-text-primary)]'
        }`}
      >
        <p className="truncate text-[length:var(--lkv-text-caption)] font-bold">{title}</p>
        {price && (
          <span
            className={`shrink-0 text-[length:var(--lkv-text-caption)] font-bold ${
              isMine ? 'text-[color:var(--lkv-text-inverted)]/90' : 'text-[color:var(--lkv-forest-700)]'
            }`}
          >
            {price}
          </span>
        )}
      </div>
    </Link>
  );
};
