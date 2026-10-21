// @vitest-environment jsdom

/**
 * Task 8 — slot Prêts (revue).
 *
 * Contrat : trois lentilles (`lend`, `borrow`, `trust`), cartes réelles issues
 * du bootstrap, actions de prêt, **carte de confiance agrégée uniquement**,
 * visiteur sans action, notation avec retry, rappel honnête.
 */

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoansSlot, LOANS_CSS } from '../slots/LoansSlot';
import { LoanCard, isLoanOverdue, type LoanRecord } from '../cards/LoanCard';

const NOW = new Date('2026-10-21T12:00:00Z');

/** Date ISO relative au temps figé : aucun test ne dépend du jour réel. */
function day(offset: number): string {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const TRUST = { verified: true, active: 3, onTimeRate: 92, rating: 4.8 };

const LOANS: LoanRecord[] = [
  {
    id: 'l1',
    itemName: 'Sac 45 L',
    counterpart: 'Léa',
    role: 'lender',
    status: 'en_cours',
    loanedAt: day(-20),
    dueDate: day(4),
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l2',
    itemName: 'Tente 2 places',
    counterpart: 'Marc',
    role: 'lender',
    status: 'en_retard',
    loanedAt: day(-40),
    dueDate: day(-5),
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l3',
    itemName: 'Duvet -5°',
    counterpart: 'Léa',
    role: 'borrower',
    status: 'en_cours',
    loanedAt: day(-16),
    dueDate: day(7),
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l4',
    itemName: 'Réchaud',
    counterpart: 'Nina',
    role: 'borrower',
    status: 'rendu',
    loanedAt: day(-80),
    dueDate: day(-70),
    returnedAt: day(-72),
    rating: 5,
  },
];

describe('LoansSlot — Confiance agrégée, sans historique rendu', () => {
  it('affiche la confiance agrégée sans prêts rendus', () => {
    render(
      <LoansSlot lens="trust" trust={{ verified: true, active: 3, onTimeRate: 92, rating: 4.8 }} />
    );

    expect(screen.getByText('92 %')).toBeTruthy();
    expect(screen.queryByText(/prêts rendus/i)).toBeNull();
  });

  it('résume vérification, prêts actifs, note et retour à temps', () => {
    render(<LoansSlot lens="trust" trust={TRUST} />);

    expect(screen.getByText('Profil vérifié')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4,8 / 5')).toBeTruthy();
    expect(screen.getByText('Taux de retour à temps')).toBeTruthy();
    // Carte agrégée uniquement : aucune liste de prêts dans cette lentille.
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Sac 45 L')).toBeNull();
  });

  it('état vide honnête quand le bootstrap ne fournit pas la confiance', () => {
    render(<LoansSlot lens="trust" />);

    expect(screen.getByText('Aucune donnée de confiance.')).toBeTruthy();
    expect(screen.queryByText(/prêts rendus/i)).toBeNull();
  });
});

describe('LoansSlot — Je prête / J’emprunte', () => {
  it('lit le payload du bootstrap et le filtre par rôle', () => {
    render(<LoansSlot lens="lend" payload={{ loans: LOANS, trust: TRUST }} />);

    expect(screen.getByText('Sac 45 L')).toBeTruthy();
    expect(screen.getByText('Tente 2 places')).toBeTruthy();
    expect(screen.queryByText('Duvet -5°')).toBeNull();
    // Résumé : 2 actifs, 1 en retard, 2 prêtés cette année.
    const summary = screen.getByRole('group', { name: 'Résumé des prêts' });
    expect(within(summary).getByText('Actifs')).toBeTruthy();
    expect(within(summary).getByText('En retard')).toBeTruthy();
    expect(within(summary).getByText('Cette année')).toBeTruthy();
    expect(within(summary).getAllByText('2')).toHaveLength(2);
    expect(within(summary).getAllByText('1')).toHaveLength(1);
  });

  it('accepte les identifiants de lentille de la coquille (lender/borrower)', () => {
    render(<LoansSlot lens="borrower" payload={{ loans: LOANS }} />);

    expect(screen.getByText('Duvet -5°')).toBeTruthy();
    expect(screen.getByText('Réchaud')).toBeTruthy();
    expect(screen.queryByText('Sac 45 L')).toBeNull();
    expect(screen.getByRole('button', { name: /Rendre · Duvet -5°/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rappeler/ })).toBeNull();
  });

  it('affiche des états vides explicites, sans donnée inventée', () => {
    render(<LoansSlot lens="lend" />);

    expect(screen.getByText('Aucun prêt en cours.')).toBeTruthy();
    expect(screen.queryByTestId(/loan-card/)).toBeNull();
  });

  it('« Membre » pour un visiteur, le prénom réel pour le propriétaire', () => {
    const { rerender } = render(
      <LoansSlot lens="lend" payload={{ loans: LOANS }} viewer="visitor" />
    );

    expect(screen.getAllByText('Membre').length).toBeGreaterThan(0);
    expect(screen.queryByText('Léa')).toBeNull();
    expect(screen.queryByText('Marc')).toBeNull();

    rerender(<LoansSlot lens="lend" payload={{ loans: LOANS }} viewer="owner" />);
    expect(screen.getAllByText('Léa').length).toBeGreaterThan(0);
    expect(screen.getByText('Marc')).toBeTruthy();
  });

  it('lit le mode visiteur dans payload.profile.viewer et masque les actions', () => {
    render(
      <LoansSlot
        lens="lend"
        payload={{ loans: LOANS, profile: { viewer: 'visitor' } }}
      />
    );

    expect(screen.getAllByText('Membre').length).toBeGreaterThan(0);
    expect(screen.queryByText('Léa')).toBeNull();
    expect(screen.queryByRole('group', { name: /Actions pour/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Rappeler|Marquer rendu|Noter|Signaler/ })).toBeNull();
    // Les données factuelles restent visibles.
    expect(screen.getByText('Sac 45 L')).toBeTruthy();
  });

  it('donne la priorité à payload.viewer sur payload.profile.viewer', () => {
    render(
      <LoansSlot
        lens="lend"
        payload={{ loans: LOANS, viewer: 'visitor', profile: { viewer: 'owner' } }}
      />
    );

    expect(screen.queryByText('Léa')).toBeNull();
    expect(screen.queryByRole('button', { name: /Rappeler/ })).toBeNull();
  });
});

describe('LoanCard — actions, consentement de la note et accessibilité', () => {
  it('rend les actions du prêteur et remonte l’action demandée', async () => {
    const onAction = vi.fn();
    render(<LoanCard loan={LOANS[0]} onAction={onAction} />);

    const card = screen.getByTestId('loan-card-l1');
    for (const label of ['Rappeler', 'Marquer rendu', 'Noter', 'Signaler']) {
      expect(within(card).getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    }

    fireEvent.click(within(card).getByRole('button', { name: /Marquer rendu/ }));
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('return', expect.objectContaining({ id: 'l1' }), undefined)
    );

    fireEvent.click(within(card).getByRole('button', { name: /Signaler/ }));
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('dispute', expect.objectContaining({ id: 'l1' }), undefined)
    );

    fireEvent.click(within(card).getByRole('button', { name: /Rappeler/ }));
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('remind', expect.objectContaining({ id: 'l1' }))
    );
  });

  it('note un prêt rendu avec une étoile, sur 5', async () => {
    const onAction = vi.fn();
    const unrated: LoanRecord = { ...LOANS[3], id: 'l5', rating: null };
    render(<LoanCard loan={unrated} onAction={onAction} />);

    const card = screen.getByTestId('loan-card-l5');
    fireEvent.click(within(card).getByRole('button', { name: /Noter · Réchaud/ }));

    const stars = within(card).getAllByRole('button', { name: /sur 5/ });
    expect(stars).toHaveLength(5);
    fireEvent.click(stars[3]);

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('rate', expect.objectContaining({ id: 'l5' }), 4)
    );
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /sur 5/ })).toHaveLength(0)
    );
    expect(screen.getByText('Note enregistrée.')).toBeTruthy();
  });

  it('garde le picker ouvert et permet de réessayer après un échec de note', async () => {
    const onAction = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const unrated: LoanRecord = { ...LOANS[3], id: 'l6', itemName: 'Réchaud', rating: null };
    render(<LoanCard loan={unrated} onAction={onAction} />);

    const card = screen.getByTestId('loan-card-l6');
    fireEvent.click(within(card).getByRole('button', { name: /Noter/ }));
    fireEvent.click(within(card).getAllByRole('button', { name: /sur 5/ })[3]);

    expect(await screen.findByText('Note non enregistrée. Réessaie.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /sur 5/ })).toHaveLength(5);

    // Second essai : le picker est toujours là et se ferme seulement au succès.
    fireEvent.click(screen.getAllByRole('button', { name: /sur 5/ })[4]);
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /sur 5/ })).toHaveLength(0)
    );
    expect(onAction).toHaveBeenLastCalledWith('rate', expect.objectContaining({ id: 'l6' }), 5);
    expect(screen.getByText('Note enregistrée.')).toBeTruthy();
  });

  it('marque l’échéance dépassée, jamais après retour, et garde des cibles de 44 px', () => {
    render(<LoanCard loan={LOANS[1]} />);
    const card = screen.getByTestId('loan-card-l2');

    expect(within(card).getByText('En retard')).toBeTruthy();
    expect(within(card).getByText(/Échéance/)).toBeTruthy();
    expect(screen.getByTestId('loan-card-l2').getAttribute('data-overdue')).toBe('true');
    expect(
      isLoanOverdue({ status: 'en_retard', dueDate: day(-5), returnedAt: day(-1) })
    ).toBe(false);
    expect(LOANS_CSS).toContain('min-height:44px');
    expect(LOANS_CSS).toContain('min-height:84px');
    expect(LOANS_CSS).toContain('prefers-reduced-motion');
    expect(LOANS_CSS).toContain('.is-en_attente');
    expect(LOANS_CSS).toContain('.is-annule');
    expect(LOANS_CSS).toContain('.lkdv-loan-feedback');
  });

  it('ajoute l’année d’une date hors année courante', () => {
    const crossYear: LoanRecord = {
      ...LOANS[0],
      id: 'l7',
      loanedAt: '2025-12-01',
      dueDate: '2027-01-05',
    };
    render(<LoanCard loan={crossYear} />);

    expect(
      screen.getByText('Prêté le 1 déc. 2025 · Échéance 5 janv. 2027')
    ).toBeTruthy();
  });
});

describe('LoansSlot — API, rappel et retry', () => {
  it('met à jour la carte après un retour confirmé par la route', async () => {
    const fetchMock = vi.fn(async () => new Response('{"loan":{}}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<LoansSlot lens="lend" loans={[LOANS[0]]} />);
    fireEvent.click(screen.getByRole('button', { name: /Marquer rendu/ }));

    expect(await screen.findByText('Prêt marqué rendu.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/compte/loans',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'return', loanId: 'l1', rating: undefined }),
      })
    );
    expect(screen.getByText('Rendu')).toBeTruthy();
  });

  it('« Rappeler » dit honnêtement que le canal n’existe pas encore', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const listened = vi.fn();
    window.addEventListener('lkdv:loan-remind', listened);

    render(<LoansSlot lens="lend" loans={[LOANS[0]]} />);
    fireEvent.click(screen.getByRole('button', { name: /Rappeler/ }));

    expect(screen.getByText('Rappel non envoyé : canal à venir.')).toBeTruthy();
    await waitFor(() => expect(listened).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    window.removeEventListener('lkdv:loan-remind', listened);
  });
});
