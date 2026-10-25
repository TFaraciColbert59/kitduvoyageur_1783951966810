// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardsHistory, RewardsOverview, type RewardsController } from '../RewardsPanel';
import { parseWallet, type Wallet, type WalletView } from '@/features/rewards/domain/wallet';

afterEach(cleanup);

const BASE_ITEM = {
  description: '', category: 'produit', image: null, alt: '', available: true, expires_at: null, fulfillment: 'physical',
  terms: 'Livraison France métropolitaine sous 15 jours.', terms_version: '2026-10', partner_disclosure: null,
  cash_complement_cents: 0, created_at: '2026-07-01T00:00:00Z',
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    generated_at: '2026-10-25T16:00:00Z',
    balance: 600,
    program: { version: 'pilote-c-2026-10', emission_open: false, closure_reason: 'x', weekly_cap: 250, rules: [] },
    week: { start: '2026-10-19', used: 0 },
    pending_points: 0,
    goal: null,
    catalog: [
      { ...BASE_ITEM, id: 'r-funded', title: 'Gourde financée', points_cost: 400, value: '15 €', funding_status: 'funded', stock_remaining: 2 },
      { ...BASE_ITEM, id: 'r-unfunded', title: 'Lampe frontale', points_cost: 1500, value: '45 €', funding_status: 'unfunded', stock_remaining: null },
      { ...BASE_ITEM, id: 'r-out', title: 'Sac 15 L', points_cost: 300, value: '55 €', funding_status: 'funded', stock_remaining: 0 },
    ],
    history: [
      { id: 'h1', action: 'Solde d’ouverture', points: 600, type: 'opening_balance', created_at: '2026-10-10T10:00:00Z', source_kind: 'opening' },
    ],
    awards: [],
    redemptions: [],
    legacy: { economic_points: 0, economic_pending_points: 0, available_cash: 0, pending_cash: 0, store_credit_cents: 0 },
    ...overrides,
  };
}

function controllerFor(view: WalletView, overrides: Partial<RewardsController> = {}): RewardsController {
  return {
    view,
    isOnline: view.state !== 'offline' && view.state !== 'offline_empty',
    isFetching: false,
    refetch: vi.fn(),
    setGoal: vi.fn().mockResolvedValue(undefined),
    goalPending: false,
    goalError: null,
    redeem: vi.fn(),
    ...overrides,
  };
}

function ready(overrides: Record<string, unknown> = {}): WalletView {
  return { state: 'ready', wallet: parseWallet(snapshot(overrides)) as Wallet };
}

