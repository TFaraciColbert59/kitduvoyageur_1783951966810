/**
 * LKDV — Mon Matériel • Domaine : disponibilité d'un équipement.
 * Calcule si un objet est disponible MAINTENANT et construit une timeline de
 * blocages (prêts, départ engagé, maintenance, péremption) pour le plein écran
 * « Disponibilité ». Fonctions pures, sans effet de bord.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearAvailabilityState, GearStatusContext } from '../types/gear';

export type AvailabilityReason = 'on_loan' | 'departure' | 'maintenance' | 'expired' | 'unowned';

export interface AvailabilitySlot {
  id: string;
  reason: AvailabilityReason;
  from: string; // date ISO (ou label)
  to?: string;
  label: string;
  detail?: string;
  departureId?: string;
}

export interface GearAvailability {
  available: boolean;
  availableLabel: string;
  primaryReason?: AvailabilityReason;
  reasonLabel: string;
  blocks: AvailabilitySlot[];
  /** Chevauchements à signaler (plusieurs raisons simultanées). */
  conflicts: AvailabilitySlot[];
}

export function computeGearAvailability(gear: UserEquipmentItem, ctx: GearStatusContext = {}): GearAvailability {
  const blocks = buildAvailabilitySlots(gear, ctx);
  const activeBlocks = blocks.filter((b) => !b.to || new Date(b.to).getTime() >= (ctx.now || new Date()).getTime());

  if (activeBlocks.length === 0) {
    return {
      available: true,
      availableLabel: 'Disponible',
      reasonLabel: 'Disponible immédiatement',
      blocks,
      conflicts: [],
    };
  }

  const severityOrder: AvailabilityReason[] = ['on_loan', 'departure', 'expired', 'maintenance'];
  const primary = [...activeBlocks].sort(
    (a, b) => severityOrder.indexOf(a.reason) - severityOrder.indexOf(b.reason)
  )[0];

  const conflicts =
    activeBlocks.length > 1
      ? [activeBlocks[0], ...activeBlocks.filter((b) => b.id !== activeBlocks[0].id)]
      : [];

  const verb: Record<AvailabilityReason, { label: string; def: string }> = {
    on_loan: { label: 'Prêté', def: 'this object'},
    departure: { label: 'Engagé dans un départ', def: 'réservé pour un départ' },
    maintenance: { label: 'En maintenance', def: 'entretien en cours' },
    expired: { label: 'Périmé', def: 'arrivé à péremption' },
    unowned: { label: 'Non possédé', def: 'pas encore en inventaire' },
  };

  return {
    available: false,
    availableLabel: verb[primary.reason].label,
    reasonLabel: `${gear.name} — ${verb[primary.reason].def}`,
    primaryReason: primary.reason,
    blocks,
    conflicts,
  };
}

/** Construit la timeline des blocages d'un objet sur ses périodes connues. */
export function buildAvailabilitySlots(gear: UserEquipmentItem, ctx: GearStatusContext = {}): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const now = ctx.now || new Date();

  const isLent = gear.loan_status === 'prêté' || Boolean(gear.loan_to_name);
  if (isLent) {
    const record = Array.isArray(ctx.activeLoans)
      ? ctx.activeLoans.find((l) => l.gear_item_id === gear.id && !l.returned_at)
      : undefined;
    slots.push({
      id: `slot-loan-${gear.id}`,
      reason: 'on_loan',
      from: record?.loaned_at || now.toISOString(),
      label: `Prêté à ${gear.loan_to_name || record?.loaned_to || 'un ami'}`,
      detail: 'Récupérer avant le prochain départ.',
    });
  }

  const committed =
    Array.isArray(ctx.hikeCommittedGearIds) && ctx.hikeCommittedGearIds.includes(gear.id);
  if (committed && ctx.activeDeparture) {
    const from = ctx.activeDeparture.targetDate || undefined;
    slots.push({
      id: `slot-dep-${gear.id}`,
      reason: 'departure',
      from: from ? `${from}T00:00:00` : now.toISOString(),
      to: from,
      label: `Réservé pour « ${ctx.activeDeparture.name} »`,
      detail: 'Inclu dans le kit du prochain départ.',
      departureId: ctx.activeDeparture.id,
    });
  }

  if (gear.next_maintenance_date && new Date(gear.next_maintenance_date).getTime() < now.getTime()) {
    slots.push({
      id: `slot-maint-${gear.id}`,
      reason: 'maintenance',
      from: gear.next_maintenance_date,
      label: 'Maintenance dépassée',
      detail: 'Révision planifiée non effectuée.',
    });
  }

  if (gear.expiry_date && new Date(gear.expiry_date).getTime() < now.getTime()) {
    slots.push({
      id: `slot-exp-${gear.id}`,
      reason: 'expired',
      from: gear.expiry_date,
      label: 'Périmé',
      detail: 'Ne pas emporter sans contrôle.',
    });
  }

  if (gear.is_listed_for_sale) {
    slots.push({
      id: `slot-sale-${gear.id}`,
      reason: 'unowned' as AvailabilityReason,
      from: now.toISOString(),
      label: 'Mis en vente',
      detail: 'Objet listé en vente — à retirer de la préparation.',
    });
  }

  return slots;
}

export function availabilityState(gear: UserEquipmentItem, ctx: GearStatusContext = {}): GearAvailabilityState {
  const availability = computeGearAvailability(gear, ctx);
  if (availability.primaryReason === 'on_loan') return 'on_loan';
  if (availability.available) return 'available';
  return 'unavailable';
}