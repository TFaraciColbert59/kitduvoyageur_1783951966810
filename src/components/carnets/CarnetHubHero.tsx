'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge } from '@/components/ui';

interface CarnetHubHeroProps {
  totalCarnets?: number;
  totalKm?: number;
  onCreateClick?: () => void;
}

export default function CarnetHubHero({
  totalCarnets = 0,
  totalKm = 4280,
  onCreateClick,
}: CarnetHubHeroProps) {
  return (
    <div className="relative flex flex-col items-start justify-between gap-[var(--space-6)] overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-base)] backdrop-blur-[var(--glass-blur)] p-[var(--space-6)] text-white sm:p-[var(--space-8)] md:flex-row md:items-end shadow-lg">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[35rem] w-[35rem] rounded-full bg-white opacity-5 blur-[90px]" />

      <div className="relative z-10 max-w-xl">
        <Badge className="mb-[var(--space-4)] border-white/20 bg-white/10 text-white">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest">
            MÉMOIRE OUTDOOR · {totalCarnets} EXPÉDITIONS
          </span>
        </Badge>

        <h1 className="mb-[var(--space-4)] text-[length:var(--lkv-text-title-lg)] leading-[1.15] text-white sm:text-[length:var(--lkv-text-title-xl)] md:text-5xl">
          <span className="block font-display font-bold">Carnets d&apos;expédition</span>
          <span className="font-serif font-normal italic text-white/80">Récits, traces et mémoires</span>
        </h1>

        <p className="mb-[var(--space-6)] max-w-lg font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-white/70 sm:text-[length:var(--lkv-text-caption)]">
          Explorez les aventures vécues par la communauté LKDV. Traces GPX, hébergements, retours d&apos;équipement et photos de bivouac.
        </p>

        <div className="flex flex-wrap items-center gap-[var(--space-4)] font-mono text-[length:var(--lkv-text-caption-2)] sm:gap-[var(--space-6)]">
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-white/60">Récits</span>
            <span className="text-[length:var(--lkv-text-caption)] font-bold text-white">{totalCarnets}</span>
          </div>
          <div aria-hidden className="h-6 w-px bg-white/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-white/60">Distance totale</span>
            <span className="text-[length:var(--lkv-text-caption)] font-bold text-white">{totalKm} km</span>
          </div>
          <div aria-hidden className="h-6 w-px bg-white/20" />
          <div className="flex flex-col">
            <span className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-white/60">Traces GPX</span>
            <span className="text-[length:var(--lkv-text-caption)] font-bold text-white">100% Libres</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex w-full flex-col items-end gap-[var(--space-3)] md:w-auto">
        <Link
          href="/carnets/nouveau"
          onClick={onCreateClick}
          className="inline-flex min-h-[var(--control-height-lg)] w-full items-center justify-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-6)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-2 md:w-auto"
        >
          <Icon name="PlusIcon" size={16} aria-hidden="true" />
          <span>Créer un carnet</span>
        </Link>
      </div>
    </div>
  );
}
