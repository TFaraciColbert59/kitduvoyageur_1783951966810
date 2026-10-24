// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CommunitySlot } from '../slots/CommunitySlot';
import { LoanCard, type LoanRecord } from '../cards/LoanCard';
import { YearFilter } from '../memories/YearFilter';

afterEach(cleanup);

const CLUB = {
  id: 'c1',
  n: 'Club Alpin',
  role: 'Membre actif',
  members: 142,
  joined: true,
};

const LOAN: LoanRecord = {
  id: 'l1',
  itemName: 'Sac 45 L',
  counterpart: 'Léa',
  role: 'lender',
  status: 'en_cours',
  loanedAt: '2026-10-01',
  dueDate: '2099-01-01',
  returnedAt: '',
  rating: null,
};

describe('Scrollers horizontaux du drawer — contrat data-hscroll', () => {
  it('marque le rail des clubs', () => {
    render(<CommunitySlot lens="clubs" clubs={[CLUB]} />);
    expect(screen.getByTestId('club-rail').getAttribute('data-hscroll')).toBe('true');
  });

  it('marque la rangée d’actions des prêts', () => {
    render(<LoanCard loan={LOAN} onAction={() => {}} />);
    const row = screen.getByTestId('loan-card-l1').querySelector('.lkdv-loan-actions');
    expect(row?.getAttribute('data-hscroll')).toBe('true');
  });

  it('marque le filtre d’année des souvenirs', () => {
    render(<YearFilter years={[2026, 2025]} active="all" onChange={() => {}} />);
    const filter = screen.getByRole('group', { name: 'Filtrer par année' });
    expect(filter.getAttribute('data-hscroll')).toBe('true');
  });
});
