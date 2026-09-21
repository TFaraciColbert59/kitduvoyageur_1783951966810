'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';

export default function ClubProCard() {
  return (
    <Card tone="warn" className="space-y-[var(--space-2)] p-[var(--space-3)] transition-all duration-[var(--motion-control-duration)]">
      <Badge tone="warn" className="font-mono uppercase tracking-widest">
        ⭐ OFFRE PRO
      </Badge>

      <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
        Gérer votre club en <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">professionnel.</span>
      </h3>

      <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
        Statistiques avancées, billetterie d&apos;événements et outils de modération pour vos sorties.
      </p>

      <Link
        href="/abonnements"
        className="mt-[var(--space-1)] inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-on-action)]"
      >
        Découvrir l&apos;offre Club
      </Link>
    </Card>
  );
}
