/**
 * src/features/kit-studio/drawers/acquisition/acquisitionEngine.ts
 * Moteur pur d'acquisition honnête : séparation stricte Aperçu / Transaction / Réservation (Lot L7-4 / F-01..F-06).
 *
 * INVARIANTS STRICTS :
 * - F-01 : Trois chemins strictement distincts (`preview`, `transaction`, `reservation`).
 * - F-02 : Aucun paiement fictif — la transaction délègue exclusivement aux routes Stripe/Boutique existantes (`/boutique`, `/api/checkout`).
 * - F-03 : Un paiement en échec ou annulé ne crée ZÉRO ligne dans le kit (`reconcileCheckoutOutcome`).
 * - F-04 : Une réservation marque l'objet comme « prévu » (`productOwnershipId: null`, `isChecked: false`), jamais possédé.
 * - F-05 : Un article en rupture de stock est bloqué avec sa raison explicite (« Indisponible — rupture de stock »).
 * - F-06 : Les prêts entre membres (`materiel_loans`) exposent propriétaire, durée, date de restitution et permissions.
 */

import type { KitConfiguration, KitItem, SlotId } from '../../state/types';

export interface AcquisitionCatalogItem {
  id: string;
  slug?: string | null;
  name: string;
  category: string | null;
  weightG: number | null; // null = poids inconnu, jamais 0
  priceCents: number | null;
  currency?: string;
  inStock: boolean;
  stockCount?: number | null;
  stripePriceId?: string | null;
}

export interface MemberLoanRecord {
  id: string;
  itemName: string;
  category: string | null;
  weightG: number | null;
  ownerId: string;
  ownerName: string;
  borrowerId: string;
  startDate: string; // ISO YYYY-MM-DD
  dueDate: string;   // ISO YYYY-MM-DD
  returnedAt?: string | null;
  status: 'pending' | 'active' | 'returned';
  canPackInKit: boolean;
  canSublend: boolean;
}

export interface FormattedLoanView {
  id: string;
  itemName: string;
  category: string | null;
  weightG: number | null;
  ownerName: string;
  durationDays: number;
  dueDateIso: string;
  statusLabel: string;
  permissionsLabel: string;
  canAddAsLoanedToKit: boolean;
}

export interface TransientPreviewResult {
  kind: 'preview';
  catalogItemId: string;
  name: string;
  category: string | null;
  weightG: number | null;
  mutatedKit: false;
}

export type TransactionDescriptor =
  | {
      kind: 'transaction';
      allowed: true;
      method: 'POST' | 'REDIRECT';
      endpoint: '/api/checkout' | string;
      shopHref: string;
      payload: {
        productId: string;
        stripePriceId: string | null;
        returnTo: string;
      };
    }
  | {
      kind: 'transaction';
      allowed: false;
      disabledReason: string;
    };

export interface PlannedReservationResult {
  kind: 'reservation';
  status: 'prévu';
  isOwned: false;
  item: Omit<KitItem, 'slotOrder'>;
}

export function isCatalogItemOutOfStock(item: AcquisitionCatalogItem): boolean {
  if (!item.inStock) return true;
  if (typeof item.stockCount === 'number' && item.stockCount <= 0) return true;
  return false;
}

export function getCatalogStockReason(item: AcquisitionCatalogItem): string | null {
  if (isCatalogItemOutOfStock(item)) {
    return 'Indisponible — rupture de stock';
  }
  return null;
}

/**
 * 1. APERÇU (`F-01`) : Essai visuel/poids éphémère sans AUCUNE écriture dans le kit ni en base.
 */
export function createTransientPreview(
  item: AcquisitionCatalogItem,
  currentConfig: KitConfiguration
): { preview: TransientPreviewResult; nextConfig: KitConfiguration } {
  return {
    preview: {
      kind: 'preview',
      catalogItemId: item.id,
      name: item.name,
      category: item.category,
      weightG:
        typeof item.weightG === 'number' && Number.isFinite(item.weightG)
          ? item.weightG
          : null,
      mutatedKit: false,
    },
    // Référence strictement identique : prouve zéro mutation de KitConfiguration
    nextConfig: currentConfig,
  };
}

/**
 * 2. TRANSACTION (`F-01`, `F-02`, `F-05`) : Délégation exclusive aux routes Boutique / Stripe réelles.
 * Refuse tout article en rupture de stock avec raison explicite.
 */
