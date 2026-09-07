'use client';

import React, { useState } from 'react';
import { GlassCard, GlassCapsuleBtn } from '@/components/ui';
import {
  Compass,
  Navigation,
  Package,
  Users,
  CreditCard,
  FileText,
  CheckSquare,
} from 'lucide-react';
import type { TripFull, TripStats } from '../types/trip.types';
import type { TripKitAnalysis } from '../types/kit.types';
import type { AffiliateLink } from '@/features/affiliation';
import { TripOverviewTab } from './TripOverviewTab';
import { TripItineraryTab } from './TripItineraryTab';
import { TripKitView } from './TripKitView';
import { TripTeamView } from './TripTeamView';
import { TripBudgetView } from './TripBudgetView';
import { TripDocumentsView } from './TripDocumentsView';
import { TripChecklistView } from './TripChecklistView';
import { TripAffiliateSection } from '@/features/affiliation';
import { getTripCounters } from '../hooks/useTripCounters';
import { getKitCounters } from '../hooks/useKitCounters';

export interface TripPhasePrepareViewProps {
  trip: TripFull;
  stats: TripStats;
  affiliateLinks?: AffiliateLink[];
  kitAnalysis?: TripKitAnalysis;
  daysUntilStart?: number | null;
  /** Section active — pilotée par TripSidebarLeft (desktop) ou état interne (mobile) */
  activeSection?: PrepareSectionId;
  /** Callback de changement — obligatoire en mode contrôlé */
  onSectionChange?: (s: PrepareSectionId) => void;
  /** Masquer la barre d'onglets mobile si gérée par la BottomTabBar */
  hideMobileTabs?: boolean;
}

export type PrepareSectionId =
  | 'overview'
  | 'itinerary'
  | 'gear'
  | 'team'
  | 'budget'
  | 'docs'
  | 'checklist';

export function TripPhasePrepareView({
  trip,
  stats,
  affiliateLinks = [],
  kitAnalysis,
  daysUntilStart,
  activeSection: activeSectionProp,
  onSectionChange,
  hideMobileTabs = false,
}: TripPhasePrepareViewProps) {
  // Mode non-contrôlé (mobile) : état interne
  const [internalSection, setInternalSection] = useState<PrepareSectionId>('overview');

  // Mode contrôlé (desktop via sidebar ou mobile via BottomTabBar) si prop fournie
  const isControlled = activeSectionProp !== undefined;
  const activeSection = isControlled ? activeSectionProp : internalSection;
  const handleSectionChange = (s: PrepareSectionId) => {
    if (isControlled && onSectionChange) {
      onSectionChange(s);
    } else {
      setInternalSection(s);
    }
  };

  // Source de vérité unique des compteurs (Z-R3 / Chantier Z3).
  const counters = getTripCounters(trip, kitAnalysis);
  const kit = getKitCounters(trip.items);

  const sections: { id: PrepareSectionId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Aperçu', icon: <Compass size={15} /> },
    { id: 'itinerary', label: 'Itinéraire', icon: <Navigation size={15} />, count: counters.itinerary },
    { id: 'gear', label: 'Équipement', icon: <Package size={15} />, count: kit.total },
    { id: 'team', label: 'Équipage', icon: <Users size={15} />, count: counters.participantsCount },
    { id: 'budget', label: 'Budget', icon: <CreditCard size={15} /> },
    ...(trip.permissions.canViewDocuments
      ? [{ id: 'docs' as const, label: 'Documents', icon: <FileText size={15} />, count: trip.documents?.length }]
      : []),
    { id: 'checklist', label: 'Checklist Départ', icon: <CheckSquare size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Sous-navigation horizontale — visible uniquement si non gérée par BottomTabBar ou sidebar */}
      {!isControlled && !hideMobileTabs && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {sections.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSectionChange(s.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[var(--lkv-radius-full)] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 border min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                    : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white'
                }`}
              >
                <span className={isActive ? 'text-white/80' : 'text-[var(--lkv-text-secondary)]'}>{s.icon}</span>
                <span>{s.label}</span>
                {s.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                    }`}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenu de la sous-section active */}
      <div>
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <TripOverviewTab trip={trip} stats={stats} onTabChange={tab => handleSectionChange(tab as PrepareSectionId)} />
            {affiliateLinks.length > 0 && (
              <TripAffiliateSection
                links={affiliateLinks}
                tripId={trip.id}
                countryNames={trip.destination_name ? [trip.destination_name] : []}
              />
            )}
          </div>
        )}

        {activeSection === 'itinerary' && (
          <TripItineraryTab trip={trip} stats={stats} />
        )}

        {activeSection === 'gear' && (
          <>
            {kitAnalysis ? (
              <TripKitView trip={trip} analysis={kitAnalysis} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-lkv-primary">Équipements du voyage</h3>
                  <GlassCapsuleBtn
                    href={`/voyages/${trip.slug}/kit`}
                    variant="primary"
                    size="sm"
                  >
                    Ouvrir le Kit Contextuel Complet
                  </GlassCapsuleBtn>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trip.items.map(item => (
                    <GlassCard key={item.id} tone="neutral" className="p-3.5 rounded-2xl border border-white/60">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-lkv-primary">{item.item_name}</div>
                          <div className="text-xs text-lkv-secondary">
                            {item.category || 'Général'} · Qté : {item.quantity}
                            {item.weight_grams ? ` · ${item.weight_grams}g` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                            item.is_packed
                              ? 'bg-[var(--lkv-success)]/15 text-[var(--lkv-success)] border-[var(--lkv-success)]/25'
                              : 'glass-pill'
                          }`}
                        >
                          {item.is_packed ? 'Emballé' : 'À préparer'}
                        </span>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeSection === 'team' && (
          <TripTeamView trip={trip} />
        )}

        {activeSection === 'budget' && (
          <TripBudgetView trip={trip} />
        )}

        {activeSection === 'docs' && trip.permissions.canViewDocuments && (
          <TripDocumentsView trip={trip} />
        )}

        {activeSection === 'checklist' && (
          <TripChecklistView tripId={trip.id} daysUntilStart={daysUntilStart} />
        )}
      </div>
    </div>
  );
}
