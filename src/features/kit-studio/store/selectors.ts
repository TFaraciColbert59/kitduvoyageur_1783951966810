// Sélecteurs mémoïsés : recalcul seulement quand la référence de KitState change.
import { orderLines, orderTotalCents, toOrder } from '../domain/order';
import { pieces } from '../domain/parts';
import { totals } from '../domain/totals';
import type { KitState } from '../domain/types';

/** Mémoïsation à une entrée, clé = identité de l'état. */
function memo<R>(fn: (s: KitState) => R): (s: KitState) => R {
  let lastIn: KitState | null = null;
  let lastOut: R;
  return (s) => {
    if (s !== lastIn) {
      lastOut = fn(s);
      lastIn = s;
    }
    return lastOut;
  };
}

export const selectTotals = memo(totals);
export const selectPieces = memo(pieces);
export const selectToOrder = memo(toOrder);
export const selectOrderLines = memo(orderLines);
export const selectOrderTotalCents = memo(orderTotalCents);
