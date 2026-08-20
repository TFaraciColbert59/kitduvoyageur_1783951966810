'use client';

/**
 * LKDV — Mon Matériel : useInventoryStats.
 * Statistiques d'inventaire (poids, valeur, répartition, opérationnel).
 * Client-side uniquement.
 */

import { useMemo } from 'react';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import { inventoryValueStats, type InventoryValueStats } from '../domain/inventory-stats';

export interface UseInventoryStatsResult {
  data: InventoryValueStats;
  isLoading: boolean;
  error: string | null;
}

export function useInventoryStats(equipment: UserEquipmentItem[]): UseInventoryStatsResult {
  return useMemo(
    () => ({ data: inventoryValueStats(equipment), isLoading: false, error: null }),
    [equipment]
  );
}