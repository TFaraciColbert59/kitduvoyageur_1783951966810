import { addCustomTripItemAction } from '@/app/voyages/kit-actions';
import type { ApplyCurrent, ApplyOp } from '../engine/intent';
import {
  compasSetActivityAction,
  compasSetBudgetAction,
  compasSetDatesAction,
  compasSetPartySizeAction,
  compasSetPreferencesAction,
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