export function buildRealTransactionAction(
  item: AcquisitionCatalogItem,
  kitId: string
): TransactionDescriptor {
  const stockReason = getCatalogStockReason(item);
  if (stockReason) {
    return {
      kind: 'transaction',
      allowed: false,
      disabledReason: stockReason,
    };
  }

  const returnTo = `/hub?studio=1&kit=${encodeURIComponent(kitId)}&drawer=inventaire`;
  const shopHref = item.slug
    ? `/boutique/${encodeURIComponent(item.slug)}?returnTo=${encodeURIComponent(returnTo)}`
    : `/boutique?produit=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(returnTo)}`;

  if (item.stripePriceId) {
    return {
      kind: 'transaction',
      allowed: true,
      method: 'POST',
      endpoint: '/api/checkout',
      shopHref,
      payload: {
        productId: item.id,
        stripePriceId: item.stripePriceId,
        returnTo,
      },
    };
  }

  return {
    kind: 'transaction',
    allowed: true,
    method: 'REDIRECT',
    endpoint: shopHref,
    shopHref,
    payload: {
      productId: item.id,
      stripePriceId: null,
      returnTo,
    },
  };
}

/**
 * F-03 : Réconciliation après retour de paiement Stripe.
 * Un paiement échoué, annulé ou en attente crée ZÉRO ligne dans le kit.
 */
export function reconcileCheckoutOutcome(
  currentConfig: KitConfiguration,
  outcome:
    | { status: 'failed' | 'cancelled' | 'pending'; error?: string }
    | {
        status: 'succeeded';
        confirmedOwnershipId: string;
        item: AcquisitionCatalogItem;
      }
): { itemsCreatedCount: number; itemToInsert: Omit<KitItem, 'slotOrder'> | null; configBeforeInsert: KitConfiguration } {
  if (outcome.status !== 'succeeded' || !outcome.confirmedOwnershipId) {
    return {
      itemsCreatedCount: 0,
      itemToInsert: null,
      configBeforeInsert: currentConfig,
    };
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `owned-${outcome.confirmedOwnershipId}`;

  return {
    itemsCreatedCount: 1,
    itemToInsert: {
      id,
      productOwnershipId: outcome.confirmedOwnershipId,
      name: outcome.item.name,
      category: outcome.item.category,
      quantity: 1,
      weightG:
        typeof outcome.item.weightG === 'number' && Number.isFinite(outcome.item.weightG)
          ? outcome.item.weightG
          : null,
      weightSource:
        typeof outcome.item.weightG === 'number' && Number.isFinite(outcome.item.weightG)
          ? 'catalog'
          : 'unknown',
      isChecked: false,
      slotId: null,
      visual: null,
    },
    configBeforeInsert: currentConfig,
  };
}

/**
 * 3. RÉSERVATION / PLANIFICATION (`F-01`, `F-04`) :
 * Ajoute un équipement comme « prévu » (non possédé : `productOwnershipId: null`, `isChecked: false`).
 */
export function createPlannedReservation(
  item: AcquisitionCatalogItem,
  targetSlotId: SlotId | null = null
): PlannedReservationResult {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `planned-${item.id}-${Date.now()}`;

  const weightG =
    typeof item.weightG === 'number' && Number.isFinite(item.weightG)
      ? item.weightG
      : null;

  return {
    kind: 'reservation',
    status: 'prévu',
    isOwned: false,
    item: {
      id,
      productOwnershipId: null, // F-04 : Réservation !== possession
      name: `${item.name} (prévu)`,
      category: item.category,
      quantity: 1,
      weightG,
      weightSource: weightG !== null ? 'catalog' : 'unknown',
      isChecked: false,
      slotId: targetSlotId,
      visual: null,
    },
  };
}

/**
 * F-06 : Formatage honnête d'un prêt entre membres (`materiel_loans`).
 * Expose propriétaire, durée en jours, date de restitution et permissions.
 */
export function formatMemberLoan(loan: MemberLoanRecord): FormattedLoanView {
  const startMs = Date.parse(loan.startDate);
  const dueMs = Date.parse(loan.dueDate);
  const durationDays =
    Number.isFinite(startMs) && Number.isFinite(dueMs) && dueMs >= startMs
      ? Math.max(1, Math.round((dueMs - startMs) / 86_400_000))
      : 1;

  let statusLabel = 'Prêt actif';
  if (loan.status === 'pending') statusLabel = 'En attente de remise';
  else if (loan.status === 'returned' || loan.returnedAt) statusLabel = 'Restitué';

  const perms: string[] = [];
  perms.push(loan.canPackInKit ? 'Usage sortie autorisé' : 'Consultation seule');
  perms.push(loan.canSublend ? 'Re-prêt autorisé' : 'Non cessible à un tiers');

  return {
    id: loan.id,
    itemName: loan.itemName,
    category: loan.category,
    weightG:
      typeof loan.weightG === 'number' && Number.isFinite(loan.weightG)
        ? loan.weightG
        : null,
    ownerName: loan.ownerName,
    durationDays,
    dueDateIso: loan.dueDate,
    statusLabel,
    permissionsLabel: perms.join(' • '),
    canAddAsLoanedToKit: loan.canPackInKit && loan.status !== 'returned' && !loan.returnedAt,
  };
}
