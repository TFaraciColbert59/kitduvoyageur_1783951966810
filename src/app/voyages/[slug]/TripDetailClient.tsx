'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { TripHero } from '@/features/trips/components/TripHero';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import { TripOfflineBar } from '@/features/trips/components/TripOfflineBar';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';
import type { AffiliateLink } from '@/features/affiliation';

import {
  getTripPhaseDetails,
  isValidTripPhase,
  getPhaseLabel,
  type TripPhase,
} from '@/features/trips/engine/temporalPhaseEngine';
import { TripPhaseController } from '@/features/trips/components/TripPhaseController';
import { TripPhasePrepareView } from '@/features/trips/components/TripPhasePrepareView';
import { TripLiveCockpitView } from '@/features/trips/components/TripLiveCockpitView';
import { TripPhaseRecountView } from '@/features/trips/components/TripPhaseRecountView';

export interface TripDetailClientProps {
  trip: TripFull;
  stats: TripStats;
  affiliateLinks?: AffiliateLink[];
  kitAnalysis?: TripKitAnalysis;
  initialPhase?: TripPhase;
}

export default function TripDetailClient({
  trip,
  stats,
  affiliateLinks = [],
  kitAnalysis,
  initialPhase,
}: TripDetailClientProps) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  // 1. Calcul pur et déterministe de la phase temporelle
  const phaseDetails = getTripPhaseDetails(trip);
  const naturalPhase = phaseDetails.phase;

  // 2. Phase active (avec priorité au query param URL ?phase= ou initialPhase)
  const [activePhase, setActivePhase] = useState<TripPhase>(() => {
    if (initialPhase && isValidTripPhase(initialPhase)) {
      return initialPhase;
    }
    return naturalPhase;
  });

  // 3. Synchronisation avec l'URL côté client au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPhase = params.get('phase');
      if (urlPhase && isValidTripPhase(urlPhase)) {
        setActivePhase(urlPhase);
      }
    }
  }, []);

  // 4. Gestionnaire de bascule manuelle de phase
  const handlePhaseChange = (newPhase: TripPhase) => {
    setActivePhase(newPhase);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('phase', newPhase);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 space-y-4">
        {/* Navigation fil d'Ariane & Action Partager */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-lkv-secondary">
            <Link href="/voyages" className="hover:underline flex items-center gap-1 font-medium">
              <ArrowLeft size={13} />
              Voyages
            </Link>
            <span>/</span>
            <span className="text-lkv-primary font-semibold truncate max-w-[140px] sm:max-w-xs">
              {trip.title}
            </span>
            <span>/</span>
            <span className="text-lkv-secondary font-medium hidden sm:inline">
              {getPhaseLabel(activePhase)}
            </span>
          </div>

          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-lkv-primary border border-black/10 shadow-2xs transition-all hover:scale-102 min-h-[38px]"
          >
            <Share2 size={13} className="text-lkv-secondary" />
            <span>Partager / Exporter</span>
          </button>
        </div>

        {/* Barre de statut Hors-Ligne */}
        <TripOfflineBar trip={trip} />

        {/* 1. Hero Immersif */}
        <TripHero trip={trip} />

        {/* 2. Contrôleur de Phase Temporelle Unifié (Préparer / Vivre / Raconter) */}
        <TripPhaseController
          activePhase={activePhase}
          naturalPhase={naturalPhase}
          onPhaseChange={handlePhaseChange}
          dayIndex={phaseDetails.dayIndex}
          totalDays={phaseDetails.totalDays}
          daysUntilStart={phaseDetails.daysUntilStart}
        />

        {/* 3. Vue de la phase sélectionnée */}
        <main className="pt-2">
          {activePhase === 'prepare' && (
            <TripPhasePrepareView
              trip={trip}
              stats={stats}
              affiliateLinks={affiliateLinks}
              kitAnalysis={kitAnalysis}
              daysUntilStart={phaseDetails.daysUntilStart}
            />
          )}

          {activePhase === 'live' && (
            <TripLiveCockpitView
              trip={trip}
              stats={stats}
              dayIndex={phaseDetails.dayIndex}
              totalDays={phaseDetails.totalDays}
            />
          )}

          {activePhase === 'recount' && (
            <TripPhaseRecountView trip={trip} />
          )}
        </main>

        {/* Modal de partage & export */}
        <TripShareModal
          trip={trip}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      </div>
    </AppShell>
  );
}
