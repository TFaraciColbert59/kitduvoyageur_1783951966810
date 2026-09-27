'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { canOpenStep, progressOf, stepCountDone } from '../engine/steps';
import { PREP_STEPS, PREP_STEP_LABELS, type PrepStepId } from '../types';
import type { PrepSheetId } from './PrepSheets';

export interface AdventurePrepShellProps {
  step: PrepStepId;
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
  children: React.ReactNode;
  /** Affiche l'action « Préparer une activité » (écran de choix d'activité). */
  picking?: boolean;
}

/**
 * Cadre commun des trois étapes (A1).
 *
 * Plein écran, barre de navigation basse masquée (la route rend
 * `AppShell hasBottomNav={false}`), bandeau de 52 px : retour à gauche,
 * progression en mots simples au centre, fermeture à droite. Fermer
 * enregistre le brouillon — il est déjà persisté à chaque mutation.
 */
export function AdventurePrepShell({ step, onOpenSheet, children, picking = false }: AdventurePrepShellProps) {
  const router = useRouter();
  const draft = useAdventurePrepStore((state) => state.draft);
  const goToStep = useAdventurePrepStore((state) => state.goToStep);
  const progress = progressOf(draft);
  const position = PREP_STEPS.indexOf(step);

  const goBack = () => {
    const previous = PREP_STEPS[position - 1];
    if (previous && canOpenStep(draft, previous)) goToStep(previous);
  };

  return (
    <div className="adventure-prep">
      <nav className="prep-nav" aria-label="Progression de la préparation">
        <Button
          variant="ghost"
          size="md"
          onClick={goBack}
          disabled={position <= 0 || !canOpenStep(draft, PREP_STEPS[position - 1])}
          aria-label="Revenir en arrière"
        >
          <Icon name="chevron-left" size={20} />
          Retour
        </Button>

        {picking ? (
          <span className="prep-nav__progress">Préparation</span>
        ) : (
          <span className="prep-nav__progress">
            {PREP_STEP_LABELS[step]} · {progress.label}
          </span>
        )}

        <Button
          variant="ghost"
          size="md"
          onClick={() => router.push('/hub')}
          aria-label="Fermer et revenir au hub"
        >
          <Icon name="x" size={20} />
          <span className="prep-visually-hidden">Fermer</span>
        </Button>
      </nav>

      {children}

      {/* La navigation en mots reste atteignable au doigt une fois terminée. */}
      {!picking && stepCountDone(draft) > 0 && (
        <div
          className="prep-visually-hidden"
          role="group"
          aria-label="Étapes déjà terminées"
        >
          {PREP_STEPS.map((id) =>
            canOpenStep(draft, id) && draft.completedSteps.includes(id) ? (
              <button key={id} type="button" onClick={() => goToStep(id)}>
                Revenir à {PREP_STEP_LABELS[id]}
              </button>
            ) : null,
          )}
        </div>
      )}

      <span className="prep-visually-hidden" aria-live="polite">
        {picking ? '' : progress.label}
      </span>
    </div>
  );
}

export default AdventurePrepShell;