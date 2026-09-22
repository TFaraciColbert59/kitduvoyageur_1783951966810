'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface FloatingPageControlsProps {
  /** Contrôle(s) flottant(s) à gauche (retour, créer, menu). */
  leading?: React.ReactNode;
  /** Contrôle(s) flottant(s) à droite (recherche, ajout, actions). */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * FloatingPageControls — rangée de contrôles flottants canonique (Phase 3).
 * Flotte au-dessus du contenu (top = safe-area + 8, marges 16, gap 8) ;
 * les contrôles enfants (44×44, verre neutre) portent le fond.
 */
export function FloatingPageControls({ leading, trailing, className }: FloatingPageControlsProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[var(--z-sticky)] flex items-center justify-between px-[var(--lkv-screen-margin)]',
        className
      )}
      style={{ top: 'calc(var(--safe-top) + var(--space-2))' }}
    >
      <div className="pointer-events-auto flex items-center gap-[var(--space-2)]">
        {leading}
      </div>
      {trailing && (
        <div className="pointer-events-auto flex items-center gap-[var(--space-2)]">
          {trailing}
        </div>
      )}
    </div>
  );
}

export default FloatingPageControls;
