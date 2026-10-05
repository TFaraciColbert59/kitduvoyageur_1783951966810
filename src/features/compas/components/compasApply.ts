import { addCustomTripItemAction } from '@/app/voyages/kit-actions';
import {
  COMPAS_ACTIVITIES,
  type ApplyCurrent,
  type ApplyOp,
  type CompasActivity,
} from '../engine/intent';
import {
  compasSetActivityAction,
  compasSetBudgetAction,
  compasSetDatesAction,
  compasSetPartySizeAction,
  compasSetPreferencesAction,
  compasSetDestinationAction,
  compasSetSpanAction,
} from '../server/compasActions';
import type { ActionResult, CompasCtl } from './compasTypes';

/** État courant du voyage, tel que le plan d'application le lit. */
export function applyCurrent(ctl: CompasCtl): ApplyCurrent {
  const { dates, preferences } = ctl.data.model;
  return {
    startDate: dates.start,
    endDate: dates.end,
    days: dates.days,
    shortHours: dates.hours != null && dates.hours < 24 ? dates.hours : null,
    preferences,
    hasRoute: ctl.data.route.id != null,
  };
}

/**
 * Exécute les opérations une par une (l'ordre compte : les dates avant le
 * reste). S'arrête à la première erreur et dit combien sont passées.
 */
export async function runOps(
  ctl: CompasCtl,
  ops: ApplyOp[]
): Promise<ActionResult & { done: number }> {
  const { tripId, slug } = ctl.data.model;
  let done = 0;
  for (const op of ops) {
    let res: ActionResult;
    switch (op.op) {
      case 'dates':
        res = await compasSetDatesAction({
          tripId,
          tripSlug: slug,
          startDate: op.startDate,
          endDate: op.endDate,
          durationHours: op.durationHours,
          resplit: op.resplit,
        });
        break;
      case 'party':
        res = await compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: op.partySize });
        break;
      case 'budget':
        res = await compasSetBudgetAction({ tripId, tripSlug: slug, amount: op.amount });
        break;
      case 'prefs':
        res = await compasSetPreferencesAction({
          tripId,
          tripSlug: slug,
          preferences: op.preferences,
        });
        break;
      case 'activity':
        res = await compasSetActivityAction({ tripId, tripSlug: slug, activity: op.activity });
        break;
      case 'item': {
        const fd = new FormData();
        fd.set('itemName', op.name);
        fd.set('category', 'misc');
        fd.set('quantity', String(op.quantity));
        fd.set('isVital', 'false');
        fd.set('isWorn', 'false');
        fd.set('isConsumable', 'false');
        res = await addCustomTripItemAction(tripId, slug, fd);
        break;
      }
      case 'route':
        // Une recherche n'écrit rien : l'écran ouvre Parcours avec la requête.
        res = { success: true };
        break;
      case 'destination':
        res = await compasSetDestinationAction({ tripId, tripSlug: slug, place: op.place });
        break;
      case 'span':
        res = await compasSetSpanAction({ tripId, tripSlug: slug, days: op.days });
        break;
    }
    if (!res.success) {
      return {
        success: false,
        error: done
          ? `${res.error ?? 'Échec'} (${done} déjà appliqué${done > 1 ? 's' : ''})`
          : res.error,
        done,
      };
    }
    done += 1;
  }
  return { success: true, done };
}

/**
 * L'opération inverse des écritures, calculée sur l'état réel d'AVANT.
 * Rien d'inventé : une écriture sans inverse sûr (objet ajouté, nombre de
 * personnes non renseigné, dates redécoupées en étapes) rend l'ensemble
 * non annulable, et « Annuler » n'est alors pas proposé.
 */
export function inverseOps(ctl: CompasCtl, ops: readonly ApplyOp[]): ApplyOp[] | null {
  const m = ctl.data.model;
  const out: ApplyOp[] = [];
  for (const op of ops) {
    switch (op.op) {
      case 'dates':
        if (op.resplit || !m.dates.start || !m.dates.end) return null;
        out.push({
          op: 'dates',
          startDate: m.dates.start,
          endDate: m.dates.end,
          durationHours: m.dates.hours != null && m.dates.hours < 24 ? m.dates.hours : null,
          resplit: false,
        });
        break;
      case 'prefs':
        out.push({ op: 'prefs', preferences: m.preferences });
        break;
      case 'activity':
        if (!m.activity || !(COMPAS_ACTIVITIES as readonly string[]).includes(m.activity))
          return null;
        out.push({ op: 'activity', activity: m.activity as CompasActivity });
        break;
      case 'budget':
        if (m.budget.target == null) return null;
        out.push({ op: 'budget', amount: m.budget.target });
        break;
      case 'route':
        break;
      case 'destination':
        out.push({ op: 'destination', place: m.destination ?? null });
        break;
      case 'span':
        out.push({ op: 'span', days: ctl.data.plannedDays ?? null });
        break;
      default:
        return null;
    }
  }
  // Dans l'ordre inverse : le dernier changement est défait en premier.
  return out.reverse();
}
