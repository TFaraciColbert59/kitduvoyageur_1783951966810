'use client';
import { orderTotalCents, toOrder } from '../domain/order';
import { formatEuro } from '../domain/format';
import { pieceState, pieces } from '../domain/parts';
import type { KitState } from '../domain/types';
import { Icon } from './icons';
import './sheets/sheets.css';

const TXT_ORDER = 'Commander';
const TXT_ALL_OWNED = 'Tout est à toi · voir la configuration';
const TXT_ALL_PREORDERED = 'Précommandé · voir la configuration';

/** « 1 pièce », « 2 pièces ». */
export const piecesLabel = (n: number): string => `${n} pièce${n > 1 ? 's' : ''}`;

interface OrderButtonProps {
  state: KitState;
  /** Ouvre la feuille Commande. */
  onClick: () => void;
}

/** Bouton du tiroir, sous les cartes : jamais flottant. */
export function OrderButton({ state, onClick }: OrderButtonProps) {
  const lines = toOrder(state);
  const pending = lines.length > 0;
  const preordered = !pending && pieces(state).some((k) => pieceState(state, k) === 'order');
  const totalCents = orderTotalCents(state);
  const totalLabel = totalCents != null ? formatEuro(totalCents) : 'prix non renseigné';
  return (
    <button type="button" className="ks-gbtn" data-pro={pending} onClick={onClick}>
      {pending ? (
        <>
          <Icon name="cart" />
          {`${TXT_ORDER} · ${piecesLabel(lines.length)} · ${totalLabel}`}
        </>
      ) : preordered ? (
        TXT_ALL_PREORDERED
      ) : (
        TXT_ALL_OWNED
      )}
    </button>
  );
}
