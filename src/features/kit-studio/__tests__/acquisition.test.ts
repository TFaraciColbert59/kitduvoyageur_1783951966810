import { describe, expect, it } from 'vitest';
import { createInitialKitConfiguration } from '../state/kitConfiguration';
import {
  buildRealTransactionAction,
  createPlannedReservation,
  createTransientPreview,
  formatMemberLoan,
  reconcileCheckoutOutcome,
  type AcquisitionCatalogItem,
  type MemberLoanRecord,
} from '../drawers/acquisition/acquisitionEngine';

const SAMPLE_PRODUCT: AcquisitionCatalogItem = {
  id: 'prod-stove-1',
  slug: 'rechaud-titane-85g',
  name: 'Réchaud Titane Ultraléger',
  category: 'Cuisine',
  weightG: 85,
  priceCents: 5400,
  inStock: true,
  stockCount: 4,
  stripePriceId: 'price_real_stripe_123',
};

describe('Acquisition Engine — F-01 à F-06', () => {
  it('F-01 : sépare strictement Aperçu (zéro mutation), Transaction (route Stripe/Boutique) et Réservation (« prévu »)', () => {
    const initial = createInitialKitConfiguration('kit-111');

    // 1. Aperçu
    const { preview, nextConfig } = createTransientPreview(SAMPLE_PRODUCT, initial);
    expect(preview.kind).toBe('preview');
    expect(preview.mutatedKit).toBe(false);
    expect(nextConfig).toBe(initial);
    expect(nextConfig.items).toHaveLength(0);

    // 2. Transaction
    const tx = buildRealTransactionAction(SAMPLE_PRODUCT, initial.kitId);
    expect(tx.kind).toBe('transaction');
    expect(tx.allowed).toBe(true);
    if (tx.allowed) {
      expect(tx.endpoint).toBe('/api/checkout');
      expect(tx.shopHref).toContain('/boutique/rechaud-titane-85g');
    }

    // 3. Réservation
    const planned = createPlannedReservation(SAMPLE_PRODUCT, 'front-pocket');
    expect(planned.kind).toBe('reservation');
    expect(planned.status).toBe('prévu');
    expect(planned.isOwned).toBe(false);
  });

  it('F-02 & F-03 : aucun paiement fictif et un paiement en échec ou annulé crée 0 ligne', () => {
    const initial = createInitialKitConfiguration('kit-111');

    const failed = reconcileCheckoutOutcome(initial, {
      status: 'failed',
      error: 'card_declined',
    });
    expect(failed.itemsCreatedCount).toBe(0);
    expect(failed.itemToInsert).toBeNull();
    expect(failed.configBeforeInsert.items).toHaveLength(0);

    const cancelled = reconcileCheckoutOutcome(initial, {
      status: 'cancelled',
    });
    expect(cancelled.itemsCreatedCount).toBe(0);
    expect(cancelled.itemToInsert).toBeNull();

    const succeeded = reconcileCheckoutOutcome(initial, {
      status: 'succeeded',
      confirmedOwnershipId: 'own-uuid-999',
      item: SAMPLE_PRODUCT,
    });
    expect(succeeded.itemsCreatedCount).toBe(1);
    expect(succeeded.itemToInsert?.productOwnershipId).toBe('own-uuid-999');
  });

  it('F-04 : une réservation ne vaut jamais possession (productOwnershipId === null, isChecked === false, marqué « prévu »)', () => {
    const unknownWeightProduct: AcquisitionCatalogItem = {
      ...SAMPLE_PRODUCT,
      weightG: null,
    };
    const planned = createPlannedReservation(unknownWeightProduct);
    expect(planned.isOwned).toBe(false);
    expect(planned.item.productOwnershipId).toBeNull();
    expect(planned.item.isChecked).toBe(false);
    expect(planned.item.name).toContain('(prévu)');
    // Poids inconnu préservé à null, jamais forcé à 0
    expect(planned.item.weightG).toBeNull();
    expect(planned.item.weightSource).toBe('unknown');
  });

  it('F-05 : un produit en rupture de stock est bloqué avec sa raison explicite', () => {
    const outOfStockItem: AcquisitionCatalogItem = {
      ...SAMPLE_PRODUCT,
      inStock: false,
      stockCount: 0,
    };
    const tx = buildRealTransactionAction(outOfStockItem, 'kit-111');
    expect(tx.allowed).toBe(false);
    if (!tx.allowed) {
      expect(tx.disabledReason).toBe('Indisponible — rupture de stock');
    }
  });

  it('F-06 : un prêt entre membres expose propriétaire, durée, restitution et permissions', () => {
    const loan: MemberLoanRecord = {
      id: 'loan-1',
      itemName: 'Tente 2P Alpinisme',
      category: 'Abri',
      weightG: 1420,
      ownerId: 'user-camille',
      ownerName: 'Camille',
      borrowerId: 'user-tony',
      startDate: '2026-08-10',
      dueDate: '2026-08-17',
      status: 'active',
      canPackInKit: true,
      canSublend: false,
    };

    const view = formatMemberLoan(loan);
    expect(view.ownerName).toBe('Camille');
    expect(view.durationDays).toBe(7);
    expect(view.dueDateIso).toBe('2026-08-17');
    expect(view.permissionsLabel).toContain('Usage sortie autorisé');
    expect(view.permissionsLabel).toContain('Non cessible à un tiers');
    expect(view.canAddAsLoanedToKit).toBe(true);
  });
});
