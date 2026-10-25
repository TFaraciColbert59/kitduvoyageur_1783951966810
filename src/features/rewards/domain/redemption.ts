/**
 * Échange de points (pur) : codes serveur → messages, état du bouton.
 *
 * Le débit n'a lieu qu'au retour serveur « reserved » ; l'appui initial ne
 * débite rien. Une même tentative garde sa clé d'idempotence entre les
 * nouvelles tentatives (réseau coupé, double appui) : le serveur rend alors la
 * même réservation au lieu d'en créer une seconde.
 */

export type RedeemErrorCode =
  | 'insufficient_balance'
  | 'reward_unavailable'
  | 'reward_unfunded'
  | 'out_of_stock'
  | 'payment_required'
  | 'idempotency_conflict'
  | 'invalid_input'
  | 'user_not_found'
  | 'rate_limited'
  | 'offline'
  | 'unauthenticated'
  | 'service_indisponible'
  | 'internal_error';

export const REDEEM_ERROR_MESSAGE: Record<RedeemErrorCode, string> = {
  insufficient_balance: 'Vos points ne suffisent pas encore. Aucun point n’a été débité.',
  reward_unavailable: 'Cet objet n’est plus proposé. Aucun point n’a été débité.',
  reward_unfunded: 'Cet objet n’est pas encore réclamable. Aucun point n’a été débité.',
  out_of_stock: 'Temporairement indisponible. Aucun point n’a été débité.',
  payment_required: 'Cet avantage demande un complément payé : il passe par la boutique.',
  idempotency_conflict: 'Cette demande a déjà servi pour un autre objet. Réessayez.',
  invalid_input: 'Demande invalide. Réessayez.',
  user_not_found: 'Compte introuvable. Reconnectez-vous.',
  rate_limited: 'Trop de demandes rapprochées. Patientez une minute.',
  offline: 'Hors ligne : l’échange attend le retour du réseau. Aucun point n’a été débité.',
  unauthenticated: 'Connectez-vous pour utiliser vos points.',
  service_indisponible: 'Service momentanément indisponible. Aucun point n’a été débité.',
  internal_error: 'L’échange n’a pas abouti. Vérifiez l’historique avant de réessayer.',
};

const KNOWN = new Set<string>(Object.keys(REDEEM_ERROR_MESSAGE));

export function toRedeemError(code: unknown): RedeemErrorCode {
  return typeof code === 'string' && KNOWN.has(code) ? (code as RedeemErrorCode) : 'internal_error';
}

/**
 * Une erreur réseau ou serveur inconnue peut cacher une réservation réussie :
 * la même clé doit être réutilisée. Un refus métier explicite clôt la
 * tentative (nouvelle clé au prochain essai).
 */
export function shouldKeepIdempotencyKey(code: RedeemErrorCode): boolean {
  return code === 'internal_error' || code === 'service_indisponible' || code === 'offline' || code === 'rate_limited';
}

export function newIdempotencyKey(random: () => string = defaultRandom): string {
  return `rdm_${random()}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function defaultRandom(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export type RedeemFlow =
  | { step: 'idle' }
  | { step: 'confirming'; rewardId: string; key: string }
  | { step: 'submitting'; rewardId: string; key: string }
  | { step: 'reserved'; rewardId: string; reference: string | null; balance: number }
  | { step: 'failed'; rewardId: string; key: string | null; code: RedeemErrorCode };

export type RedeemEvent =
  | { type: 'open'; rewardId: string }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'success'; reference: string | null; balance: number }
  | { type: 'failure'; code: RedeemErrorCode }
  | { type: 'retry' };

/** Machine d'état du parcours d'échange : un seul envoi à la fois. */
export function redeemReducer(flow: RedeemFlow, event: RedeemEvent, makeKey: () => string = newIdempotencyKey): RedeemFlow {
  switch (event.type) {
    case 'open':
      if (flow.step === 'submitting') return flow;
      return { step: 'confirming', rewardId: event.rewardId, key: makeKey() };
    case 'confirm':
      if (flow.step !== 'confirming') return flow;
      return { step: 'submitting', rewardId: flow.rewardId, key: flow.key };
    case 'cancel':
      if (flow.step === 'submitting') return flow;
      return { step: 'idle' };
    case 'success':
      if (flow.step !== 'submitting') return flow;
      return { step: 'reserved', rewardId: flow.rewardId, reference: event.reference, balance: event.balance };
    case 'failure':
      if (flow.step !== 'submitting') return flow;
      return {
        step: 'failed',
        rewardId: flow.rewardId,
        key: shouldKeepIdempotencyKey(event.code) ? flow.key : null,
        code: event.code,
      };
    case 'retry':
      if (flow.step !== 'failed') return flow;
      return { step: 'confirming', rewardId: flow.rewardId, key: flow.key ?? makeKey() };
    default:
      return flow;
  }
}
