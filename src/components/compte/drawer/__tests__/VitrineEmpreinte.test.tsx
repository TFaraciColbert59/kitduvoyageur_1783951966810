// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VitrineSlot } from '../slots/VitrineSlot';

afterEach(() => {
  cleanup();
  delete (window as unknown as { __lkdvCompteAct?: unknown }).__lkdvCompteAct;
});

const STATS = {
  km: 351,
  dplus: 20200,
  outings: 10,
  nights: 4,
  massifs: 3,
  countries: 2,
  yearMonths: [],
  bestMonth: 'Août',
  longestOuting: 58,
};

const STAMPS = [
  { id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2, verified: true },
  { id: 's2', name: 'Vercors', kind: 'massif', outings: 1, verified: false },
];

describe('Vitrine — Empreinte par massif', () => {
  it('affiche les massifs réels et un segmented de visibilité', () => {
    const act = vi.fn();
    (window as unknown as { __lkdvCompteAct?: (action: string) => void }).__lkdvCompteAct =
      act;

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Empreinte' })).toBeTruthy();
    expect(screen.getByText('Néouvielle')).toBeTruthy();
    expect(screen.getByText('2 sorties')).toBeTruthy();
    expect(screen.getAllByText('Vérifié')).toHaveLength(1);
    expect(screen.getByText('Vercors')).toBeTruthy();
    expect(screen.getByText('1 sortie')).toBeTruthy();

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    const publicButton = within(group).getByRole('button', { name: 'Public' });
    const privateButton = within(group).getByRole('button', { name: 'Privé' });
    expect(publicButton.getAttribute('aria-pressed')).toBe('true');
    expect(privateButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(privateButton);
    expect(act).toHaveBeenCalledWith('cyclevis');
  });

  it('affiche l’état vide quand aucun massif n’est rattaché', () => {
    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: [], visibility: { profile: 'prive' } }}
      />
    );

    expect(screen.getByText('Aucun massif rattaché à vos sorties')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    expect(within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });
});
