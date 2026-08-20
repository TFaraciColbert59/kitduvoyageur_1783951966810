'use client';

/**
 * LKDV — Mon Matériel : useAvailabilityTimeline.
 * Grand timeline de disponibilité sur une fenêtre (`days` à 7 ou 30) à partir
 * de la map de disponibilité du domaine. Client-side uniquement.
 */

import { useMemo } from 'react';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearStatusContext } from '../types';
import {
  computeGearAvailability,
  buildAvailabilitySlots,
  type AvailabilitySlot,
} from '../domain/gear-availability';

export interface AvailabilityTimelineItem {
  gearId: string;
  name: string;
  slots: AvailabilitySlot[];
  available: boolean;
  windowLabel: string;
}

export interface UseAvailabilityTimelineResult {
  data: AvailabilityTimelineItem[];
  isLoading: boolean;
  error: string | null;
}

export function useAvailabilityTimeline(
  gearIds: string[],
  equipment: UserEquipmentItem[],
  context: GearStatusContext,
  days: 7 | 30 = 30
): UseAvailabilityTimelineResult {
  return useMemo(() => {
    const idSet = new Set(gearIds);
    const items: AvailabilityTimelineItem[] = equipment
      .filter((e) => idSet.size === 0 || idSet.has(e.id))
      .map((gear) => {
        const availability = computeGearAvailability(gear, { ...context, now: context.now || new Date() });
        const slots = buildAvailabilitySlots(gear, { ...context, now: context.now || new Date() });
        return {
          gearId: gear.id,
          name: gear.name,
          slots,
          available: availability.available,
          windowLabel: days === 7 ? '7 jours' : '30 jours',
        };
      });
    return { data: items, isLoading: false, error: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gearIds, equipment, days]);
}