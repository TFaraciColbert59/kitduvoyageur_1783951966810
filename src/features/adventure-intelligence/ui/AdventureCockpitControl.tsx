'use client';

/**
 * A13 (S5) — Cockpit live monté dans la randonnée active.
 *
 * Bouton flottant 44 px + bottom sheet iOS : le panneau rend
 * `AdventureCockpit` alimenté par les données réelles assemblées côté serveur
 * (`useAdventureCockpit` → `POST /api/adventure/[id]/cockpit`). Aucune valeur
 * n'est calculée ici : la vue est une projection de l'entrée réelle.
 *
 * Tokens `--lkv-*`, safe-area, `prefers-reduced-motion`, zéro orange, aucun
 * dialogue natif ; sans plan aventure identifié, rien n'est monté.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from '@/components/ui/Icon';
import AdventureCockpit from './AdventureCockpit';
import {
  useAdventureCockpit,
  type AdventureTrackingFix,
} from './useAdventureCockpit';

export interface AdventureCockpitControlProps {
  adventureId: string | null;
  fixes: readonly AdventureTrackingFix[];
  batteryLevel?: number | null;
  pendingSyncCount?: number;
  /** Distance restante réelle (géométrie + progression) pour l'ETA live. */
  remainingDistanceKm?: number | null;
}

export default function AdventureCockpitControl({
  adventureId,
  fixes,
  batteryLevel = null,
  pendingSyncCount = 0,
  remainingDistanceKm = null,
}: AdventureCockpitControlProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const { input, warnings, loading, error, refresh } = useAdventureCockpit({
    adventureId,
    fixes,
    batteryLevel,
    remainingDistanceKm,
  });

  if (!adventureId) return null;

  const sheetMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: '100%', opacity: 0.6 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '100%', opacity: 0 },
      };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le cockpit de l’aventure"
        aria-haspopup="dialog"
        className="absolute right-3.5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--lkv-border,rgba(23,64,44,0.12))] bg-[var(--lkv-surface-card,#FFFFFF)] text-[var(--lkv-text-primary,#17402C)] shadow-md active:opacity-70 md:right-6"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 152px)' }}
      >
        <Icon name="compass" size={18} aria-hidden="true" />
        {error ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--lkv-danger)]"
          />
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="adventure-cockpit-sheet"
            {...sheetMotion}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Cockpit aventure"
            className="absolute inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--lkv-border,rgba(23,64,44,0.12))] bg-[var(--lkv-surface,#F7F8F6)] px-4 pt-3 shadow-lg"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--lkv-text-subtle)]" aria-hidden="true" />
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le cockpit"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-secondary)] active:opacity-70"
              >
                <Icon name="x" size={18} aria-hidden="true" />
              </button>
            </div>

            {input ? (
              <AdventureCockpit
                input={input}
                pendingSyncCount={pendingSyncCount}
                onRecalculate={refresh}
              />
            ) : (
              <p
                role="status"
                aria-live="polite"
                className="py-10 text-center text-[13px] text-[var(--lkv-text-secondary)]"
              >
                {loading
                  ? 'Assemblage du cockpit réel…'
                  : error ?? 'Aucune donnée de cockpit pour le moment.'}
              </p>
            )}

            {warnings.length > 0 ? (
              <p className="mt-2 text-center text-[11px] text-[var(--lkv-text-muted)]">
                {warnings.length} avertissement{warnings.length > 1 ? 's' : ''} — données partielles.
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
