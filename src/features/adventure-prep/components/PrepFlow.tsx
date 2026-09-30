'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { loadSavedPlan } from '../savedPlanClient';
import { canOpenStep, firstUnsatisfiedStep } from '../engine/steps';
import type { PrepStepId } from '../types';
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
export interface PrepFlowProps {
  /**
   * Aventure enregistrée à modifier (L0.7). Absent : on reprend le brouillon
   * local ou on démarre une nouvelle aventure. Présent : le MÊME écran s'ouvre
   * sur le plan relu depuis le serveur, jamais sur un brouillon d'une autre.
   */
  planId?: string | null;
  /** `?nouvelle=1` : intention explicite de repartir de zéro. */
  startFresh?: boolean;
}

type LoadState =
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string; retry: boolean };

export function PrepFlow({ planId = null, startFresh = false }: PrepFlowProps = {}) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const loadedPlanId = useAdventurePrepStore((state) => state.planId);
  const loadPlan = useAdventurePrepStore((state) => state.loadSavedPlan);
  const startNewAdventure = useAdventurePrepStore((state) => state.startNewAdventure);
  const [sheet, setSheet] = useState<PrepSheetId | null>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const [placeField, setPlaceField] = useState<PrepPlaceField | null>(null);
  const [mounted, setMounted] = useState(false);
  const [load, setLoad] = useState<LoadState>(planId ? { status: 'loading' } : { status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  // Le brouillon est relu depuis localStorage : le premier rendu doit montrer
  // la même chose que le serveur, sinon React signale un écart d'hydratation.
  useEffect(() => setMounted(true), []);

  // Une nouvelle aventure demandée depuis un plan en cours d'édition ne doit
  // pas modifier ce plan : on détache le brouillon (le brouillon libre reste).
  useEffect(() => {
    if (!mounted || planId) return;
    if (startFresh && typeof loadedPlanId === 'string') startNewAdventure();
  }, [mounted, planId, startFresh, loadedPlanId, startNewAdventure]);

  // Ouverture d'un plan enregistré : relu APRES la reprise du stockage local,
  // pour que le brouillon persisté ne l'écrase pas.
  useEffect(() => {
    if (!mounted || !planId) return;
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    loadSavedPlan(planId, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        loadPlan(result.planId, result.planVersion, result.draft);
        setLoad({ status: 'idle' });
      } else {
        setLoad({
          status: 'error',
          message: result.message,
          retry: result.reason === 'reseau' || result.reason === 'serveur',
        });
      }
    });
    return () => controller.abort();
  }, [mounted, planId, attempt, loadPlan]);

  // `placeField` porte l extremite demandee : sans elle, la vue lieu deduisait
  // l extremite et cliquer « Depart » editait l arrivee.
  const openSheet = useCallback(
    (next: PrepSheetId, focus?: string | null, field?: PrepPlaceField | null) => {
      setFocusStepId(focus ?? null);
      setPlaceField(field ?? null);
      setSheet(next);
    },
    []
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

  if (mounted && load.status === 'error') {
    return (
      <div className="adventure-prep">
        <div className="prep-screen" role="alert">
          <div
            className="prep-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <h1 className="prep-title">Impossible d’ouvrir cette aventure</h1>
            <p
              style={{
                margin: 0,
                color: 'var(--lkv-text-secondary)',
                fontSize: 'var(--lkv-text-body)',
              }}
            >
              {load.message}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {load.retry && (
                <Button variant="primary" size="md" onClick={() => setAttempt((n) => n + 1)}>
                  Réessayer
                </Button>
              )}
              <Button variant="ghost" size="md" onClick={() => router.push('/hub')}>
                Retour au hub
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mounted || load.status === 'loading') {
    return (
      <div className="adventure-prep">
        <div className="prep-screen" aria-busy="true" aria-live="polite">
          <p className="prep-note">
            {planId ? 'Ouverture de ton aventure…' : 'Reprise de ta préparation…'}
          </p>
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
        placeField={placeField}
        onOpenSheet={openSheet}
      />
    </>
  );
}

export default PrepFlow;
