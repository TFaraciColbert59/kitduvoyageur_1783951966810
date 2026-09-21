'use client';

import React from 'react';
import type { CarnetJour } from '@/lib/mock/carnet-chartreuse';
import { Badge, Card } from '@/components/ui';

interface JourCardProps {
  jour: CarnetJour;
}

export default function JourCard({ jour }: JourCardProps) {
  return (
    <Card className="space-y-[var(--space-3)] p-[var(--space-4)] sm:p-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[0.18em] text-[color:var(--lkv-text-muted)]">
          {jour.label}
        </span>
        {jour.titleItalic && (
          <Badge tone="sage" className="font-mono font-bold">
            {jour.titleItalic}
          </Badge>
        )}
      </div>

      <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
        {jour.title} <span className="font-serif font-normal italic text-[color:var(--lkv-forest-800)]">{jour.titleItalic}</span>
      </h3>

      <p className="pl-[2px] font-sans text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
        {jour.recit}
      </p>

      {jour.stats && jour.stats.length > 0 && (
        <div className="flex flex-wrap gap-[var(--space-1)] border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)]">
          {jour.stats.map((s, i) => (
            <Badge key={i} className="font-mono font-semibold">
              <span aria-hidden>{s.icon}</span> {s.label}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
