'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass, Share2, Check } from 'lucide-react';
import { GlassSubCard, GlassPill, GlassCapsuleBtn } from '@/components/ui';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { getPhaseLabel, type TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

export type TripSectionId =
  | 'overview'
  | 'itinerary'
  | 'gear'
  | 'team'
  | 'budget'
  | 'docs'
  | 'checklist';

interface SectionDef {
  id: TripSectionId;
  label: string;
  count?: number;
  phases: TripPhase[];
}

interface TripSidebarLeftProps {
  trip: TripFull;
  activeSection: TripSectionId;
  onSectionChange: (s: TripSectionId) => void;
  activePhase: TripPhase;
  onToggleActive: () => void;
  isTripActive: boolean;
  isPending: boolean;
  onShare: () => void;
}

export default function TripSidebarLeft({
  trip,
  activeSection,
  onSectionChange,
  activePhase,
  onToggleActive,
  isTripActive,
  isPending,
  onShare,
}: TripSidebarLeftProps) {
  const itineraryCount = trip.steps?.length ?? 0;
  const gearCount = trip.items?.length ?? 0;
  const docsCount = trip.documents?.length ?? 0;
  const participantsCount = (trip.collaborators?.length ?? 0) + 1;

  const allSections: SectionDef[] = [
    { id: 'overview',   label: 'Apercu',           phases: ['prepare', 'live', 'recount'] },
    { id: 'itinerary',  label: 'Itineraire',        count: itineraryCount, phases: ['prepare', 'live'] },
    { id: 'gear',       label: 'Equipement',        count: gearCount,      phases: ['prepare'] },
    { id: 'team',       label: 'Equipage',          count: participantsCount, phases: ['prepare', 'live'] },
    { id: 'budget',     label: 'Budget',            phases: ['prepare', 'recount'] },
    ...(trip.permissions.canViewDocuments
      ? [{ id: 'docs' as TripSectionId, label: 'Documents', count: docsCount, phases: ['prepare'] as TripPhase[] }]
      : []),
    { id: 'checklist',  label: 'Checklist Depart', phases: ['prepare'] },
  ];

  const visibleSections = allSections.filter(s => s.phases.includes(activePhase));

  return (
    <aside
      className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden border border-white/40 shadow-sm select-none"
      aria-label="Navigation du voyage"
    >
      <div className="shrink-0 space-y-2.5">
        <nav aria-label="Fil d'Ariane" className="text-xs text-[var(--lkv-text-primary)]">
          <Link href="/voyages" className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <ArrowLeft size={13} />
            <span>Tous les voyages</span>
          </Link>
        </nav>
        <GlassSubCard className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg" aria-hidden="true">&#x1F9ED;</span>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-bold text-xs sm:text-sm text-[var(--lkv-text-primary)] truncate leading-tight">
                {trip.title}
              </h4>
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] block truncate">
                {getPhaseLabel(activePhase)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <GlassPill className="text-[9px] font-mono font-bold">{trip.status}</GlassPill>
            {trip.destination_country_code && (
              <GlassPill className="text-[9px] font-mono">{trip.destination_country_code}</GlassPill>
            )}
          </div>
        </GlassSubCard>
        <div className="grid grid-cols-2 gap-1.5">
          <GlassCapsuleBtn
            variant={isTripActive ? 'primary' : 'default'}
            size="sm"
            onClick={onToggleActive}
            disabled={isPending}
            icon={isTripActive ? <Check size={13} /> : <Compass size={13} />}
            className={`flex items-center justify-center gap-1.5 !py-1.5 !px-2 !text-[10.5px] min-h-[var(--lkv-touch-min)] w-full ${
              isTripActive ? '!bg-[var(--lkv-success)] !border-[var(--lkv-success)] text-white' : ''
            }`}
          >
            <span>{isTripActive ? 'Active' : 'Activer'}</span>
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            variant="default"
            size="sm"
            onClick={onShare}
            icon={<Share2 size={13} />}
            className="flex items-center justify-center gap-1.5 !py-1.5 !px-2 !text-[10.5px] min-h-[var(--lkv-touch-min)] w-full"
          >
            <span>Partager</span>
          </GlassCapsuleBtn>
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Sections du voyage">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] px-2 mb-1">
          Navigation
        </p>
        {visibleSections.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionChange(s.id)}
              className={`w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/50 text-[var(--lkv-text-primary)] hover:bg-white'
              }`}
            >
              <span className="truncate text-left flex items-center gap-2">
                {s.label}
                {s.count !== undefined && s.count > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'}`}>
                    {s.count}
                  </span>
                )}
              </span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>
      <div className="shrink-0 pt-2 border-t border-[var(--lkv-border-subtle)]">
        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase">
            Le Kit du Voyageur &middot; Voyage Cockpit
          </span>
        </div>
      </div>
    </aside>
  );
}
