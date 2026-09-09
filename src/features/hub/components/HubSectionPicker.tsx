'use client';

import React, { useState, useTransition } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn, GlassPill } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { hubSectionRegistry } from '../registry/hubSectionRegistry';
import { HUB_SECTION_ORDER, type AdventureProfile, type HubSectionId } from '../engine/hubProfileEngine';

export interface HubSectionPickerProps {
  /** Clé stable de l'aventure (`possession`, `sortie:slug`, `collectif:kind:id`). */
  adventureKey: string;
  profile: AdventureProfile;
  /** Sections déjà activées côté serveur (ex. trip.metadata) — base additive. */
  serverEnabled: HubSectionId[];
  isOpen: boolean;
  onClose: () => void;
  onChange?: (custom: HubSectionId[]) => void;
}

function readCustom(key: string): HubSectionId[] {
  try {
    const raw = localStorage.getItem(`lkdv_hub_sections_${key}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as string[]).filter((s): s is HubSectionId =>
          (HUB_SECTION_ORDER as string[]).includes(s),
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * H3.3 — Picker de sections du hub (généralisation du TripSectionPicker).
 * « Aucune section n'est jamais verrouillée » : reason tracée par section,
 * activation des masquées, customs additifs persistés en local.
 */
export function HubSectionPicker({
  adventureKey,
  profile,
  serverEnabled,
  isOpen,
  onClose,
  onChange,
}: HubSectionPickerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();
  const [customSections, setCustomSections] = useState<HubSectionId[]>(() => readCustom(adventureKey));

  const defs = hubSectionRegistry.filter((d) => d.natures.includes(profile.nature));

  const isActive = (id: HubSectionId): boolean =>
    profile.sections.includes(id) || customSections.includes(id);
  const isManual = (id: HubSectionId): boolean => customSections.includes(id);
  const isCore = (id: HubSectionId): boolean =>
    hubSectionRegistry.find((d) => d.id === id)?.coreNatures.includes(profile.nature) ?? false;

  const handleToggle = (sectionId: HubSectionId) => {
    if (isCore(sectionId)) return;
    triggerHaptic('selection');
    const next = isActive(sectionId)
      ? customSections.filter((id) => id !== sectionId)
      : Array.from(new Set([...customSections, sectionId]));
    setCustomSections(next);
    startTransition(async () => {
      try {
        localStorage.setItem(`lkdv_hub_sections_${adventureKey}`, JSON.stringify(next));
      } catch {
        /* silencieux */
      }
      if (onChange) onChange(next);
    });
  };

  return (
    <GlassModal open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }} title="Personnaliser les sections" variant="sheet" hideTitle>
      <div className="pb-2">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-[var(--lkv-secondary)] shrink-0" aria-hidden="true" />
          <h3 className="text-base font-bold font-display text-[var(--lkv-text-primary)]">
            Personnaliser les sections
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {defs.map((section) => {
            const Icon = section.icon;
            const active = isActive(section.id);
            const manual = isManual(section.id);
            const coreSection = isCore(section.id);
            const reason = profile.reason[section.id] || 'Profil standard';
            return (
              <div
                key={section.id}
                className={`p-3 rounded-[var(--lkv-radius-md)] border transition-all flex items-center justify-between gap-3 ${
                  active
                    ? 'glass-sub-card border-white/80 shadow-2xs'
                    : 'opacity-70 bg-black/5 border-dashed border-white/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      active
                        ? 'bg-[var(--lkv-primary)] text-white'
                        : 'bg-black/10 text-[var(--lkv-text-secondary)]'
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-[var(--lkv-text-primary)]">
                        {section.label}
                      </span>
                      {coreSection ? (
                        <GlassPill className="text-[9px] font-medium">Fondamental</GlassPill>
                      ) : manual || serverEnabled.includes(section.id) ? (
                        <GlassPill className="text-[9px] font-semibold bg-[var(--lkv-secondary)]/20 text-[var(--lkv-text-primary)]">
                          Activé manuellement
                        </GlassPill>
                      ) : active ? (
                        <GlassPill className="text-[9px] font-medium text-[var(--lkv-text-secondary)]">
                          Recommandé
                        </GlassPill>
                      ) : (
                        <GlassPill className="text-[9px] font-medium text-[var(--lkv-text-muted)]">
                          Masqué
                        </GlassPill>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--lkv-text-secondary)] mt-0.5 leading-snug line-clamp-2">
                      {reason}
                    </p>
                  </div>
                </div>

                {!coreSection ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`${active ? 'Masquer' : 'Activer'} la section ${section.label}`}
                    onClick={() => handleToggle(section.id)}
                    disabled={isPending}
                    className={`shrink-0 min-h-[44px] min-w-[44px] px-3 py-2 rounded-[var(--lkv-radius-sm)] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                      active
                        ? 'bg-[var(--lkv-primary)] text-white hover:opacity-90 shadow-sm'
                        : 'glass-sub-card text-[var(--lkv-text-primary)] border border-white/60 hover:bg-white'
                    }`}
                  >
                    {active ? (
                      <>
                        <Check size={13} />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Activer</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold text-[var(--lkv-text-muted)] px-2 py-1">
                    Requis
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-[var(--lkv-border-subtle)] shrink-0 flex items-center justify-end bg-white/40 rounded-2xl mt-3">
          <GlassCapsuleBtn
            variant="primary"
            size="sm"
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="min-h-[44px] px-4 cursor-pointer"
          >
            <span>Terminer</span>
          </GlassCapsuleBtn>
        </div>
      </div>
    </GlassModal>
  );
}

export default HubSectionPicker;
