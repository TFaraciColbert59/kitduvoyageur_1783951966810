'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  type TripWizardState,
  DEFAULT_WIZARD_STATE,
  CURATED_COUNTRIES,
} from './wizardTypes';
import { saveDraftTripAction } from '@/app/voyages/actions';

const STORAGE_KEY = 'lkdv:trip-draft';

export function useTripDraft() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<TripWizardState>(DEFAULT_WIZARD_STATE);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initialisation depuis localStorage et query params
  useEffect(() => {
    let initial = { ...DEFAULT_WIZARD_STATE };

    // Lecture du localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          initial = { ...initial, ...parsed };
        }
      } catch (err) {
        console.warn('[LKDV wizard] Erreur lecture localStorage:', err);
      }
    }

    // Paramètre step dans l'URL prioritaire
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 5) {
        initial.step = stepNum;
      }
    }

    // Paramètre pays dans l'URL si fourni (?country=IS)
    const countryParam = searchParams.get('country');
    if (countryParam) {
      const found = CURATED_COUNTRIES.find(
        (c) => c.code.toUpperCase() === countryParam.toUpperCase()
      );
      if (found) {
        initial.countries = [found];
      }
    }

    setState(initial);
    setIsInitialized(true);
  }, [searchParams]);

  // 2. Synchronisation vers localStorage à chaque modification
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[LKDV wizard] Erreur écriture localStorage:', err);
    }
  }, [state, isInitialized]);

  // 3. Mise à jour de l'URL quand step change
  const setStep = useCallback(
    (newStep: number) => {
      const clamped = Math.max(1, Math.min(newStep, 5));
      setState((prev) => ({ ...prev, step: clamped }));

      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('step', clamped.toString());
      const search = current.toString();
      const query = search ? `?${search}` : '';
      router.push(`/voyages/nouveau${query}`, { scroll: false });
    },
    [router, searchParams]
  );

  // 4. Mise à jour partielle des champs
  const updateDraft = useCallback((updates: Partial<TripWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // 5. Sauvegarde en base au statut 'draft' dès l'étape 3
  const saveDraftToDatabase = useCallback(async () => {
    if (!state.countries.length) return;
    setIsSaving(true);
    try {
      const defaultTitle =
        state.title.trim() ||
        `Voyage ${state.countries.map((c) => c.name.split(' ')[0]).join(' / ')} (${state.durationDays}j)`;

      const res = await saveDraftTripAction({
        tripId: state.tripId || undefined,
        title: defaultTitle,
        description: state.description || undefined,
        countries: state.countries.map((c) => c.code),
        destinationName: state.countries.map((c) => c.name).join(', '),
        startDate: state.startDate || undefined,
        endDate: state.endDate || undefined,
        durationDays: state.durationDays,
        pace: state.pace,
        activityType: state.activityType,
        difficulty: state.difficulty,
        accommodationType: state.accommodationType,
        travelersCount: state.travelersCount,
        groupType: state.groupType,
        groupId: state.groupId,
      });

      if (res.tripId) {
        setState((prev) => ({
          ...prev,
          tripId: res.tripId,
          slug: res.slug,
          title: defaultTitle,
        }));
      }
    } catch (err) {
      console.warn('[LKDV wizard] Échec sauvegarde brouillon en base (mode offline/anonyme):', err);
    } finally {
      setIsSaving(false);
    }
  }, [state]);

  // 6. Réinitialisation
  const resetDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState(DEFAULT_WIZARD_STATE);
    router.push('/voyages/nouveau?step=1');
  }, [router]);

  return {
    state,
    isInitialized,
    isSaving,
    setStep,
    updateDraft,
    saveDraftToDatabase,
    resetDraft,
  };
}
