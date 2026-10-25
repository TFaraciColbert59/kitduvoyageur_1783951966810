'use client';

import React, { useMemo, useState } from 'react';
import { RewardsHistory, RewardsOverview, type RewardsController } from '@/components/rewards/RewardsPanel';
import { LegacyRightsSection } from '@/components/rewards/LegacyRightsSection';
import { parseWallet, type Wallet, type WalletView } from '@/features/rewards/domain/wallet';
import type { RedeemOutcome } from '@/features/rewards/client/useRewardsWallet';

/**
 * Laboratoire des états Récompenses (développement uniquement, 404 en
 * production). DONNÉES FICTIVES : elles servent à vérifier l'affichage de
 * chaque état à 430×932 et en petit écran, jamais à présenter une offre.
 */

const ITEM = {
  description: 'Objet de démonstration.', category: 'produit', image: null, alt: '', available: true, expires_at: null,
  fulfillment: 'physical', terms: 'Conditions de démonstration.', terms_version: 'demo', partner_disclosure: null,
  cash_complement_cents: 0, created_at: '2026-07-01T00:00:00Z',
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    generated_at: '2026-10-25T16:00:00Z',
    balance: 2450,
    program: { version: 'demo', emission_open: false, closure_reason: null, weekly_cap: 250, rules: [] },
    week: { start: '2026-10-19', used: 0 },
    pending_points: 50,
    goal: { reward_id: 'demo-lamp', chosen_at: '2026-10-25T00:00:00Z' },
    catalog: [
      { ...ITEM, id: 'demo-bottle', title: 'Gourde (démo financée)', points_cost: 400, value: 'démo', funding_status: 'funded', stock_remaining: 3 },
      { ...ITEM, id: 'demo-lamp', title: 'Lampe (démo non financée)', points_cost: 15000, value: 'démo', funding_status: 'unfunded', stock_remaining: null },
      { ...ITEM, id: 'demo-bag', title: 'Sac (démo en rupture)', points_cost: 1200, value: 'démo', funding_status: 'funded', stock_remaining: 0 },
    ],
    history: [
      { id: 'h1', action: 'Solde d’ouverture (démo)', points: 2400, type: 'opening_balance', created_at: '2026-10-10T10:00:00Z', source_kind: 'opening' },
      { id: 'h2', action: 'Sortie validée (démo)', points: 50, type: 'award', created_at: '2026-10-24T10:00:00Z', source_kind: 'award' },
    ],
    awards: [
      { id: 'a1', rule_key: 'useful_story', points: 50, status: 'pending', reason: null, created_at: '2026-10-25T09:00:00Z', decided_at: null, reversal_shortfall: 0 },
    ],
    redemptions: [],
    legacy: { economic_points: 0, economic_pending_points: 0, available_cash: 0, pending_cash: 0, store_credit_cents: 0 },
    ...overrides,
  };
}

const STATES = ['prêt', 'chargement', 'indisponible', 'hors ligne', 'programme ouvert', 'droits legacy'] as const;
type LabState = (typeof STATES)[number];

export default function RewardsStatesLab() {
  const [state, setState] = useState<LabState>('prêt');
  const [failNext, setFailNext] = useState(false);

  const wallet = useMemo(() => {
    if (state === 'programme ouvert') {
      return parseWallet(snapshot({
        program: {
          version: 'demo', emission_open: true, weekly_cap: 250,
          rules: [
            { key: 'activity_validated', label: 'Sortie validée', points: 50, weekly_limit: 3, producer_open: true, requires_review: false },
            { key: 'useful_story', label: 'Récit utile', points: 25, weekly_limit: 2, producer_open: true, requires_review: true },
          ],
        },
        week: { start: '2026-10-19', used: 175 },
      })) as Wallet;
    }
    if (state === 'droits legacy') {
      return parseWallet(snapshot({
        legacy: {
          economic_points: 2468, economic_pending_points: 0, available_cash: 32.5, pending_cash: 0, store_credit_cents: 1200,
          cashout_active: true, cashout_min_threshold: 20, withdrawals: [],
        },
      })) as Wallet;
    }
    return parseWallet(snapshot()) as Wallet;
  }, [state]);

  const view: WalletView =
    state === 'chargement' ? { state: 'loading' }
      : state === 'indisponible' ? { state: 'unavailable' }
        : state === 'hors ligne' ? { state: 'offline', wallet, savedAt: '2026-10-24T08:00:00Z' }
          : { state: 'ready', wallet };

  const controller: RewardsController = {
    view,
    isOnline: state !== 'hors ligne',
    isFetching: false,
    refetch: () => undefined,
    setGoal: async () => undefined,
    goalPending: false,
    goalError: null,
    redeem: async (): Promise<RedeemOutcome> => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return failNext
        ? { ok: false, code: 'out_of_stock' }
        : { ok: true, data: { status: 'reserved', reference: 'R-DEMO000001', balance: 2050, idempotent: false } };
    },
  };

  return (
    <div className="lkdv-rw-page" style={{ padding: 16 }}>
      <p role="note" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--rw-ink-2)' }}>
        Laboratoire de développement · données fictives · non servi en production
      </p>
      <div role="group" aria-label="État simulé" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {STATES.map((s) => (
          <button key={s} type="button" className={`lkdv-rw-btn sm${s === state ? ' primary' : ''}`} aria-pressed={s === state} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
        <button type="button" className="lkdv-rw-btn sm" aria-pressed={failNext} onClick={() => setFailNext((v) => !v)}>
          échange en échec : {failNext ? 'oui' : 'non'}
        </button>
      </div>
      <div style={{ maxWidth: 430, margin: '0 auto', display: 'grid', gap: 16 }}>
        <RewardsOverview key={state} controller={controller} />
        <RewardsHistory controller={controller} />
        {state === 'droits legacy' ? <LegacyRightsSection legacy={wallet.legacy} /> : null}
      </div>
    </div>
  );
}
