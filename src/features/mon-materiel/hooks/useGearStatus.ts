'use client';

/**
 * LKDV — Mon Matériel : hooks du domaine (statuts, alertes, disponibilité).
 * Fonctions mémoïsées, aucune récupération réseau ici — le contexte est fourni
 * par le caller (page cockpit) qui orchestre useEquipment/useUserKits/services.
 */

import { useMemo } from 'react';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearStatusContext } from '../types';
import { getGearStatus, type GearStatus } from '../domain/gear-status';
import { evaluateGearAlerts, prioritizeAlerts, type GearAlert } from '../domain/gear-alerts';
import { computeGearAvailability, type GearAvailability } from '../domain/gear-availability';

/** Map id → statut cumulatif pour chaque objet possédé. */
export function useGearStatus(
  equipment: UserEquipmentItem[],
  context: GearStatusContext
): Map<string, GearStatus> {
  return useMemo(() => {
    const map = new Map<string, GearStatus>();
    for (const gear of equipment) {
      map.set(gear.id, getGearStatus(gear, context));
    }
    return map;
  }, [equipment, context]);
}

/** Alertes globales consolidées de tout l'inventaire, triées critique → info. */
export function useGearAlerts(
  equipment: UserEquipmentItem[],
  context: GearStatusContext
): {
  alerts: GearAlert[];
  criticalCount: number;
  warningCount: number;
} {
  return useMemo(() => {
    const alerts = prioritizeAlerts(
      equipment.flatMap((gear) => evaluateGearAlerts(gear, context))
    );
    return {
      alerts,
      criticalCount: alerts.filter((a) => a.severity === 'critical').length,
      warningCount: alerts.filter((a) => a.severity === 'warning').length,
    };
  }, [equipment, context]);
}

/** Map id → disponibilité pour chaque objet possédé. */
export function useGearAvailability(
  equipment: UserEquipmentItem[],
  context: GearStatusContext
): Map<string, GearAvailability> {
  return useMemo(() => {
    const map = new Map<string, GearAvailability>();
    for (const gear of equipment) {
      map.set(gear.id, computeGearAvailability(gear, context));
    }
    return map;
  }, [equipment, context]);
}