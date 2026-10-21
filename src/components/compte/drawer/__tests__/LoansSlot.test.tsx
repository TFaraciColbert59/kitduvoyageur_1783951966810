// @vitest-environment jsdom

/**
 * Task 8 — slot Prêts.
 *
 * Contrat : trois lentilles (`lend`, `borrow`, `trust`), cartes réelles issues
 * du bootstrap, actions de prêt, et **carte de confiance agrégée uniquement** :
 * aucun historique « prêts rendus » n'est rendu dans la lentille Confiance.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoansSlot, LOANS_CSS } from '../slots/LoansSlot';
import { LoanCard } from '../cards/LoanCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TRUST = { verified: true, active: 3, onTimeRate: 92, rating: 4.8 };

const LOANS = [
  {
    id: 'l1',
    itemName: 'Sac 45 L',
    counterpart: 'Léa',
    role: 'lender' as const,
    status: 'en_cours',
    loanedAt: '2026-10-01',
    dueDate: '2026-10-25',
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l2',
    itemName: 'Tente 2 places',
    counterpart: 'Marc',
    role: 'lender' as const,
    status: 'en_retard',
    loanedAt: '2026-09-10',
    dueDate: '2026-09-30',
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l3',
    itemName: 'Duvet -5°',
    counterpart: 'Léa',
    role: 'borrower' as const,
    status: 'en_cours',
    loanedAt: '2026-10-05',
    dueDate: '2026-10-28',
    returnedAt: '',
    rating: null,
  },
  {
    id: 'l4',
    itemName: 'Réchaud',
    counterpart: 'Nina',
    role: 'borrower' as const,
    status: 'rendu',
    loanedAt: '2026-08-01',
    dueDate: '2026-08-10',
    returnedAt: '2026-08-09',
    rating: 5,
  },
];

describe('LoansSlot — Confiance agrégée, sans historique rendu', () => {
  it('affiche la confiance agrégée sans prêts rendus', () => {
    render(<LoansSlot lens="trust" trust={TRUST} />);

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
});

describe('LoanCard — actions et accessibilité', () => {
  it('rend les actions du prêteur et remonte l’action demandée', () => {
    const onAction = vi.fn();
    render(<LoanCard loan={LOANS[0]} onAction={onAction} />);

    const card = screen.getByTestId('loan-card-l1');
    for (const label of ['Rappeler', 'Marquer rendu', 'Noter', 'Signaler']) {
      expect(within(card).getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    }

    fireEvent.click(within(card).getByRole('button', { name: /Marquer rendu/ }));
    expect(onAction).toHaveBeenCalledWith('return', expect.objectContaining({ id: 'l1' }), undefined);

    fireEvent.click(within(card).getByRole('button', { name: /Signaler/ }));
    expect(onAction).toHaveBeenCalledWith('dispute', expect.objectContaining({ id: 'l1' }), undefined);

    fireEvent.click(within(card).getByRole('button', { name: /Rappeler/ }));
    expect(onAction).toHaveBeenCalledWith('remind', expect.objectContaining({ id: 'l1' }), undefined);
  });

  it('note un prêt rendu avec une étoile, sur 5', () => {
    const onAction = vi.fn();
    const unrated = { ...LOANS[3], id: 'l5', rating: null };
    render(<LoanCard loan={unrated} onAction={onAction} />);

    const card = screen.getByTestId('loan-card-l5');
    fireEvent.click(within(card).getByRole('button', { name: /Noter · Réchaud/ }));

    const stars = within(card).getAllByRole('button', { name: /sur 5/ });
    expect(stars).toHaveLength(5);
    fireEvent.click(stars[3]);

    expect(onAction).toHaveBeenCalledWith('rate', expect.objectContaining({ id: 'l5' }), 4);
  });

  it('marque l’échéance dépassée et garde des cibles de 44 px', () => {
    render(<LoanCard loan={LOANS[1]} />);
    const card = screen.getByTestId('loan-card-l2');

    expect(within(card).getByText('En retard')).toBeTruthy();
    expect(within(card).getByText(/Échéance/)).toBeTruthy();
    expect(LOANS_CSS).toContain('min-height:44px');
    expect(LOANS_CSS).toContain('min-height:84px');
    expect(LOANS_CSS).toContain('prefers-reduced-motion');
  });
});

describe('LoansSlot — branche l’API sans inventer de succès', () => {
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

  it('« Rappeler » publie un événement d’intégration, sans prétendre à un envoi', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const listened = vi.fn();
    window.addEventListener('lkdv:loan-remind', listened);

    render(<LoansSlot lens="lend" loans={[LOANS[0]]} />);
    fireEvent.click(screen.getByRole('button', { name: /Rappeler/ }));

    expect(listened).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    window.removeEventListener('lkdv:loan-remind', listened);
  });
});
