'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
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
import Link from 'next/link';

export interface TripPhasePrepareViewProps {
  trip: TripFull;
  stats: TripStats;
  affiliateLinks?: AffiliateLink[];
  kitAnalysis?: TripKitAnalysis;
  daysUntilStart?: number | null;
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
}: TripPhasePrepareViewProps) {
  const [activeSection, setActiveSection] = useState<PrepareSectionId>('overview');

  const sections: { id: PrepareSectionId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Aperçu', icon: <Compass size={15} /> },
    { id: 'itinerary', label: 'Itinéraire', icon: <Navigation size={15} />, count: trip.steps?.length },
    { id: 'gear', label: 'Équipement', icon: <Package size={15} />, count: trip.items?.length },
    { id: 'team', label: 'Équipage', icon: <Users size={15} />, count: (trip.collaborators?.length || 0) + 1 },
    { id: 'budget', label: 'Budget', icon: <CreditCard size={15} /> },
    ...(trip.permissions.canViewDocuments
      ? [{ id: 'docs' as const, label: 'Documents', icon: <FileText size={15} />, count: trip.documents?.length }]
      : []),
    { id: 'checklist', label: 'Checklist Départ', icon: <CheckSquare size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Sous-navigation fluide (Sous-onglets de préparation) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {sections.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 border min-h-[44px] ${
                isActive
                  ? 'bg-lkv-primary text-white border-lkv-primary shadow-sm'
                  : 'bg-white/70 hover:bg-white text-lkv-primary border-white/80 hover:border-black/10'
              }`}
            >
              <span className={isActive ? 'text-[#A6C1A0]' : 'text-lkv-secondary'}>{s.icon}</span>
              <span>{s.label}</span>
              {s.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-lkv-secondary'
                  }`}
                >
                  {s.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Contenu de la sous-section active */}
      <div>
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <TripOverviewTab trip={trip} stats={stats} onTabChange={tab => setActiveSection(tab as PrepareSectionId)} />
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
                  <Link
                    href={`/voyages/${trip.slug}/kit`}
                    className="px-4 py-2 rounded-xl bg-lkv-primary text-white text-xs font-bold hover:bg-[#123323] transition-all min-h-[44px] flex items-center"
                  >
                    Ouvrir le Kit Contextuel Complet
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trip.items.map(item => (
                    <GlassCard key={item.id} tone="neutral" className="p-3.5 rounded-[18px] border border-white/60">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-lkv-primary">{item.item_name}</div>
                          <div className="text-xs text-lkv-secondary">
                            {item.category || 'Général'} · Qté : {item.quantity}
                            {item.weight_grams ? ` · ${item.weight_grams}g` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.is_packed
                              ? 'bg-lkv-secondary/20 text-lkv-primary'
                              : 'bg-black/5 text-gray-500'
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
