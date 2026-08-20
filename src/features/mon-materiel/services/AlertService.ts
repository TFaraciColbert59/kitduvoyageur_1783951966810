'use client';

/**
 * LKDV — Mon Matériel : service alertes (projections pures du domaine).
 * globalScore, filter (onglets), dueIn (J-7), seasonalTip et historique.
 * Aucune mutation ici — les résolutions passent par GearService.resolveAlert.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearAlert } from '../domain/gear-alerts';
import { countCritical, countWarnings } from '../domain/gear-alerts';
import { pct } from '../domain/gear-format';
import { GearService, type AlertHistoryRow } from './GearService';

export type AlertFilterKey = 'all' | 'maintenance' | 'expiry' | 'loan' | 'wear' | 'departure_conflict';

export const alertTypeOf = (kind: GearAlert['kind']): AlertFilterKey => {
  switch (kind) {
    case 'maintenance_due':
    case 'maintenance_soon':
      return 'maintenance';
    case 'expired':
    case 'expiring_soon':
      return 'expiry';
    case 'loan_active':
    case 'loan_overdue':
      return 'loan';
    case 'wear_repair':
    case 'wear_replace':
      return 'wear';
    case 'departure_conflict':
      return 'departure_conflict';
    default:
      return 'all';
  }
};

export class AlertService {
  private gearService = new GearService();

  /** Score de fiabilité global (0..100) : 100 − pénalité critiques/warnings. */
  globalScore(alerts: GearAlert[], equipmentTotal: number): number {
    if (equipmentTotal <= 0) return 100;
    const penalty = countCritical(alerts) * 25 + countWarnings(alerts) * 10;
    return Math.max(0, Math.min(100, 100 - Math.round((penalty / equipmentTotal) * 10)));
  }

  /** Filtre les alertes par onglet (vs le domaine). */
  filter(alerts: GearAlert[], filter: AlertFilterKey): GearAlert[] {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => alertTypeOf(a.kind) === filter);
  }

  /** Alertes d'action dans la fenêtre `days` (critiques/warnings). */
  dueIn(alerts: GearAlert[], days = 7): GearAlert[] {
    return alerts
      .filter((a) => {
        // Pour maintenance/péremption on signale tout sauf les infos.
        if (a.kind !== 'maintenance_due' && a.kind !== 'maintenance_soon' && a.kind !== 'expired' && a.kind !== 'expiring_soon') {
          return a.severity === 'critical';
        }
        return a.severity !== 'info';
      })
      .slice(0, Math.max(10, days));
  }

  /** Répartition par catégorie d'alerte (pour donut / jauge). */
  byCategory(alerts: GearAlert[]): Array<{ label: string; value: number }> {
    const map = new Map<string, number>();
    for (const a of alerts) {
      const key = alertTypeOf(a.kind);
      map.set(key, (map.get(key) || 0) + 1);
    }
    const labels: Record<string, string> = {
      maintenance: 'Entretien',
      expiry: 'Péremption',
      loan: 'Prêts',
      wear: 'État',
      departure_conflict: 'Conflits',
    };
    return Array.from(map.entries())
      .map(([k, v]) => ({ label: labels[k] || k, value: v }))
      .sort((a, b) => b.value - a.value);
  }

  /** Top 3 des objets usés (miroir du domaine via GearService.topWear). */
  topWear(equipment: UserEquipmentItem[], n = 3): UserEquipmentItem[] {
    return this.gearService.topWear(equipment, n);
  }

  /** Recommandation saisonnière (règle simple, données réelles). */
  seasonalTip(equipment: UserEquipmentItem[], now = new Date()): string | null {
    const month = now.getMonth();
    const waterLayer = equipment.some((e) => /poncho|gore.?tex|imperm|pluie/i.test(`${e.name} ${e.materials || ''}`));
    if (month >= 10 || month <= 2) {
      return waterLayer
        ? 'Hiver : votre couche imperméable est bien notée. Vérifiez les gants et l’éclairage frontal.'
        : 'Hiver : pensez à ajouter une couche imperméable et un éclairage frontal dans votre inventaire.';
    }
    if (month >= 5 && month <= 8) {
      return waterLayer
        ? 'Été : hydratez-vous — prévoyez un réservoir d’eau et une protection solaire.'
        : 'Été : ajoutez une protection solaire et un réservoir d’eau à votre kit.';
    }
    return null;
  }

  /** Historique résolu (table gear_alert_history — M4). */
  async history(userId: string, limit = 100): Promise<AlertHistoryRow[]> {
    return this.gearService.listAlertHistory(userId, limit);
  }
}

export { pct };