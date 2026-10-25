import { describe, it, expect } from 'vitest';
import {
  canBeGoal,
  dedupeCatalog,
  goalProgress,
  redeemability,
  type CatalogItem,
} from '@/features/rewards/domain/catalog';
import {
  earnAnnouncement,
  formatPoints,
  formatSignedPoints,
  hasLegacyRights,
  historyKind,
  parseWallet,
  walletView,
} from '@/features/rewards/domain/wallet';

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'id-1',
    title: 'Gourde',
    description: '',
    pointsCost: 500,
    category: 'produit',
    value: '15 €',
    image: null,
    alt: 'Gourde',
    available: true,
    expiresAt: null,
    fulfillment: 'physical',
    terms: null,
    termsVersion: null,
    partnerDisclosure: null,
    cashComplementCents: 0,
    fundingStatus: 'funded',
    stockRemaining: 3,
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

/** Snapshot tel que renvoyé par `rewards_wallet_snapshot` (banc SQL). */
const SNAPSHOT = {
  success: true,
  generated_at: '2026-10-25T16:00:00Z',
  balance: 1150,
  program: { version: 'pilote-c-2026-10', emission_open: false, closure_reason: 'x', weekly_cap: 250, rules: [] },
  week: { start: '2026-10-19', used: 175 },
  pending_points: 25,
  goal: { reward_id: 'id-1', chosen_at: '2026-10-25T10:00:00Z' },
  catalog: [
    {
      id: 'id-1', title: 'Gourde', description: '', points_cost: 500, category: 'produit', value: '15 €', image: null, alt: '',
      available: true, expires_at: null, fulfillment: null, terms: null, terms_version: null, partner_disclosure: null,
      cash_complement_cents: 0, funding_status: 'unfunded', stock_remaining: null, created_at: '2026-07-01T00:00:00Z',
    },
  ],
  history: [
    { id: 'h1', action: 'Sortie validée', points: 50, type: 'award', created_at: '2026-10-25T09:00:00Z', source_kind: 'award' },
  ],
  awards: [
    { id: 'a1', rule_key: 'useful_story', points: 25, status: 'pending', reason: null, created_at: '2026-10-25T09:00:00Z', decided_at: null, reversal_shortfall: 0 },
  ],
  redemptions: [],
  legacy: { economic_points: 0, economic_pending_points: 0, available_cash: '0.00', pending_cash: 0, store_credit_cents: '0' },
};

