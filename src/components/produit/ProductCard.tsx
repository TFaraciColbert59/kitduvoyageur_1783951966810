'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card } from '@/components/ui';

export interface ProductCardProps {
  image: string;
  imageAlt: string;
  /** Pastilles de statut en haut à gauche (état, disponibilité). */
  badges?: React.ReactNode;
  /** Information de coin en haut à droite (distance, remise). */
  corner?: React.ReactNode;
  title: string;
  secondary?: React.ReactNode;
  tags?: readonly string[];
  price: React.ReactNode;
  priceSuffix?: string;
  /** Complément aligné à droite du prix (note, vendeur). */
  aside?: React.ReactNode;
  /** Ligne secondaire basse (localisation, vendeur, négociable). */
  meta?: React.ReactNode;
  /** Libellé d'action uniforme — la carte entière reste le contrôle. */
  ctaLabel?: string;
  onClick?: () => void;
}

/**
 * ProductCard — pattern unique des cartes produit du catalogue (Phase 2, Lot 6).
 * Même image (4/3, lazy, zoom doux), mêmes badges, même typographie, même
 * prix, même CTA partout : occasion, location et déclinaisons boutique.
 */
export default function ProductCard({
  image,
  imageAlt,
  badges,
  corner,
  title,
  secondary,
  tags,
  price,
  priceSuffix,
  aside,
  meta,
  ctaLabel,
  onClick,
}: ProductCardProps) {
  return (
    <Card
      variant={onClick ? 'interactive' : 'standard'}
      onClick={onClick}
      className="group flex flex-col overflow-hidden p-0"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-[var(--lkv-radius-card)] bg-[color:var(--glass-bg-medium)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {badges && (
          <div className="absolute left-[var(--space-2)] top-[var(--space-2)] flex flex-wrap gap-[var(--space-1)]">
            {badges}
          </div>
        )}
        {corner && <div className="absolute right-[var(--space-2)] top-[var(--space-2)]">{corner}</div>}
      </div>

      <div className="flex flex-1 flex-col p-[var(--space-4)]">
        <h3 className="mb-[var(--space-1)] line-clamp-2 font-display text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          {title}
        </h3>
        {secondary && (
          <p className="mb-[var(--space-3)] line-clamp-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
            {secondary}
          </p>
        )}

        {tags && tags.length > 0 && (
          <div className="mb-[var(--space-3)] flex flex-wrap gap-[var(--space-1)]">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="stone">{tag}</Badge>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-[var(--space-2)]">
          <div className="flex items-center justify-between gap-[var(--space-2)]">
            <div className="flex items-baseline gap-[var(--space-1)]">
              <span className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
                {price}
              </span>
              {priceSuffix && (
                <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{priceSuffix}</span>
              )}
            </div>
            {aside && <div className="flex items-center gap-[var(--space-1)]">{aside}</div>}
          </div>

          {meta && (
            <div className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              {meta}
            </div>
          )}
        </div>

        {ctaLabel && (
          <span className="mt-[var(--space-3)] inline-flex min-h-[var(--control-height-sm)] w-full items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
            {ctaLabel}
            <Icon name="arrow-right" size={14} />
          </span>
        )}
      </div>
    </Card>
  );
}
