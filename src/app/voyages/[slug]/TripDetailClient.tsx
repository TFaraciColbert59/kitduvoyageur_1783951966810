'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { GlassCard, GlassPill } from '@/components/ui';
import { TripHero } from '@/features/trips/components/TripHero';
import { TripCompactHeader } from '@/features/trips/components/TripCompactHeader';
import TripSidebarLeft, { type TripSectionId } from '@/features/trips/components/TripSidebarLeft';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import { TripOfflineBar } from '@/features/trips/components/TripOfflineBar';
import { TripPhaseController } from '@/features/trips/components/TripPhaseController';
import { TripPhasePrepareView } from '@/features/trips/components/TripPhasePrepareView';
import { TripLiveCockpitView } from '@/features/trips/components/TripLiveCockpitView';
import { TripPhaseRecountView } from '@/features/trips/components/TripPhaseRecountView';
import { ArrowLeft, Calendar, Sparkles } from 'lucide-react';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';
import { useTripStatus } from '@/features/trips/hooks/useTripStatus';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';
import type { AffiliateLink } from '@/features/affiliation';
import type { PrepareSectionId } from '@/features/trips/components/TripPhasePrepareView';
import {
  getTripPhaseDetails,
  isValidTripPhase,
  type TripPhase,
} from '@/features/trips/engine/temporalPhaseEngine';

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

  const phaseDetails = getTripPhaseDetails(trip);
  const naturalPhase = phaseDetails.phase;
  const [activePhase, setActivePhase] = useState<TripPhase>(() => {
    if (initialPhase && isValidTripPhase(initialPhase)) return initialPhase;
    return naturalPhase;
  });

  const [activeSection, setActiveSection] = useState<TripSectionId>('overview');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPhase = params.get('phase');
      if (urlPhase && isValidTripPhase(urlPhase)) {
        setActivePhase(urlPhase);
      }
    }
  }, []);

  useEffect(() => {
    const handleDetailTabChange = (e: any) => {
      if (e.detail) {
        setActiveSection(e.detail as TripSectionId);
      }
    };
    window.addEventListener('voyage-detail-tab-change', handleDetailTabChange);
    return () => window.removeEventListener('voyage-detail-tab-change', handleDetailTabChange);
  }, []);

  const handleSectionChange = (section: TripSectionId) => {
    setActiveSection(section);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voyage-detail-tab-change', { detail: section }));
    }
  };

  const handlePhaseChange = (newPhase: TripPhase) => {
    setActivePhase(newPhase);
    handleSectionChange('overview');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('phase', newPhase);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const { isCurrentTripActive, setActiveTrip, clearActiveTrip, isPending: isActiveTripPending } = useActiveTrip();
  const isTripActive = isCurrentTripActive(trip.id);
  const { isActive: statusIsActive } = useTripStatus(trip);
  const showActiveState = isTripActive && statusIsActive;

  const handleToggleActiveTrip = async () => {
    if (isTripActive) {
      await clearActiveTrip();
    } else {
      await setActiveTrip({ id: trip.id, slug: trip.slug, title: trip.title });
    }
  };

  const renderSidebarLeft = () => (
    <TripSidebarLeft
      trip={trip}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      activePhase={activePhase}
      onToggleActive={handleToggleActiveTrip}
      isTripActive={showActiveState}
      isPending={isActiveTripPending}
      onShare={() => setIsShareOpen(true)}
    />
  );

  const renderSidebarRight = () => (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      <GlassCard className="p-3">
        <TripOfflineBar trip={trip} />
      </GlassCard>
      <GlassCard className="p-3.5 space-y-2 text-[var(--lkv-text-primary)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
            <Calendar size={13} />
            <span>Calendrier</span>
          </span>
          {phaseDetails.daysUntilStart !== null && phaseDetails.daysUntilStart !== undefined && (
            <GlassPill tone="warn" className="text-[9px] font-mono font-bold">
              {phaseDetails.daysUntilStart > 0 ? `J-${phaseDetails.daysUntilStart}` : phaseDetails.daysUntilStart === 0 ? "Aujourd'hui" : 'Termine'}
            </GlassPill>
          )}
        </div>
        <div className="text-xs space-y-1 pt-1">
          <div className="flex justify-between text-[var(--lkv-text-primary)]">
            <span>Debut :</span>
            <span className="font-mono font-semibold">{trip.start_date || 'Non defini'}</span>
          </div>
          <div className="flex justify-between text-[var(--lkv-text-primary)]">
            <span>Fin :</span>
            <span className="font-mono font-semibold">{trip.end_date || 'Non defini'}</span>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="p-3.5 space-y-2.5 text-[var(--lkv-text-primary)]">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Fiche Technique</span>
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-[var(--lkv-radius-md)] bg-white/40 border border-white/60">
            <span className="text-[10px] text-[var(--lkv-text-secondary)] block">Activite</span>
            <span className="font-semibold capitalize">{trip.primary_activity || 'Trek'}</span>
          </div>
          <div className="p-2 rounded-[var(--lkv-radius-md)] bg-white/40 border border-white/60">
            <span className="text-[10px] text-[var(--lkv-text-secondary)] block">Difficulte</span>
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
          <div className="max-w-7xl mx-auto px-4 py-4 pb-28 space-y-4 text-[var(--lkv-text-primary)]">
            <div className="flex items-center justify-between gap-2">
              <Link href="/voyages" className="text-xs font-medium text-[var(--lkv-text-primary)] flex items-center gap-1">
                <ArrowLeft size={13} />
                <span>Voyages</span>
              </Link>
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
                  activeSection={activeSection as PrepareSectionId}
                  onSectionChange={(s) => handleSectionChange(s as TripSectionId)}
                  hideMobileTabs={true}
                />
              )}
              {activePhase === 'live' && (
                <TripLiveCockpitView trip={trip} stats={stats} dayIndex={phaseDetails.dayIndex} totalDays={phaseDetails.totalDays} />
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
        <TripCompactHeader trip={trip} activePhase={activePhase} daysUntilStart={phaseDetails.daysUntilStart} />
        {activePhase === 'prepare' && (
          <TripPhasePrepareView
            trip={trip}
            stats={stats}
            affiliateLinks={affiliateLinks}
            kitAnalysis={kitAnalysis}
            daysUntilStart={phaseDetails.daysUntilStart}
            activeSection={activeSection as PrepareSectionId}
            onSectionChange={(s) => handleSectionChange(s as TripSectionId)}
          />
        )}
        {activePhase === 'live' && (
          <TripLiveCockpitView trip={trip} stats={stats} dayIndex={phaseDetails.dayIndex} totalDays={phaseDetails.totalDays} />
        )}
        {activePhase === 'recount' && (
          <TripPhaseRecountView trip={trip} />
        )}
        <TripShareModal trip={trip} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
      </div>
    </AppShellDesktop>
  );
}