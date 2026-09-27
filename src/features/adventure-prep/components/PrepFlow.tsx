'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { canOpenStep, firstUnsatisfiedStep } from '../engine/steps';
import type { PrepStepId } from '../types';
import { AdventurePrepShell } from './AdventurePrepShell';
import { ActivityPickerScreen } from './ActivityPickerScreen';
import { DestinationStep } from './DestinationStep';
import { ItineraryStepScreen } from './ItineraryStep';
import { DepartureStep } from './DepartureStep';
import { PrepSheets, type PrepSheetId } from './PrepSheets';

/**
 * Orchestrateur du parcours — le seul endroit qui sait quel écran est visible.
 *
 * Un écran = UNE décision dominante (A1). Toutes les vues secondaires vivent
 * dans un unique Sheet, dont l'identité est tenue ici. Les écrans eux-mêmes ne
 * savent rien du routeur ni du Sheet : ils reçoivent `onOpenSheet`.
 */
export function PrepFlow() {
  const draft = useAdventurePrepStore((state) => state.draft);
  const [sheet, setSheet] = useState<PrepSheetId | null>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Le brouillon est relu depuis localStorage : le premier rendu doit montrer
  // la même chose que le serveur, sinon React signale un écart d'hydratation.
  useEffect(() => setMounted(true), []);

  const openSheet = useCallback((next: PrepSheetId, focus?: string | null) => {
    setFocusStepId(focus ?? null);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setFocusStepId(null);
  }, []);

  // Une reprise peut pointer une étape fermée : on recule plutôt que d'afficher
  // un écran dont les réponses précédentes n'ont pas été saisies.
  const step: PrepStepId = canOpenStep(draft, draft.currentStep)
    ? draft.currentStep
    : firstUnsatisfiedStep(draft);

  const picking = draft.activities.primary === null;

  if (!mounted) {
    return (
      <div className="adventure-prep">
        <div className="prep-screen" aria-busy="true" aria-live="polite">
          <p className="prep-note">Reprise de ta préparation…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdventurePrepShell step={step} onOpenSheet={openSheet} picking={picking}>
        {picking && <ActivityPickerScreen onOpenSheet={openSheet} />}
        {!picking && step === 'destination' && <DestinationStep onOpenSheet={openSheet} />}
        {!picking && step === 'itinerary' && <ItineraryStepScreen onOpenSheet={openSheet} />}
        {!picking && step === 'departure' && <DepartureStep onOpenSheet={openSheet} />}
      </AdventurePrepShell>

      <PrepSheets
        sheet={sheet}
        onClose={closeSheet}
        focusStepId={focusStepId}
        onOpenSheet={openSheet}
      />
    </>
  );
}

export default PrepFlow;
