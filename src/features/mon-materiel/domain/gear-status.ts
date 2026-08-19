/**
 * LKDV — Mon Matériel • Domaine : statut cumulatif d'un équipement.
 * `getGearStatus` retourne TOUS les statuts superposables d'un objet (possession,
 * commande, état, entretien, validité, disponibilité, prêt, emprunt, engagement,
 * perte, vente, alertes, badges, action recommandée).
 * Fonction pure : aucun effet de bord, aucune écriture de store.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearAvailabilityState, GearPossession, GearStatusContext } from '../types/gear';
import { evaluateGearAlerts, type GearAlert } from './gear-alerts';
import { computeGearAvailability } from './gear-availability';
import { daysUntil } from './gear-format';

export interface GearBadge {
  id: string;
  label: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
}

export interface GearStatus {
  possession: GearPossession;
  onOrder: boolean;
  orderStatus: 'none' | 'ordered' | 'received';
  physicalState: string;
  conditionLabel: string;
  maintenance: { due: boolean; approaching: boolean; label?: string };
  validity: { expired: boolean; expiringSoon: boolean; label?: string };
  availability: GearAvailabilityState;
  availabilityLabel: string;
  loan: { active: boolean; to?: string; since?: string };
  borrowed: { active: boolean; from?: string; dueDate?: string };
  engagement: { inKit: boolean; committedToDeparture: boolean; departureName?: string };
  lost: boolean;
  listedForSale: boolean;
  alerts: GearAlert[];
  badges: GearBadge[];
  recommendedAction: string;
}

export const CONDITION_LABELS: Record<string, string> = {
  neuf: 'Neuf',
  excellent: 'Excellent',
  bon: 'Bon',
  moyen: 'Moyen',
  usé: 'Usé',
  à_réparer: 'À réparer',
  à_remplacer: 'À remplacer',
};

export function conditionLabel(condition?: string | null): string {
  return CONDITION_LABELS[condition || ''] || condition || 'Non spécifié';
}

const DAY = 24 * 60 * 60 * 1000;

function nearOrPast(dateStr: string | null | undefined, now: Date, windowDays: number): 'past' | 'soon' | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime() - now.getTime();
  if (Number.isNaN(d)) return null;
  if (d < 0) return 'past';
  if (d <= windowDays * DAY) return 'soon';
  return null;
}

/** Statut cumulatif complet d'un équipement possédé. */
export function getGearStatus(gear: UserEquipmentItem, ctx: GearStatusContext = {}): GearStatus {
  const now = ctx.now || new Date();

  const maintenance = nearOrPast(gear.next_maintenance_date, now, 30);
  const validity = nearOrPast(gear.expiry_date, now, 30);

  const availability = computeGearAvailability(gear, ctx);
  const alerts = evaluateGearAlerts(gear, ctx);

  const inKit =
    Array.isArray(ctx.kitMembershipIds) && ctx.kitMembershipIds.includes(gear.id);
  const committedToDeparture =
    Array.isArray(ctx.hikeCommittedGearIds) && ctx.hikeCommittedGearIds.includes(gear.id);

  const loanActive = gear.loan_status === 'prêté' || Boolean(gear.loan_to_name);

  const orderedItem = Array.isArray(ctx.orderedItems)
    ? ctx.orderedItems.find((o) => o.productId && (o.productId === gear.product_id || o.name === gear.name))
    : undefined;

  const badges: GearBadge[] = [];
  const pushBadge = (id: string, label: string, severity: GearBadge['severity']) => badges.push({ id, label, severity });

  if (maintenance === 'past') pushBadge('revision', 'Révision due', 'critical');
  else if (maintenance === 'soon') pushBadge('revision', 'Entretien à prévoir', 'warning');
  if (validity === 'past') pushBadge('expiry', 'Périmé', 'critical');
  else if (validity === 'soon') pushBadge('expiry', 'Expiration proche', 'warning');
  if (loanActive) pushBadge('loan', `Prêté${gear.loan_to_name ? ` à ${gear.loan_to_name}` : ''}`, 'warning');
  if (committedToDeparture) pushBadge('committed', 'Engagé départ', 'info');
  if (orderedItem) pushBadge('ordered', 'En commande', 'info');
  if (inKit) pushBadge('kit', 'Dans un kit', 'success');
  if (gear.is_favorite) pushBadge('fav', 'Favori', 'success');
  if (gear.is_listed_for_sale) pushBadge('sale', 'En vente', 'info');
  if (gear.condition === 'à_réparer' || gear.condition === 'à_remplacer' || gear.condition === 'usé') {
    pushBadge('wear', conditionLabel(gear.condition), gear.condition === 'à_remplacer' ? 'critical' : 'warning');
  }

  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasWarning = alerts.some((a) => a.severity === 'warning');

  let recommendedAction = 'none';
  if (hasCritical) {
    const critical = alerts.find((a) => a.severity === 'critical');
    recommendedAction = critical?.actionKey || 'review';
  } else if (hasWarning) {
    const warning = alerts.find((a) => a.severity === 'warning');
    recommendedAction = warning?.actionKey || 'review';
  } else if (committedToDeparture) {
    recommendedAction = 'review';
  }

  const departedCountdown = ctx.activeDeparture ? daysUntil(ctx.activeDeparture.targetDate) : null;

  return {
    possession: 'owned',
    onOrder: Boolean(orderedItem),
    orderStatus: orderedItem ? (orderedItem.status === 'delivered' || orderedItem.status === 'received' ? 'received' : 'ordered') : 'none',
    physicalState: gear.condition || 'bon',
    conditionLabel: conditionLabel(gear.condition),
    maintenance: {
      due: maintenance === 'past',
      approaching: maintenance === 'soon',
      label:
        maintenance === 'past'
          ? 'Révision dépassée'
          : maintenance === 'soon'
          ? 'Prochaine révision à prévoir'
          : undefined,
    },
    validity: {
      expired: validity === 'past',
      expiringSoon: validity === 'soon',
      label:
        validity === 'past'
          ? 'Périmé'
          : validity === 'soon'
          ? 'Expiration proche'
          : undefined,
    },
    availability: availability.available ? 'available' : availability.primaryReason === 'on_loan' ? 'on_loan' : 'unavailable',
    availabilityLabel: availability.reasonLabel,
    loan: {
      active: loanActive,
      to: gear.loan_to_name || undefined,
    },
    borrowed: { active: false },
    engagement: {
      inKit,
      committedToDeparture,
      departureName:
        committedToDeparture && ctx.activeDeparture
          ? ctx.activeDeparture.name + (departedCountdown !== null ? ` · ${departedCountdown === 0 ? "Aujourd'hui" : departedCountdown < 0 ? `J+${Math.abs(departedCountdown)}` : `J-${departedCountdown}`}` : '')
          : undefined,
    },
    lost: false,
    listedForSale: Boolean(gear.is_listed_for_sale),
    alerts,
    badges,
    recommendedAction,
  };
}

