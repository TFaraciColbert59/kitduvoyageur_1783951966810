/**
 * LKDV — Mon Matériel • Domaine : alertes & entretien.
 * Fonctions pures de détection et de priorisation des alertes d'un équipement.
 * Aucun effet de bord : entrée = objet + contexte, sortie = liste ordonnée.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearStatusContext } from '../types/gear';

export type GearAlertKind =
  | 'maintenance_due'
  | 'maintenance_soon'
  | 'expired'
  | 'expiring_soon'
  | 'loan_active'
  | 'loan_overdue'
  | 'wear_repair'
  | 'wear_replace'
  | 'departure_conflict'
  | 'listed_for_sale';

export type GearAlertSeverity = 'critical' | 'warning' | 'info';

/** Action principale recommandée (mappée à un bouton/route dans l'UI). */
export type GearAlertActionKey =
  | 'review'
  | 'replace'
  | 'nudge'
  | 'resolve_conflict'
  | 'shelve'
  | 'none';

export interface GearAlert {
  kind: GearAlertKind;
  gearId?: string;
  label: string;
  detail: string;
  severity: GearAlertSeverity;
  actionKey: GearAlertActionKey;
}

export const ALERT_ACTION_LABEL: Record<GearAlertActionKey, string> = {
  review: 'Marquer révisé',
  replace: 'Remplacer',
  nudge: 'Relancer',
  resolve_conflict: 'Résoudre le conflit',
  shelve: 'Mettre en vente',
  none: 'Voir la fiche',
};

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / DAY);
}

/** Alerte de maintenance (due ou approchante). */
export function maintenanceAlert(gear: UserEquipmentItem, now: Date): GearAlert | null {
  const d = daysFromNow(gear.next_maintenance_date, now);
  if (d === null) return null;
  if (d < 0) {
    return {
      kind: 'maintenance_due',
      gearId: gear.id,
      label: `${gear.name} : révision dépassée`,
      detail: `Entretien planifié le ${new Date(gear.next_maintenance_date!).toLocaleDateString('fr-FR')}, en retard de ${Math.abs(d)} jour(s).`,
      severity: 'critical',
      actionKey: 'review',
    };
  }
  if (d <= 30) {
    return {
      kind: 'maintenance_soon',
      gearId: gear.id,
      label: `${gear.name} : entretien à prévoir`,
      detail: `Prochaine révision dans ${d} jour(s).`,
      severity: 'warning',
      actionKey: 'review',
    };
  }
  return null;
}

/** Alerte de péremption (idéale ou approchante). */
export function expiryAlert(gear: UserEquipmentItem, now: Date): GearAlert | null {
  const d = daysFromNow(gear.expiry_date, now);
  if (d === null) return null;
  if (d < 0) {
    return {
      kind: 'expired',
      gearId: gear.id,
      label: `${gear.name} : périmé`,
      detail: `Date de péremption dépassée (${new Date(gear.expiry_date!).toLocaleDateString('fr-FR')}). Ne pas emporter sans contrôle.`,
      severity: 'critical',
      actionKey: 'replace',
    };
  }
  if (d <= 30) {
    return {
      kind: 'expiring_soon',
      gearId: gear.id,
      label: `${gear.name} : expiration proche`,
      detail: `Péremption dans ${d} jour(s).`,
      severity: 'warning',
      actionKey: 'replace',
    };
  }
  return null;
}

/** Alerte de prêt (actif, ou en retard si une date de retour est connue). */
export function loanAlert(gear: UserEquipmentItem, ctx: GearStatusContext): GearAlert | null {
  const isLent = gear.loan_status === 'prêté' || Boolean(gear.loan_to_name);
  if (!isLent) return null;
  const record = Array.isArray(ctx.activeLoans)
    ? ctx.activeLoans.find((l) => l.gear_item_id === gear.id && !l.returned_at)
    : undefined;
  const borrower = gear.loan_to_name || record?.loaned_to || 'un ami';
  // Le schéma actuel de la table `loans` ne stocke pas de date de retour : pas de détection de retard fiable.
  return {
    kind: 'loan_active',
    gearId: gear.id,
    label: `${gear.name} : prêté en cours`,
    detail: `Prêté à ${borrower} — penser à le récupérer avant le départ.`,
    severity: 'warning',
    actionKey: 'nudge',
  };
}

/** Alerte d'usure (état matériel). */
export function wearAlert(gear: UserEquipmentItem): GearAlert | null {
  if (gear.condition === 'à_remplacer') {
    return {
      kind: 'wear_replace',
      gearId: gear.id,
      label: `${gear.name} : à remplacer`,
      detail: "État « à remplacer » — matériel dégradé avant départ.",
      severity: 'critical',
      actionKey: 'replace',
    };
  }
  if (gear.condition === 'à_réparer') {
    return {
      kind: 'wear_repair',
      gearId: gear.id,
      label: `${gear.name} : à réparer`,
      detail: "État « à réparer » — vérifier avant de compter dessus.",
      severity: 'warning',
      actionKey: 'review',
    };
  }
  return null;
}

/** Alerte de conflit : objet réservé (départ) mais indisponible (prêt/maintenance/périmé). */
export function departureConflictAlert(gear: UserEquipmentItem, ctx: GearStatusContext): GearAlert | null {
  const committed = Array.isArray(ctx.hikeCommittedGearIds) && ctx.hikeCommittedGearIds.includes(gear.id);
  if (!committed) return null;
  const unavailable = gear.loan_status === 'prêté' || Boolean(gear.loan_to_name) || gear.condition === 'à_remplacer';
  if (!unavailable) return null;
  const reason =
    gear.loan_status === 'prêté' || Boolean(gear.loan_to_name)
      ? 'actuellement prêté'
      : 'état dégradé (à remplacer)';
  const departureName = ctx.activeDeparture?.name || 'prochain départ';
  return {
    kind: 'departure_conflict',
    gearId: gear.id,
    label: `${gear.name} : conflit avec le départ`,
    detail: `Réservé pour « ${departureName} » mais ${reason}.`,
    severity: 'critical',
    actionKey: 'resolve_conflict',
  };
}

/** Alertes cumulables d'un objet, ordonnées critique→info. */
export function evaluateGearAlerts(gear: UserEquipmentItem, ctx: GearStatusContext = {}): GearAlert[] {
  const now = ctx.now || new Date();
  const alerts: GearAlert[] = [];
  const push = (a: GearAlert | null) => {
    if (a) alerts.push(a);
  };

  push(maintenanceAlert(gear, now));
  push(expiryAlert(gear, now));
  push(loanAlert(gear, ctx));
  push(wearAlert(gear));
  push(departureConflictAlert(gear, ctx));
  if (gear.is_listed_for_sale) {
    alerts.push({
      kind: 'listed_for_sale',
      gearId: gear.id,
      label: `${gear.name} : mis en vente`,
      detail: 'Cet objet est listé en vente — il ne sera pas disponible au prochain départ.',
      severity: 'info',
      actionKey: 'shelve',
    });
  }

  return prioritizeAlerts(alerts);
}

const SEVERITY_ORDER: Record<GearAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Tri critique → info, puis par type. */
export function prioritizeAlerts(alerts: GearAlert[]): GearAlert[] {
  return [...alerts].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return a.label.localeCompare(b.label);
  });
}

export function countCritical(alerts: GearAlert[]): number {
  return alerts.filter((a) => a.severity === 'critical').length;
}

export function countWarnings(alerts: GearAlert[]): number {
  return alerts.filter((a) => a.severity === 'warning').length;
}