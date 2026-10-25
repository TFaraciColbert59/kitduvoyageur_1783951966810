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
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { IconButton } from '@/components/ui';
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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { input, warnings, loading, error, refresh } = useAdventureCockpit({
    adventureId,
    fixes,
    batteryLevel,
    remainingDistanceKm,
  });

  // P1-3 (fin) — sortie animée sans framer : le panneau reste monté le temps
  // de l'animation CSS de fermeture (.lkv-sheet-up--closing), puis unmount.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setRender(false);
    }, 240);
    return () => clearTimeout(timer);
  }, [open, render]);

  // Focus + Escape : entrée dans le dialogue, restitution au déclencheur.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  const handleTabTrap = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!adventureId) return null;

  return (
    <>
      <IconButton
        variant="glass"
        size="lg"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le cockpit de l’aventure"
        aria-haspopup="dialog"
        className="absolute right-3.5 bottom-[calc(var(--safe-bottom)+152px)] z-[var(--z-fab)] shadow-md md:right-6"
      >
        <Icon name="compass" size={18} aria-hidden="true" />
        {error ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--lkv-danger)]"
          />
        ) : null}
      </IconButton>

      {render ? (
          <div
            key="adventure-cockpit-sheet"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Cockpit aventure"
            tabIndex={-1}
            onKeyDown={handleTabTrap}
            className={`lkv-sheet-up${closing ? ' lkv-sheet-up--closing' : ''} absolute inset-x-0 bottom-0 z-[var(--z-sheet)] max-h-[82dvh] overflow-y-auto rounded-t-[var(--lkv-radius-sheet)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] px-4 pt-3 pb-[calc(var(--safe-bottom)+var(--space-4))] shadow-elevation-4`}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[color:var(--lkv-text-subtle)]" aria-hidden="true" />
            <div className="mb-2 flex items-center justify-end">
              <IconButton
                variant="ghost"
                size="lg"
                onClick={() => setOpen(false)}
                aria-label="Fermer le cockpit"
              >
                <Icon name="x" size={18} aria-hidden="true" />
              </IconButton>
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
                className="py-10 text-center text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]"
              >
                {loading
                  ? 'Assemblage du cockpit réel…'
                  : error ?? 'Aucune donnée de cockpit pour le moment.'}
              </p>
            )}

            {warnings.length > 0 ? (
              <p className="mt-2 text-center text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                {warnings.length} avertissement{warnings.length > 1 ? 's' : ''} — données partielles.
              </p>
            ) : null}
          </div>
      ) : null}
    </>
  );
}
