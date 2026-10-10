import { describe, expect, it } from 'vitest';

import {
  REFUND_APPROVAL_THRESHOLD_EUR,
  buildRefundCommand,
  previewRefund,
} from '@/features/admin-os/commerce/refunds';

describe('refund workflow', () => {
  it('preview calcule le restant et refuse le dépassement', () => {
    const p = previewRefund({ total_eur: 240 }, 40, 100);
    expect(p.remaining_eur).toBe(100);
    expect(p.requires_tier4_approval).toBe(false);
    expect(() => previewRefund({ total_eur: 240 }, 40, 201)).toThrow('refund_exceeds_remaining');
  });

  it('montant ≥ seuil → commande Tier4 avec approbation', () => {
    expect(REFUND_APPROVAL_THRESHOLD_EUR).toBe(1000);
    const fp = buildRefundCommand('order-1', 1200, 'gros remboursement, ticket #1');
    expect(fp.command_key).toBe('commerce.refund.approve');
    expect(fp.risk_tier).toBe(4);
  });

  it('montant < seuil → commande Tier3 simple', () => {
    const fp = buildRefundCommand('order-1', 240, 'client débité deux fois, ticket #2');
    expect(fp.command_key).toBe('commerce.refund.request');
    expect(fp.risk_tier).toBe(3);
  });

  it('seuil sur exposition cumulée (anti-smurfing 3×800 €)', () => {
    const fp = buildRefundCommand('order-1', 800, 'troisième tranche, ticket #3', 1600);
    expect(fp.command_key).toBe('commerce.refund.approve');
    expect(fp.risk_tier).toBe(4);
  });
});
