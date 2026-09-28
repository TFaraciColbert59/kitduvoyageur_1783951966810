'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { canOpenStep, firstUnsatisfiedStep } from '../engine/steps';
import type { PrepStepId } from '../types';
import type { PhaseRetryDeps } from '../engine/itineraryPhases';
import { fetchItineraryProposal } from '@/app/prepare/actions';
import { browserMeasurementRunners } from '../browserMeasurements';
import { loadPlaceInventoryFor, resolvePlacesFor } from '../placeSource';
import { AdventurePrepShell } from './AdventurePrepShell';
import { ActivityPickerScreen } from './ActivityPickerScreen';
import { DestinationStep } from './DestinationStep';
import { ItineraryStepScreen } from './ItineraryStep';
import { DepartureStep } from './DepartureStep';
import { PrepSheets, type PrepPlaceField, type PrepSheetId } from './PrepSheets';

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
  const [placeField, setPlaceField] = useState<PrepPlaceField | null>(null);
  const [mounted, setMounted] = useState(false);

  // Le brouillon est relu depuis localStorage : le premier rendu doit montrer
  // la même chose que le serveur, sinon React signale un écart d'hydratation.
  useEffect(() => setMounted(true), []);

  // `placeField` porte l extremite demandee : sans elle, la vue lieu deduisait
  // l extremite et cliquer « Depart » editait l arrivee.
  const openSheet = useCallback(
    (next: PrepSheetId, focus?: string | null, field?: PrepPlaceField | null) => {
      setFocusStepId(focus ?? null);
      setPlaceField(field ?? null);
      setSheet(next);
    },
    [],
  );

  const closeSheet = useCallback(() => {
    setSheet(null);
    setFocusStepId(null);
    setPlaceField(null);
  }, []);

  // Une reprise peut pointer une étape fermée : on recule plutôt que d'afficher
  // un écran dont les réponses précédentes n'ont pas été saisies.
  const step: PrepStepId = canOpenStep(draft, draft.currentStep)
    ? draft.currentStep
    : firstUnsatisfiedStep(draft);

  const picking = draft.activities.primary === null;

  // Les dependances de REPRISE, construites une seule fois.
  //
  // Sans elles, le bouton « Reessayer » ne pouvait rejouer aucune phase
  // mesurable : le moteur recevait un objet vide, donc ni mesures, ni
  // proposeur, ni resolveur. Le bandeau promettait une reprise et le clic
  // echouait silencieusement. `useMemo` les fige pour que la dependance du
  // `useCallback` du shell ne change pas a chaque rendu.
  const phaseRetryDeps = useMemo<PhaseRetryDeps>(
    () => ({
      measure: browserMeasurementRunners(),
      fetchProposal: (draftToBuild) => fetchItineraryProposal(draftToBuild),
      resolvePlaces: resolvePlacesFor(),
      loadInventory: loadPlaceInventoryFor(),
    }),
    [],
  );

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
      <AdventurePrepShell
        step={step}
        onOpenSheet={openSheet}
        picking={picking}
        phaseRetryDeps={phaseRetryDeps}
      >
        {picking && <ActivityPickerScreen onOpenSheet={openSheet} />}
        {!picking && step === 'destination' && <DestinationStep onOpenSheet={openSheet} />}
        {!picking && step === 'itinerary' && <ItineraryStepScreen onOpenSheet={openSheet} />}
        {!picking && step === 'departure' && <DepartureStep onOpenSheet={openSheet} />}
      </AdventurePrepShell>

      <PrepSheets
        sheet={sheet}
        onClose={closeSheet}
        focusStepId={focusStepId}
        placeField={placeField}
        onOpenSheet={openSheet}
      />
    </>
  );
}

export default PrepFlow;