describe('RewardsOverview — états', () => {
  it('chargement : aucun chiffre, pas de 0 transitoire', () => {
    const { container } = render(<RewardsOverview controller={controllerFor({ state: 'loading' })} />);
    expect(screen.getByText('Chargement du solde…')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b0 point/);
  });

  it('indisponible : message distinct de zéro + Réessayer', () => {
    const refetch = vi.fn();
    render(<RewardsOverview controller={controllerFor({ state: 'unavailable' }, { refetch })} />);
    expect(screen.getByRole('alert').textContent).toContain('Solde indisponible');
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('hors ligne : dernier solde daté, aucun bouton d’échange', () => {
    const wallet = parseWallet(snapshot()) as Wallet;
    render(<RewardsOverview controller={controllerFor({ state: 'offline', wallet, savedAt: '2026-10-24T08:00:00Z' })} />);
    expect(screen.getByText(/Dernier solde connu/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Utiliser/ })).toBeNull();
    expect(screen.getByText(/les échanges et le choix d’objectif reprendront/)).toBeTruthy();
  });

  it('prêt : solde fort, attente séparée et non additionnée', () => {
    render(<RewardsOverview controller={controllerFor(ready({ balance: 2450, pending_points: 50 }))} />);
    expect(screen.getByText(/^2\s450$/u)).toBeTruthy();
    expect(screen.getByText(/50 points en vérification · non utilisables/)).toBeTruthy();
    expect(screen.queryByText(/2\s500/u)).toBeNull();
  });

  it('programme fermé : aucun montant de gain annoncé', () => {
    render(<RewardsOverview controller={controllerFor(ready())} />);
    expect(screen.getByText(/Les nouveaux gains ne sont pas encore ouverts/)).toBeTruthy();
    expect(screen.queryByText(/\+50/)).toBeNull();
  });

  it('programme ouvert : règles ouvertes et plafond atteint expliqué', () => {
    render(
      <RewardsOverview
        controller={controllerFor(ready({
          program: {
            version: 'test', emission_open: true, weekly_cap: 250,
            rules: [{ key: 'activity_validated', label: 'Sortie validée', points: 50, weekly_limit: 3, producer_open: true, requires_review: false }],
          },
          week: { start: '2026-10-19', used: 250 },
        }))}
      />
    );
    expect(screen.getByText('Sortie validée')).toBeTruthy();
    expect(screen.getByText(/Plafond de cette période atteint/)).toBeTruthy();
  });

  it('catalogue : réclamable, non financé et rupture distingués', () => {
    render(<RewardsOverview controller={controllerFor(ready())} />);
    const items = screen.getAllByRole('listitem');
    const funded = items.find((li) => li.textContent?.includes('Gourde financée'))!;
    const unfunded = items.find((li) => li.textContent?.includes('Lampe frontale'))!;
    const out = items.find((li) => li.textContent?.includes('Sac 15 L'))!;
    expect(within(funded).getByRole('button', { name: /Utiliser 400 points/ })).toBeTruthy();
    expect(within(unfunded).getByText('Pas encore réclamable')).toBeTruthy();
    expect(within(unfunded).queryByRole('button', { name: /Utiliser/ })).toBeNull();
    expect(within(out).getByText('Temporairement indisponible')).toBeTruthy();
    expect(within(out).queryByRole('button', { name: /Utiliser/ })).toBeNull();
  });

  it('objectif : choisir ne dépense rien, annonce unique', async () => {
    const setGoal = vi.fn().mockResolvedValue(undefined);
    render(<RewardsOverview controller={controllerFor(ready(), { setGoal })} />);
    const unfunded = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('Lampe frontale'))!;
    await act(async () => {
      fireEvent.click(within(unfunded).getByRole('button', { name: /Choisir comme objectif/ }));
    });
    expect(setGoal).toHaveBeenCalledWith('r-unfunded');
  });

  it('objectif affiché avec progression réelle et bouton bloqué tant que non financé', () => {
    render(<RewardsOverview controller={controllerFor(ready({ goal: { reward_id: 'r-unfunded', chosen_at: '2026-10-25T00:00:00Z' } }))} />);
    expect(screen.getByText('Objectif : Lampe frontale')).toBeTruthy();
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('600');
    expect(bar.getAttribute('aria-valuemax')).toBe('1500');
  });

  it('échange : confirmation, double appui ignoré, réservation annoncée', async () => {
    let resolve: (value: unknown) => void = () => {};
    const redeem = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<RewardsOverview controller={controllerFor(ready(), { redeem: redeem as RewardsController['redeem'] })} />);
    fireEvent.click(screen.getByRole('button', { name: /Utiliser 400 points/ }));
    const confirm = screen.getByRole('button', { name: /Confirmer l’échange/ });
    expect(screen.getByText(/Solde après réservation : 200 points/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(redeem).toHaveBeenCalledTimes(1);
    const firstKey = (redeem.mock.calls[0] as unknown[])[1] as string;
    expect(firstKey).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    await act(async () => {
      resolve({ ok: true, data: { status: 'reserved', reference: 'R-ABCDEF1234', balance: 200, idempotent: false } });
    });
    expect(screen.getByText(/Récompense réservée · référence R-ABCDEF1234/)).toBeTruthy();
  });

  it('échange en échec réseau : même clé réutilisée au nouvel essai', async () => {
    const redeem = vi.fn().mockResolvedValueOnce({ ok: false, code: 'internal_error' }).mockResolvedValueOnce({ ok: false, code: 'out_of_stock' });
    render(<RewardsOverview controller={controllerFor(ready(), { redeem })} />);
    fireEvent.click(screen.getByRole('button', { name: /Utiliser 400 points/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmer l’échange/ }));
    });
    expect(screen.getByRole('alert').textContent).toContain('n’a pas abouti');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmer l’échange/ }));
    });
    expect(redeem.mock.calls[1][1]).toBe(redeem.mock.calls[0][1]);
    expect(screen.getByRole('alert').textContent).toContain('Aucun point n’a été débité');
  });
});

describe('RewardsHistory', () => {
  it('attente, échanges, mouvements et corrections séparés', () => {
    const view = ready({
      awards: [
        { id: 'a1', rule_key: 'useful_story', points: 25, status: 'pending', reason: null, created_at: '2026-10-25T09:00:00Z', decided_at: null, reversal_shortfall: 0 },
        { id: 'a2', rule_key: 'activity_validated', points: 50, status: 'reversed', reason: 'Sortie non plausible', created_at: '2026-10-21T09:00:00Z', decided_at: null, reversal_shortfall: 20 },
      ],
      redemptions: [
        { id: 'd1', reward_id: 'r-funded', reward_title: 'Gourde financée', points_spent: 400, status: 'reserved', reference: 'R-1', created_at: '2026-10-25T10:00:00Z', cancelled_at: null },
      ],
    });
    render(<RewardsHistory controller={controllerFor(view)} />);
    expect(screen.getByText('En vérification')).toBeTruthy();
    expect(screen.getByText(/25 en attente/)).toBeTruthy();
    expect(screen.getByText(/Récompense réservée · R-1/)).toBeTruthy();
    expect(screen.getByText('+600')).toBeTruthy();
    expect(screen.getByText(/20 points déjà dépensés non repris/)).toBeTruthy();
  });

  it('vide : explication, pas d’erreur', () => {
    render(<RewardsHistory controller={controllerFor(ready({ history: [] }))} />);
    expect(screen.getByText('Aucun mouvement')).toBeTruthy();
  });
});
