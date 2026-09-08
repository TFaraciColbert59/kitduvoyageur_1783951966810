'use client';

import React, { useState, useTransition } from 'react';
import { X, Check, Plus, AlertCircle, Sparkles } from 'lucide-react';
import { GlassCapsuleBtn, GlassPill } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  tripSectionRegistry,
  type TripSectionDef,
} from '../registry/tripSectionRegistry';
import {
  TRIP_SECTION_ORDER,
  type TripProfile,
  type TripSectionId,
} from '../engine/tripProfileEngine';
import type { TripFull } from '../types/trip.types';

export interface TripSectionPickerProps {
  trip: TripFull;
  profile: TripProfile;
  isOpen: boolean;
  onClose: () => void;
  onSectionsChange?: (enabledSections: TripSectionId[]) => void;
}

/**
 * Y2.4 — Panneau de sélection et personnalisation des sections du voyage (TripSectionPicker).
 * Garantit la promesse UX : « Aucune section n'est jamais verrouillée ».
 * Affiche la raison de chaque section issue du profil (matrice, échelle, groupe),
 * permet d'activer toute section masquée, et persiste le choix dans les métadonnées.
 */
export function TripSectionPicker({
  trip,
  profile,
  isOpen,
  onClose,
  onSectionsChange,
}: TripSectionPickerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();

  // Sections custom activées manuellement
  const initialCustom = Array.isArray(trip.metadata?.enabled_sections)
    ? (trip.metadata.enabled_sections as TripSectionId[])
    : [];

  const [customSections, setCustomSections] = useState<TripSectionId[]>(initialCustom);

  if (!isOpen) return null;

  const isSectionActive = (id: TripSectionId): boolean => {
    // Si déjà inclus naturellement dans le profil ou activé manuellement
    return profile.sections.includes(id) || customSections.includes(id);
  };

  const isManuallyActivated = (id: TripSectionId): boolean => {
    return customSections.includes(id);
  };

  const isCoreSection = (id: TripSectionId): boolean => {
    // overview et safety sont obligatoires pour l'intégrité du cockpit
    return id === 'overview' || id === 'safety';
  };

  const handleToggle = (sectionId: TripSectionId) => {
    if (isCoreSection(sectionId)) return;

    triggerHaptic('selection');
    const isCurrentlyActive = isSectionActive(sectionId);

    let nextCustom: TripSectionId[];
    if (isCurrentlyActive) {
      // Désactiver : retirer des customs
      nextCustom = customSections.filter((id) => id !== sectionId);
    } else {
      // Activer : ajouter aux customs
      nextCustom = Array.from(new Set([...customSections, sectionId]));
    }

    setCustomSections(nextCustom);

    startTransition(async () => {
      // Met à jour localement les métadonnées
      if (trip.metadata) {
        trip.metadata.enabled_sections = nextCustom;
      } else {
        trip.metadata = { enabled_sections: nextCustom };
      }

      // Notifier le composant parent
      if (onSectionsChange) {
        const fullEnabled = TRIP_SECTION_ORDER.filter(
          (id) => profile.sections.includes(id) || nextCustom.includes(id)
        );
        onSectionsChange(fullEnabled);
      }

      // Sauvegarde dans localStorage pour le mode offline/démo
      try {
        if (typeof window !== 'undefined') {
          const key = `lkdv_trip_sections_${trip.id || trip.slug}`;
          localStorage.setItem(key, JSON.stringify(nextCustom));
        }
      } catch {
        // Silencieux
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-picker-title"
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col glass rounded-[var(--lkv-radius-card)] border border-white/60 shadow-xl overflow-hidden text-[var(--lkv-text-primary)]">
        {/* En-tête */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--lkv-border-subtle)] shrink-0">
          <div>
            <h3
              id="section-picker-title"
              className="text-base font-bold font-display flex items-center gap-2 text-[var(--lkv-text-primary)]"
            >
              <Sparkles size={16} className="text-[var(--lkv-secondary)]" />
              <span>Personnaliser les sections</span>
            </h3>
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
              Aucune section n&apos;est jamais verrouillée. Activez ce dont vous avez besoin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="Fermer"
            className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition-transform min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Liste des sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {tripSectionRegistry.map((section: TripSectionDef) => {
            const Icon = section.icon;
            const active = isSectionActive(section.id);
            const manual = isManuallyActivated(section.id);
            const core = isCoreSection(section.id);
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
                      {core ? (
                        <GlassPill className="text-[9px] font-mono">Fondamental</GlassPill>
                      ) : manual ? (
                        <GlassPill className="text-[9px] font-mono font-bold bg-[var(--lkv-secondary)]/20 text-[var(--lkv-text-primary)]">
                          Activé manuellement
                        </GlassPill>
                      ) : active ? (
                        <GlassPill className="text-[9px] font-mono text-[var(--lkv-text-secondary)]">
                          Recommandé
                        </GlassPill>
                      ) : (
                        <GlassPill className="text-[9px] font-mono text-[var(--lkv-text-muted)]">
                          Masqué
                        </GlassPill>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--lkv-text-secondary)] mt-0.5 leading-snug line-clamp-2">
                      {reason}
                    </p>
                  </div>
                </div>

                {/* Bouton bascule tactile */}
                {!core ? (
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
                  <span className="text-[10px] font-mono text-[var(--lkv-text-muted)] px-2 py-1">
                    Requis
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Pied de dialogue */}
        <div className="p-3.5 border-t border-[var(--lkv-border-subtle)] shrink-0 flex items-center justify-between gap-3 bg-white/40">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <AlertCircle size={13} />
            <span>Changements appliqués immédiatement au hub.</span>
          </div>
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
    </div>
  );
}
export default TripSectionPicker;
