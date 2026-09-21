'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card } from '@/components/ui';

interface CarnetRightSidebarProps {
  totalCarnets?: number;
  featuredCarnet?: {
    id: string;
    title: string;
    destination?: string;
    author_name?: string;
    likes_count?: number;
  };
}

export default function CarnetRightSidebar({
  totalCarnets = 0,
  featuredCarnet,
}: CarnetRightSidebarProps) {
  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col gap-[var(--space-4)] overflow-y-auto pb-[var(--space-8)]">
      <Card tone="warn" className="relative space-y-[var(--space-2)] overflow-hidden p-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <Badge tone="warn" className="font-mono font-bold uppercase">
            ⭐ COUP DE CŒUR
          </Badge>
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sand-500)]" />
        </div>

        <div>
          <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
            {featuredCarnet?.title || 'Traversée de la Chartreuse en bivouac'}
          </h3>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            📍 {featuredCarnet?.destination || 'Massif de la Chartreuse'} · Par {featuredCarnet?.author_name || 'Julien M.'}
          </p>
        </div>

        <Link
          href={`/carnets/${featuredCarnet?.id || 'exemple'}`}
          className="inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-on-action)]"
        >
          Découvrir le récit →
        </Link>
      </Card>

      <Card className="space-y-[var(--space-2)] p-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            Statistiques Communauté
          </h2>
          <Badge className="font-mono font-bold">Live</Badge>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)]">
          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Carnets</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">{totalCarnets || 24} publiés</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Distance</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">+4 280 km</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Dénivelé +</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">+185 000 m</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Traces GPX</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">100% Vérifiées</span>
          </Card>
        </div>
      </Card>

      <Card tone="sage" className="space-y-[var(--space-2)] p-[var(--space-3)] transition-all duration-[var(--motion-control-duration)]">
        <Badge className="font-mono uppercase tracking-widest">
          🎒 RETOUR D&apos;AVENTURE
        </Badge>

        <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
          Vous revenez d&apos;expédition ?
        </h3>

        <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          Importez votre fichier GPX et vos photos pour archiver votre aventure dans un carnet souvenir.
        </p>

        <Link
          href="/carnets/nouveau"
          className="mt-[var(--space-1)] inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-on-action)]"
        >
          <Icon name="PlusIcon" size={14} aria-hidden="true" />
          <span>Créer mon carnet</span>
        </Link>
      </Card>
    </aside>
  );
}
