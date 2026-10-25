/** T39 — valorisation des bons : bornes serveur, débit partiel, restitution. */
import { describe, it, expect } from 'vitest';
import { quoteVoucher, restoreVoucher } from '@/features/progression/domain/voucherValue';

describe('citation d’un bon (serveur)', () => {
  it('réduction = min(bon, 10 % panier, 25 % marge), reste conservé', () => {
    const result = quoteVoucher({
      voucherValueCents: 5000,
      eligibleCartCents: 9990,
      contributionMarginCents: 4000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.appliedDiscountCents).toBe(999); // 10 % du panier
      expect(result.quote.remainingVoucherCents).toBe(4001);
    }
  });

  it('marge faible borne la réduction', () => {
    const result = quoteVoucher({
      voucherValueCents: 5000,
      eligibleCartCents: 100000,
      contributionMarginCents: 1000,
    });
    expect(result.ok && result.quote.appliedDiscountCents).toBe(250); // 25 % marge
  });

  it('marge inconnue ou négative → aucun nouveau bon sur ce panier', () => {
    expect(
      quoteVoucher({ voucherValueCents: 5000, eligibleCartCents: 1000, contributionMarginCents: null })
    ).toEqual({ ok: false, reason: 'marge_inconnue' });
    expect(
      quoteVoucher({ voucherValueCents: 5000, eligibleCartCents: 1000, contributionMarginCents: -10 })
    ).toEqual({ ok: false, reason: 'marge_negative' });
  });

  it('paiement raté → restaurantion totale ; bonus consommé → seul le reste', () => {
    expect(
      restoreVoucher({ initialVoucherCents: 5000, appliedDiscountCents: 999, discountConsumed: false })
    ).toBe(5000);
    expect(
      restoreVoucher({ initialVoucherCents: 5000, appliedDiscountCents: 999, discountConsumed: true })
    ).toBe(4001);
  });
});
