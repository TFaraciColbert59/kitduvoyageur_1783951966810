/**
 * Catalogue de récompenses (pur).
 *
 * Un objet n'est réclamable que s'il est disponible, non expiré, financé
 * (coût, financeur, budget et stock déclarés côté serveur), en stock, sans
 * reste à payer, et que le solde suffit. Le prix en points seul ne promet
 * rien : sans financement démontré, l'objet reste visible mais « non
 * réclamable pour l'instant ».
 */

export type FundingStatus = 'unfunded' | 'funded' | 'suspended';
export type Fulfillment = 'physical' | 'voucher' | 'service' | 'digital';

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: string;
  value: string;
  image: string | null;
  alt: string;
  available: boolean;
  expiresAt: string | null;
  fulfillment: Fulfillment | null;
  terms: string | null;
  termsVersion: string | null;
  partnerDisclosure: string | null;
  cashComplementCents: number;
  fundingStatus: FundingStatus;
  /** Connu seulement pour un objet financé. */
  stockRemaining: number | null;
  createdAt: string | null;
}

export type Redeemability =
  | 'redeemable'
  | 'insufficient'
  | 'unfunded'
  | 'out_of_stock'
  | 'payment_required'
  | 'expired'
  | 'unavailable';

export function isExpired(item: Pick<CatalogItem, 'expiresAt'>, now: Date = new Date()): boolean {
  if (!item.expiresAt) return false;
  const at = Date.parse(item.expiresAt);
  return Number.isFinite(at) && at <= now.getTime();
}

/** Ordre des refus identique à `rewards_redeem` côté base. */
export function redeemability(item: CatalogItem, balance: number | null, now: Date = new Date()): Redeemability {
  if (!item.available) return 'unavailable';
  if (isExpired(item, now)) return 'expired';
  if (item.fundingStatus !== 'funded') return 'unfunded';
  if (item.stockRemaining === null || item.stockRemaining <= 0) return 'out_of_stock';
  if (item.cashComplementCents > 0) return 'payment_required';
  if (balance === null || balance < item.pointsCost) return 'insufficient';
  return 'redeemable';
}

/** Un objectif peut viser un objet visible même non financé, jamais un objet retiré ou expiré. */
export function canBeGoal(item: CatalogItem, now: Date = new Date()): boolean {
  return item.available && !isExpired(item, now);
}

export const REDEEMABILITY_LABEL: Record<Redeemability, string> = {
  redeemable: 'Disponible',
  insufficient: 'Points insuffisants',
  unfunded: 'Pas encore réclamable',
  out_of_stock: 'Temporairement indisponible',
  payment_required: 'Reste à payer : en boutique',
  expired: 'Offre terminée',
  unavailable: 'Retiré du catalogue',
};

export const REDEEMABILITY_HINT: Record<Redeemability, string> = {
  redeemable: 'Vos points suffisent et l’objet est en stock.',
  insufficient: 'Continuez : vos points restent acquis.',
  unfunded: 'Son financement et son stock ne sont pas encore confirmés. Vous pouvez le choisir comme objectif ; aucun point n’est dépensé.',
  out_of_stock: 'Aucun débit. Choisissez un autre objectif ou revenez plus tard.',
  payment_required: 'Cet avantage demande un complément payé : il passe par la boutique.',
  expired: 'Cette offre n’est plus proposée.',
  unavailable: 'Cet objet ne fait plus partie du catalogue.',
};

/**
 * Le catalogue historique contient des doublons exacts (mêmes titre, coût et
 * valeur, ré-amorçages successifs). On n'en affiche qu'un : le premier créé,
 * ou celui déjà choisi comme objectif. Aucune ligne n'est supprimée en base.
 */
export function dedupeCatalog(items: CatalogItem[], keepId?: string | null): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();
  for (const item of items) {
    const key = `${item.title.trim().toLowerCase()}|${item.pointsCost}|${item.value.trim().toLowerCase()}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, item);
      continue;
    }
    if (keepId && item.id === keepId) {
      byKey.set(key, item);
      continue;
    }
    if (keepId && current.id === keepId) continue;
    // Préférer une ligne financée, puis la plus ancienne.
    if (current.fundingStatus !== 'funded' && item.fundingStatus === 'funded') {
      byKey.set(key, item);
      continue;
    }
    if (current.fundingStatus === item.fundingStatus && (item.createdAt ?? '') < (current.createdAt ?? '')) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort((a, b) => a.pointsCost - b.pointsCost || a.title.localeCompare(b.title, 'fr'));
}

export interface GoalProgress {
  acquired: number;
  required: number;
  /** 0..1, jamais au-delà ; aucune progression inventée sans solde connu. */
  ratio: number;
  reached: boolean;
  missing: number;
}

export function goalProgress(balance: number, item: Pick<CatalogItem, 'pointsCost'>): GoalProgress {
  const required = Math.max(0, item.pointsCost);
  const acquired = Math.max(0, balance);
  const ratio = required === 0 ? 1 : Math.min(1, acquired / required);
  return { acquired, required, ratio, reached: acquired >= required, missing: Math.max(0, required - acquired) };
}

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  physical: 'Objet livré',
  voucher: 'Bon de réduction',
  service: 'Prestation',
  digital: 'Avantage numérique',
};