describe('catalogue', () => {
  it('ordre des refus identique à rewards_redeem', () => {
    expect(redeemability(item(), 600)).toBe('redeemable');
    expect(redeemability(item(), 100)).toBe('insufficient');
    expect(redeemability(item(), null)).toBe('insufficient');
    expect(redeemability(item({ fundingStatus: 'unfunded', stockRemaining: null }), 9999)).toBe('unfunded');
    expect(redeemability(item({ stockRemaining: 0 }), 9999)).toBe('out_of_stock');
    expect(redeemability(item({ cashComplementCents: 500 }), 9999)).toBe('payment_required');
    expect(redeemability(item({ available: false }), 9999)).toBe('unavailable');
    expect(redeemability(item({ expiresAt: '2020-01-01T00:00:00Z' }), 9999)).toBe('expired');
  });

  it('un objet non financé peut être un objectif, pas un objet retiré ou expiré', () => {
    expect(canBeGoal(item({ fundingStatus: 'unfunded' }))).toBe(true);
    expect(canBeGoal(item({ available: false }))).toBe(false);
    expect(canBeGoal(item({ expiresAt: '2020-01-01T00:00:00Z' }))).toBe(false);
  });

  it('doublons exacts du catalogue historique affichés une fois, objectif conservé', () => {
    const rows = [
      item({ id: 'a', title: 'Livraison express offerte', pointsCost: 150, value: 'Gratuit', createdAt: '2026-08-02' }),
      item({ id: 'b', title: 'Livraison express offerte', pointsCost: 150, value: 'Gratuit', createdAt: '2026-08-01' }),
      item({ id: 'c', title: 'Livraison express offerte', pointsCost: 150, value: 'Gratuit', createdAt: '2026-08-03' }),
      item({ id: 'd', title: 'Nuit en refuge', pointsCost: 2600, value: '90 €' }),
    ];
    expect(dedupeCatalog(rows).map((r) => r.id)).toEqual(['b', 'd']);
    expect(dedupeCatalog(rows, 'c').map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('progression vers l’objectif bornée, sans fausse avance', () => {
    expect(goalProgress(2450, { pointsCost: 15000 })).toMatchObject({ ratio: 2450 / 15000, reached: false, missing: 12550 });
    expect(goalProgress(20000, { pointsCost: 15000 })).toMatchObject({ ratio: 1, reached: true, missing: 0 });
    expect(goalProgress(-10, { pointsCost: 100 })).toMatchObject({ ratio: 0, acquired: 0 });
  });
});

describe('portefeuille', () => {
  it('lit le snapshot serveur : attente séparée du solde, montants legacy typés', () => {
    const wallet = parseWallet(SNAPSHOT);
    expect(wallet).not.toBeNull();
    expect(wallet!.balance).toBe(1150);
    expect(wallet!.pendingPoints).toBe(25);
    expect(wallet!.goalRewardId).toBe('id-1');
    expect(wallet!.program.emissionOpen).toBe(false);
    expect(wallet!.catalog[0].fundingStatus).toBe('unfunded');
    expect(wallet!.legacy.availableCashEur).toBe(0);
    expect(hasLegacyRights(wallet!.legacy)).toBe(false);
  });

  it('snapshot illisible → null (jamais un solde inventé)', () => {
    expect(parseWallet({ success: true })).toBeNull();
    expect(parseWallet({ ...SNAPSHOT, balance: '1150' })).toBeNull();
    expect(parseWallet(null)).toBeNull();
  });

  it('droits legacy visibles dès qu’un montant ou une demande de retrait existe', () => {
    const none = {
      economicPoints: 0, economicPendingPoints: 0, availableCashEur: 0, pendingCashEur: 0, storeCreditCents: 0,
      cashoutActive: true, cashoutMinThresholdEur: 20, withdrawals: [],
    };
    expect(hasLegacyRights(none)).toBe(false);
    expect(hasLegacyRights({ ...none, availableCashEur: 12.5 })).toBe(true);
    expect(hasLegacyRights({ ...none, economicPoints: 2468 })).toBe(true);
    expect(hasLegacyRights({
      ...none,
      withdrawals: [{ id: 'w', amountEur: 25, status: 'pending', provider: 'bank_transfer', requestedAt: '2026-10-01T00:00:00Z', rejectionReason: null }],
    })).toBe(true);
  });

  it('seuil de retrait absent → null, jamais un seuil inventé', () => {
    const wallet = parseWallet({ ...SNAPSHOT, legacy: { ...SNAPSHOT.legacy, cashout_min_threshold: null } });
    expect(wallet!.legacy.cashoutMinThresholdEur).toBeNull();
    expect(wallet!.legacy.cashoutActive).toBe(false);
    const withThreshold = parseWallet({ ...SNAPSHOT, legacy: { ...SNAPSHOT.legacy, cashout_active: true, cashout_min_threshold: '20' } });
    expect(withThreshold!.legacy.cashoutMinThresholdEur).toBe(20);
  });

  it('états : chargement ≠ 0, indisponible, hors ligne daté, non connecté', () => {
    const wallet = parseWallet(SNAPSHOT)!;
    const base = { authenticated: true, online: true, loading: false, error: false, wallet: null, cached: null };
    expect(walletView({ ...base, loading: true })).toEqual({ state: 'loading' });
    expect(walletView({ ...base, authenticated: null })).toEqual({ state: 'loading' });
    expect(walletView({ ...base, error: true })).toEqual({ state: 'unavailable' });
    expect(walletView({ ...base, authenticated: false })).toEqual({ state: 'unauthenticated' });
    expect(walletView({ ...base, wallet })).toEqual({ state: 'ready', wallet });
    expect(walletView({ ...base, online: false, cached: { wallet, savedAt: '2026-10-24T08:00:00Z' } })).toEqual({
      state: 'offline', wallet, savedAt: '2026-10-24T08:00:00Z',
    });
    expect(walletView({ ...base, online: false })).toEqual({ state: 'offline_empty' });
  });

  it('format français : entiers, milliers séparés, signe typographique', () => {
    expect(formatPoints(15000)).toMatch(/^15\s000$/u);
    expect(formatPoints(2450.9)).toMatch(/^2\s450$/u);
    expect(formatSignedPoints(50)).toBe('+50');
    expect(formatSignedPoints(-50)).toBe('−50');
  });

  it('types du journal → catégories lisibles', () => {
    expect(historyKind('award', 50)).toBe('gain');
    expect(historyKind('reward_redemption', -400)).toBe('echange');
    expect(historyKind('redeem_refund', 400)).toBe('remboursement');
    expect(historyKind('award_reversal', -50)).toBe('correction');
    expect(historyKind('cart_refund', -100)).toBe('remboursement');
    expect(historyKind('inconnu', -3)).toBe('depense');
  });

  it('annonce près de l’action : seulement sur confirmation ou attente serveur', () => {
    expect(earnAnnouncement({ status: 'confirmed', points: 50 })).toBe('+50 points validés');
    expect(earnAnnouncement({ status: 'pending', points: 25 })).toBe('25 points en vérification');
    expect(earnAnnouncement({ status: 'refused', points: 0 })).toBeNull();
    expect(earnAnnouncement({ status: 'duplicate', points: 50 })).toBeNull();
    expect(earnAnnouncement({ error: 'emission_closed' })).toBeNull();
    expect(earnAnnouncement(null)).toBeNull();
  });
});
