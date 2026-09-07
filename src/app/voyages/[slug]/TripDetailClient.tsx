'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { GlassCard, GlassPill, GlassCapsuleBtn, GlassSubCard } from '@/components/ui';
import { TripHero } from '@/features/trips/components/TripHero';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import { TripOfflineBar } from '@/features/trips/components/TripOfflineBar';
import { ArrowLeft, Share2, Compass, Check, Calendar, Users, MapPin, Sparkles } from 'lucide-react';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';
import { useTripStatus } from '@/features/trips/hooks/useTripStatus';
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

  // 5. Gestion du voyage actif global (Phase 6.1)
  const { isCurrentTripActive, setActiveTrip, clearActiveTrip, isPending: isActiveTripPending } = useActiveTrip();
  const isTripActive = isCurrentTripActive(trip.id);

  const { isActive: statusIsActive } = useTripStatus(trip);
  const showActiveState = isTripActive && statusIsActive;

  const handleToggleActiveTrip = async () => {
    if (isTripActive) {
      await clearActiveTrip();
    } else {
      await setActiveTrip({
        id: trip.id,
        slug: trip.slug,
        title: trip.title,
      });
    }
  };

  // Colonne Gauche Desktop (260px)
  const renderSidebarLeft = () => (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-2xl p-3.5 text-forest-900 font-sans overflow-y-auto no-scrollbar border border-white/40 shadow-sm select-none gap-3">
      <div className="space-y-3 shrink-0">
        {/* En-tête navigation / retour */}
        <nav aria-label="Fil d'Ariane" className="space-y-1 text-xs text-forest-800">
          <Link
            href="/voyages"
            className="inline-flex items-center gap-1.5 font-medium hover:underline text-forest-900"
          >
            <ArrowLeft size={13} />
            <span>Tous les voyages</span>
          </Link>
          {trip.group_id && (
            <div className="pt-0.5">
              <Link
                href={`/groupes/${trip.group_id}`}
                className="hover:underline flex items-center gap-1 font-medium text-sage-800"
              >
                Équipage associé
              </Link>
            </div>
          )}
        </nav>

        {/* Mini fiche identité voyage */}
        <GlassSubCard className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">🧭</span>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-bold text-xs sm:text-sm text-forest-900 truncate leading-tight">
                {trip.title}
              </h4>
              <span className="text-[10px] font-mono text-sage-700 block truncate">
                {getPhaseLabel(activePhase)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <GlassPill className="text-[9px] font-mono font-bold">
              {trip.status}
            </GlassPill>
            {trip.destination_country_code && (
              <GlassPill className="text-[9px] font-mono">
                {trip.destination_country_code}
              </GlassPill>
            )}
          </div>
        </GlassSubCard>

        {/* Pilule Expédition Active */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleToggleActiveTrip}
            disabled={isActiveTripPending}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all border min-h-[44px] ${
              showActiveState
                ? 'bg-[var(--lkv-success)] text-white border-[var(--lkv-success)] shadow-xs'
                : 'glass-capsule-btn text-forest-900'
            }`}
          >
            {showActiveState ? (
              <Check size={14} className="text-white shrink-0" />
            ) : (
              <Compass size={14} className="text-forest-700 shrink-0" />
            )}
            <span>{showActiveState ? 'Expédition Active' : 'Activer l’expédition'}</span>
          </button>
        </div>

        {/* Action Partager / Exporter */}
        <GlassCapsuleBtn
          variant="secondary"
          size="sm"
          onClick={() => setIsShareOpen(true)}
          className="w-full flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Share2 size={13} className="shrink-0" />
          <span>Partager / Exporter</span>
        </GlassCapsuleBtn>
      </div>

      {/* Pied de sidebar */}
      <div className="pt-4 border-t border-white/30 text-[10px] text-sage-700 space-y-1">
        <div className="flex items-center justify-between">
          <span>Mode connecté</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--lkv-success)]" />
        </div>
        <div>LKDV VOYAGE COCKPIT</div>
      </div>
    </aside>
  );

  // Colonne Droite Desktop (300px)
  const renderSidebarRight = () => (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      {/* 1. Statut & Synchronisation Hors-ligne */}
      <GlassCard className="p-3">
        <TripOfflineBar trip={trip} />
      </GlassCard>

      {/* 2. Compte à rebours / Calendrier */}
      <GlassCard className="p-3.5 space-y-2 text-forest-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-sage-800 flex items-center gap-1.5">
            <Calendar size={13} />
            <span>Calendrier</span>
          </span>
          {phaseDetails.daysUntilStart !== null && phaseDetails.daysUntilStart !== undefined && (
            <GlassPill tone="warn" className="text-[9px] font-mono font-bold">
              {phaseDetails.daysUntilStart > 0
                ? `J-${phaseDetails.daysUntilStart}`
                : phaseDetails.daysUntilStart === 0
                ? 'Aujourd’hui'
                : 'Terminé'}
            </GlassPill>
          )}
        </div>
        <div className="text-xs space-y-1 pt-1">
          <div className="flex justify-between text-forest-800">
            <span>Début :</span>
            <span className="font-mono font-semibold">{trip.start_date || 'Non défini'}</span>
          </div>
          <div className="flex justify-between text-forest-800">
            <span>Fin :</span>
            <span className="font-mono font-semibold">{trip.end_date || 'Non défini'}</span>
          </div>
        </div>
      </GlassCard>

      {/* 3. Métriques clés d'équipage & itinéraire */}
      <GlassCard className="p-3.5 space-y-2.5 text-forest-900">
        <span className="text-xs font-bold uppercase tracking-wider text-sage-800 flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Fiche Technique</span>
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Activité</span>
            <span className="font-semibold capitalize">{trip.primary_activity || 'Trek'}</span>
          </div>
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Difficulté</span>
            <span className="font-semibold capitalize">{trip.difficulty || 'Moyenne'}</span>
          </div>
        </div>
      </GlassCard>
    </aside>
  );

  return (
    <AppShellDesktop
      sidebarLeft={renderSidebarLeft()}
      sidebarRight={renderSidebarRight()}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={true}>
          <div className="max-w-7xl mx-auto px-4 py-4 pb-28 space-y-4 text-forest-900">
            {/* Mobile Header Nav */}
            <div className="flex items-center justify-between gap-2">
              <Link href="/voyages" className="text-xs font-medium text-forest-800 flex items-center gap-1">
                <ArrowLeft size={13} />
                <span>Voyages</span>
              </Link>
              <button
                type="button"
                onClick={handleToggleActiveTrip}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border min-h-[44px] ${
                  showActiveState
                    ? 'bg-[var(--lkv-success)] text-white border-[var(--lkv-success)]'
                    : 'glass-capsule-btn text-forest-900'
                }`}
              >
                {showActiveState ? <Check size={13} /> : <Compass size={13} />}
                <span>{showActiveState ? 'Active' : 'Activer'}</span>
              </button>
            </div>

            <TripOfflineBar trip={trip} />
            <TripHero trip={trip} />
            <TripPhaseController
              activePhase={activePhase}
              naturalPhase={naturalPhase}
              onPhaseChange={handlePhaseChange}
              dayIndex={phaseDetails.dayIndex}
              totalDays={phaseDetails.totalDays}
              daysUntilStart={phaseDetails.daysUntilStart}
            />

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
          </div>
        </MobilePageShell>
      }
    >
      <div className="space-y-4">
        {/* Cockpit Header : ≤ 3 Métriques + Titre Display */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl glass border border-white/60">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-sage-800 font-bold block">
              Expédition Outdoor
            </span>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-forest-900 tracking-tight">
              {trip.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <GlassSubCard className="!p-2 text-center min-w-[70px]">
              <span className="text-[9px] text-sage-700 block uppercase font-mono">Phase</span>
              <span className="text-xs font-bold text-forest-900 capitalize">
                {getPhaseLabel(activePhase)}
              </span>
            </GlassSubCard>
            <GlassSubCard className="!p-2 text-center min-w-[70px]">
              <span className="text-[9px] text-sage-700 block uppercase font-mono">Statut</span>
              <span className="text-xs font-bold text-forest-900 uppercase">
                {trip.status}
              </span>
            </GlassSubCard>
            {trip.destination_country_code && (
              <GlassSubCard className="!p-2 text-center min-w-[60px]">
                <span className="text-[9px] text-sage-700 block uppercase font-mono">Pays</span>
                <span className="text-xs font-bold text-forest-900">
                  {trip.destination_country_code}
                </span>
              </GlassSubCard>
            )}
          </div>
        </div>

        {/* 1. Hero Immersif */}
        <TripHero trip={trip} />

        {/* 2. Contrôleur de Phase Temporelle Unifié */}
        <TripPhaseController
          activePhase={activePhase}
          naturalPhase={naturalPhase}
          onPhaseChange={handlePhaseChange}
          dayIndex={phaseDetails.dayIndex}
          totalDays={phaseDetails.totalDays}
          daysUntilStart={phaseDetails.daysUntilStart}
        />

        {/* 3. Vue de la phase sélectionnée */}
        <div className="pt-2">
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
        </div>

        {/* Modal de partage & export */}
        <TripShareModal
          trip={trip}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      </div>
    </AppShellDesktop>
  );
}
