// Commande : pièces à commander, total en centimes, confirmation. Pur.
// Maquette Kit_Studio_v2.html l.716-717 (toOrder, orderTotal), l.1470-1502 (logique seule).
import { COLORWAYS } from './catalog';
import type { ColorwayId } from './catalog';
import { pieceCw, pieceInfo, pieceState, pieces } from './parts';
import type { PieceState } from './parts';
import type { KitState, PieceKey } from './types';

export interface OrderLine {
  readonly key: PieceKey;
  readonly name: string;
  readonly colorway: ColorwayId;
  readonly colorwayName: string;
  readonly priceCents: number;
  readonly state: PieceState;
}

/** Pièces à commander (état « new »). */
export function toOrder(s: KitState): PieceKey[] {
  return pieces(s).filter((k) => pieceState(s, k) === 'new');
}

const cents = (eur: number): number => Math.round(eur * 100);

/** Total à commander, ENTIER en centimes. */
export function orderTotalCents(s: KitState): number {
  return toOrder(s).reduce((a, k) => a + cents(pieceInfo(k).eur), 0);
}

/** Lignes de la configuration complète (toutes les pièces, avec leur état). */
export function orderLines(s: KitState): OrderLine[] {
  return pieces(s).map((key) => {
    const cw = pieceCw(s, key);
    return {
      key,
      name: pieceInfo(key).n,
      colorway: cw,
      colorwayName: COLORWAYS[cw].n,
      priceCents: cents(pieceInfo(key).eur),
      state: pieceState(s, key),
    };
  });
}

/** Précommande : les pièces à commander passent dans `order` avec leur coloris courant. */
export function confirmOrder(s: KitState): KitState {
  const add: Partial<Record<PieceKey, ColorwayId>> = {};
  for (const k of toOrder(s)) add[k] = pieceCw(s, k);
  return { ...s, order: { ...s.order, ...add } };
}
