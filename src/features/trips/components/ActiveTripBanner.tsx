'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveTrip } from '../context/ActiveTripContext';
import { X, ArrowRight } from 'lucide-react';

export function ActiveTripBanner() {
  const { activeTrip, clearActiveTrip, isPending } = useActiveTrip();
  const pathname = usePathname();

  if (!activeTrip) return null;

  // Si on est déjà sur la page du voyage actif, ne pas encombrer l'écran
  const isCurrentlyOnTripPage = pathname === `/voyages/${activeTrip.slug}`;

  return (
    <div className="w-full bg-lkv-primary text-white border-b border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 text-xs transition-all animate-in slide-in-from-top-2 duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-white/70 font-medium">Voyage actif :</span>
            <span className="font-bold text-white truncate">{activeTrip.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCurrentlyOnTripPage && (
            <Link
              href={`/voyages/${activeTrip.slug}`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold transition-all min-h-[32px]"
            >
              <span>Accéder</span>
              <ArrowRight size={12} />
            </Link>
          )}

          <button
            type="button"
            onClick={() => clearActiveTrip()}
            disabled={isPending}
            className="p-1.5 rounded-full hover:bg-white/15 text-white/70 hover:text-white transition-all min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Détacher le voyage actif"
            aria-label="Fermer l'expédition active"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
