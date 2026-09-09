'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Check } from 'lucide-react';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
  type HubCounters,
} from '../registry/hubSectionRegistry';
import type { AdventureProfile, HubSectionId } from '../engine/hubProfileEngine';

export interface HubMobileSectionsSheetProps {
  adventure: HubAdventureRef;
  profile: AdventureProfile;
  counts: HubCounters;
  activeSection: HubSectionId | null;
  onOpenPicker?: () => void;
}

/**
 * H3.3 — Navigation mobile des sections (miroir TripMobileSectionsSheet).
 * GlassSheet iOS, cibles ≥44px, haptique, compteurs réels, hrefs registre.
 */
export function HubMobileSectionsSheet({
  adventure,
  profile,
  counts,
  activeSection,
  onOpenPicker,
}: HubMobileSectionsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const sections = visibleHubSections(profile);

  const select = (id: HubSectionId) => {
    triggerHaptic('selection');
    setIsOpen(false);
    router.push(hubSectionHref(adventure, id));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setIsOpen(true);
        }}
        className="glass-capsule-btn flex items-center gap-1.5 min-h-[48px] px-3.5 text-xs font-semibold cursor-pointer shadow-sm active:scale-95 transition-transform"
        aria-label="Ouvrir les sections du hub"
      >
        <Layers size={14} className="text-[var(--lkv-secondary)]" />
        <span>Sections</span>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/5 text-[var(--lkv-text-secondary)]">
          {sections.length}
        </span>
      </button>

      <GlassSheet open={isOpen} onOpenChange={setIsOpen} title="Navigation du hub">
        <div className="space-y-1 py-2">
          {/* Regroupement par zone : essentiel / compléments — lisibilité mobile */}
          {(() => {
            const core = sections.filter((s) => s.coreNatures.includes(profile.nature));
            const extra = sections.filter((s) => !s.coreNatures.includes(profile.nature));
            const renderRow = (def: (typeof sections)[number]) => {
              const Icon = def.icon;
              const count = def.counter(counts);
              const active = activeSection === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => select(def.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 min-h-[44px] rounded-[var(--lkv-radius-md)] text-left cursor-pointer ${
                    active ? 'bg-[var(--lkv-primary)] text-white' : 'hover:bg-black/5'
                  }`}
                >
                  <Icon
                    size={16}
                    className={`shrink-0 ${active ? 'text-white' : 'text-[var(--lkv-text-secondary)]'}`}
                    aria-hidden="true"
                  />
                  <span className={`flex-1 text-sm font-semibold ${active ? 'text-white' : 'text-[var(--lkv-text-primary)]'}`}>
                    {def.label}
                  </span>
                  {count !== null && count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        active ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {active && <Check size={14} aria-hidden="true" />}
                </button>
              );
            };
            return (
              <>
                {core.length > 0 && (
                  <>
                    <p className="px-3 pt-1 pb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-muted)]">
                      Essentiel
                    </p>
                    {core.map(renderRow)}
                  </>
                )}
                {extra.length > 0 && (
                  <>
                    <p className="px-3 pt-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-muted)]">
                      Compléments
                    </p>
                    {extra.map(renderRow)}
                  </>
                )}
              </>
            );
          })()}
          {onOpenPicker && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsOpen(false);
                onOpenPicker();
              }}
              className="w-full px-3 min-h-[44px] text-xs font-semibold text-[var(--lkv-text-secondary)] text-left cursor-pointer"
            >
              Personnaliser les sections…
            </button>
          )}
        </div>
      </GlassSheet>
    </>
  );
}

export default HubMobileSectionsSheet;
