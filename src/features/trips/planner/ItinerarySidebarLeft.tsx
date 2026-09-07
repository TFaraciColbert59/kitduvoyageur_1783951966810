'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Navigation, Package, FileText } from 'lucide-react';
import { GlassSubCard } from '@/components/ui';
import type { TripFull } from '@/features/trips/types/trip.types';

interface ItinerarySidebarLeftProps {
  trip: TripFull;
}

export default function ItinerarySidebarLeft({ trip }: ItinerarySidebarLeftProps) {
  const links = [
    { href: `/voyages/${trip.slug}/kit`, icon: Package, label: 'Kit & Equipement' },
    { href: `/voyages/${trip.slug}/export`, icon: FileText, label: 'Export PDF' },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col gap-3 glass rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-y-auto no-scrollbar border border-white/40 shadow-sm select-none">
      <div className="shrink-0 space-y-2.5">
        <nav aria-label="Retour" className="text-xs">
          <Link href={`/voyages/${trip.slug}`} className="inline-flex items-center gap-1.5 font-medium hover:underline text-[var(--lkv-text-primary)]">
            <ArrowLeft size={13} />
            <span>Retour au cockpit</span>
          </Link>
        </nav>
        <GlassSubCard className="p-3">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-[var(--lkv-text-secondary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">Planificateur</p>
              <h4 className="font-display font-bold text-xs text-[var(--lkv-text-primary)] truncate">{trip.title}</h4>
            </div>
          </div>
        </GlassSubCard>
      </div>
      <nav aria-label="Acces rapide" className="space-y-1.5">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] px-2 mb-1">Acces rapide</p>
        {links.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs flex items-center gap-2 glass-sub-card hover:bg-white text-[var(--lkv-text-primary)] border border-white/60 transition-all min-h-[var(--lkv-touch-min)] shadow-2xs">
            <Icon size={13} className="text-[var(--lkv-text-secondary)] shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-2 border-t border-[var(--lkv-border-subtle)]">
        <span className="text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase">LKDV Planificateur d'Itineraire</span>
      </div>
    </aside>
  );
}