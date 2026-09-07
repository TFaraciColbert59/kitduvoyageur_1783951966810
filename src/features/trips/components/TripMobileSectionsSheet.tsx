'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, ChevronRight, Check } from 'lucide-react';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  visibleSections,
  tripSectionHref,
  type TripSectionDef,
} from '../registry/tripSectionRegistry';
import { deriveScale, deriveParty, getProfileBadgeLabel } from '../engine/tripProfileEngine';
import type { TripProfile, TripSectionId } from '../engine/tripProfileEngine';
import type { TripFull } from '../types/trip.types';

export interface TripMobileSectionsSheetProps {
  trip: TripFull;
  profile: TripProfile;
  activeSection: TripSectionId;
}

/**
 * Y5.3 — Navigation mobile de sections sous forme de GlassSheet native iOS/Apple.
 * Toutes les cibles tactiles >= 44px, retour haptique à la sélection,
 * affichage des compteurs réels et du profil dérivé.
 */
export function TripMobileSectionsSheet({
  trip,
  profile,
  activeSection,
}: TripMobileSectionsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const sections = visibleSections(profile);
  const scale = deriveScale(trip.start_date, trip.end_date);
  const party = deriveParty(trip.collaborators?.length ? trip.collaborators.length + 1 : 1);
  const profileLabel = getProfileBadgeLabel(scale, party);

  const handleSelectSection = (section: TripSectionDef) => {
    triggerHaptic('selection');
    setIsOpen(false);
    router.push(tripSectionHref(trip.slug, section.id));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setIsOpen(true);
        }}
        className="glass-capsule-btn flex items-center gap-1.5 min-h-[44px] px-3.5 text-xs font-semibold cursor-pointer shadow-sm active:scale-95 transition-transform"
        aria-label="Ouvrir les sections du voyage"
      >
        <Layers size={14} className="text-[var(--lkv-secondary)]" />
        <span>Sections</span>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/5 text-[var(--lkv-text-secondary)]">
          {sections.length}
        </span>
      </button>

      <GlassSheet open={isOpen} onOpenChange={setIsOpen} title="Navigation du voyage">
        <div className="space-y-4 py-2">
          {/* En-tête voyage dans la sheet */}
          <div className="p-3.5 rounded-[var(--lkv-radius-card)] glass border border-white/60">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] font-bold">
              {profileLabel}
            </div>
            <div className="text-base font-bold text-[var(--lkv-text-primary)] truncate mt-0.5">
              {trip.title}
            </div>
          </div>

          {/* Liste des sections tactiles */}
          <div className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              const count = section.counter(trip);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSelectSection(section)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-[var(--lkv-radius-lg)] border text-left min-h-[48px] cursor-pointer transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                      : 'glass-sub-card border-white/60 text-[var(--lkv-text-primary)] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-primary)]'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="font-semibold text-sm truncate">{section.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {count !== null && (
                      <span
                        className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                    {isActive ? (
                      <Check size={16} className="text-white" />
                    ) : (
                      <ChevronRight size={16} className="text-[var(--lkv-text-muted)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </GlassSheet>
    </>
  );
}