/** Statut « non possédé » : tout est dérivé de la commande éventuelle. */
export function getUnownedStatus(
  product: { id?: string | null; name: string; brand?: string | null; weight_g?: number | null },
  ctx: GearStatusContext = {}
): GearStatus {
  const orderedItem = Array.isArray(ctx.orderedItems)
    ? ctx.orderedItems.find((o) => (o.productId === product.id) || o.name === product.name)
    : undefined;
  const alerts: GearAlert[] = [];
  const badges: GearBadge[] = [];
  if (orderedItem) {
    badges.push({ id: 'ordered', label: 'En commande', severity: 'info' });
  }
  return {
    possession: 'unowned',
    onOrder: Boolean(orderedItem),
    orderStatus: orderedItem ? 'ordered' : 'none',
    physicalState: 'neuf',
    conditionLabel: 'Neuf',
    maintenance: { due: false, approaching: false },
    validity: { expired: false, expiringSoon: false },
    availability: 'not_owned',
    availabilityLabel: orderedItem
      ? `Commandé — en attente de réception`
      : 'Non possédé — à acquérir',
    loan: { active: false },
    borrowed: { active: false },
    engagement: { inKit: false, committedToDeparture: false },
    lost: false,
    listedForSale: false,
    alerts,
    badges,
    recommendedAction: 'none',
  };
}