'use client';

/**
 * LKDV — Mon Matériel : useKitProgress.
 * Agrège la progression (possession) de chaque kit actif. Client-side uniquement.
 */

import { useMemo } from 'react';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import { aggregateKitProgress, type KitProgress } from '../domain/kit-aggregation';

export interface UseKitProgressResult {
  data: KitProgress[];
  isLoading: boolean;
  error: string | null;
}

export function useKitProgress(
  kits: CustomKit[],
  equipment: UserEquipmentItem[]
): UseKitProgressResult {
  return useMemo(
    () => ({ data: aggregateKitProgress(kits, equipment), isLoading: false, error: null }),
    [kits, equipment]
  );
}