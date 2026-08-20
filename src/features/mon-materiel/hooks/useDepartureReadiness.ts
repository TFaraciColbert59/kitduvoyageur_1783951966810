'use client';

/**
 * LKDV — Mon Matériel : useDepartureReadiness.
 * Dérive l'évaluation de préparation d'un départ (statut, blocants, checklist)
 * à partir des données déjà chargées par la page cockpit. Client-side uniquement.
 */

import { useMemo } from 'react';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { GearAlert } from '../domain/gear-alerts';
import {
  evaluateDepartureReadiness,
  buildDepartureChecklist,
  type DepartureReadiness,
  type DepartureChecklistItem,
} from '../domain/departure-readiness';

export interface UseDepartureReadinessResult {
  data: {
    readiness: DepartureReadiness | null;
    checklist: DepartureChecklistItem[];
  };
  isLoading: boolean;
  error: string | null;
}

export function useDepartureReadiness(
  activeHike: PlannedHike | null,
  activeKit: CustomKit | null,
  equipment: UserEquipmentItem[],
  alerts: GearAlert[]
): UseDepartureReadinessResult {
  return useMemo(() => {
    if (!activeHike) {
      return { data: { readiness: null, checklist: [] }, isLoading: false, error: null };
    }
    try {
      const readiness = evaluateDepartureReadiness(activeHike, activeKit, equipment, alerts);
      const checklist = buildDepartureChecklist(activeHike, activeKit, equipment, alerts);
      return { data: { readiness, checklist }, isLoading: false, error: null };
    } catch (e) {
      return {
        data: { readiness: null, checklist: [] },
        isLoading: false,
        error: e instanceof Error ? e.message : 'Erreur de calcul de préparation.',
      };
    }
  }, [activeHike, activeKit, equipment, alerts]);
}