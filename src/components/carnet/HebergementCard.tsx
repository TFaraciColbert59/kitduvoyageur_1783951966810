'use client';

import React from 'react';
import type { CarnetHebergement } from '@/lib/mock/carnet-chartreuse';
import { Badge, Card } from '@/components/ui';

interface HebergementCardProps {
  hebergement: CarnetHebergement;
}

export default function HebergementCard({ hebergement }: HebergementCardProps) {
  return (
    <Card className="space-y-[var(--space-2)] p-[var(--space-4)] sm:p-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[0.18em] text-[color:var(--lkv-forest-800)]">
          🏕️ NUIT {hebergement.nightNumber} · HÉBERGEMENT
        </span>
        <Badge tone="sage" className="font-mono font-bold">
          {hebergement.price}€
        </Badge>
      </div>

      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div>
          <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            {hebergement.name}{hebergement.nameItalic && <em className="ml-[var(--space-1)] font-serif font-normal italic text-[color:var(--lkv-forest-800)]">{hebergement.nameItalic}</em>}
          </h4>
          <p className="mt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{hebergement.detail}</p>
        </div>
        <span className="shrink-0 font-mono text-[length:var(--lkv-text-caption-2)] italic text-[color:var(--lkv-text-muted)]">
          {hebergement.priceLabel}
        </span>
      </div>
    </Card>
  );
}
