'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, ArrowRight, Radio, Package, X } from 'lucide-react';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';

export function ResumeActiveTripCard() {
  const { activeTrip, clearActiveTrip, isPending } = useActiveTrip();

  if (!activeTrip) return null;

  return (
    <section className="relative z-20 max-w-[1200px] mx-auto px-4 pt-24 -mb-16">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--lkv-primary)] via-[var(--lkv-primary-soft)] to-[var(--lkv-primary-soft)] text-white border border-[var(--lkv-secondary)]/30 p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all hover:border-[var(--lkv-secondary)]/50">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--lkv-secondary)]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[var(--lkv-secondary)]/20 text-white border border-[var(--lkv-secondary)]/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--lkv-secondary)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--lkv-secondary)]" />
                </span>
                Expédition en cours
              </span>
              <span className="text-xs text-white/50 hidden sm:inline">• Reprise rapide</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              {activeTrip.title}
            </h3>
            <p className="text-xs sm:text-sm text-white/70">
              Votre itinéraire et matériel sont synchronisés sur tout le site.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
            <Link
              href={tripSectionHref(activeTrip.slug, 'overview')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--lkv-secondary)] text-[var(--lkv-primary)] font-bold text-xs hover:bg-[var(--lkv-secondary)]/90 transition-transform active:scale-95 shadow-sm"
            >
              <Compass size={14} />
              <span>Reprendre le voyage</span>
              <ArrowRight size={13} />
            </Link>

            <Link
              href={`${tripSectionHref(activeTrip.slug, 'overview')}?phase=live`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-all"
            >
              <Radio size={13} className="text-[var(--lkv-secondary)]" />
              <span>Cockpit</span>
            </Link>

            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-all"
            >
              <Package size={13} className="text-[var(--lkv-secondary)]" />
              <span>Mon sac</span>
            </Link>

            <button
              type="button"
              onClick={() => clearActiveTrip()}
              disabled={isPending}
              aria-label="Fermer l'expédition active"
              title="Désactiver l'expédition active"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors border border-white/10"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
