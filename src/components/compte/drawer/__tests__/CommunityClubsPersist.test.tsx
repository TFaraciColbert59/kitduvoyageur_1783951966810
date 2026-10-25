// @vitest-environment jsdom

/**
 * Task 17 — persistance des actions du drawer club.
 *
 * Rejoindre/Quitter et le RSVP doivent appeler `POST /api/compte/clubs`,
 * afficher l'état optimiste immédiatement, puis revenir à l'état précédent avec
 * un message visible si le serveur refuse ou si le réseau échoue. Les kits
 * recommandés exposés par le bootstrap sont rendus tels quels.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDrawer } from '../ClubDrawer';
import type { Club } from '../cards/ClubCard';

const CLUB_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';

const club: Club = {
  id: CLUB_ID,
  n: 'Club Alpin',
  role: 'Membre actif',
  members: 3,
  joined: true,
  nextEvent: {
    id: EVENT_ID,
    title: 'Néouvielle',
    event_date: '2026-10-24',
    location: 'Néouvielle',
    participants_count: 8,
    max_participants: 12,
  },
  topics: [{ id: 't1', title: 'Préparer le bivouac', is_pinned: true }],
  recommendedKits: [{ id: 'k1', name: 'Kit bivouac', items: 7 }],
};

const onClose = vi.fn();
const fetchMock = vi.fn();

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

function requestBody(callIndex = 0): Record<string, unknown> {
  const call = fetchMock.mock.calls[callIndex] as [string, RequestInit] | undefined;
  return JSON.parse(String(call?.[1]?.body ?? '{}')) as Record<string, unknown>;
}

type DrawerKitOverride = NonNullable<Club['recommendedKits']>[number] & {
  weight?: number | null;
};

type MembershipStatus = 'active' | 'banned' | 'pending';

type DrawerNextEvent = NonNullable<Club['nextEvent']> & { attending?: boolean };

function renderClub(
  overrides: Partial<Omit<Club, 'recommendedKits' | 'nextEvent'>> & {
    membershipStatus?: MembershipStatus | null;
    nextEvent?: DrawerNextEvent | null;
    recommendedKits?: DrawerKitOverride[];
  } = {}
) {
  return render(
    <ClubDrawer
      club={{ ...club, ...overrides } as unknown as Club & { membershipStatus?: MembershipStatus | null }}
      onClose={onClose}
    />
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ClubDrawer — adhésion persistée', () => {
  it('rejoint de façon optimiste puis confirme l’appel serveur', async () => {
    fetchMock.mockResolvedValueOnce(response({ clubId: CLUB_ID, joined: true }));
    renderClub({ joined: false });

    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }));

    // Optimiste : le libellé bascule avant la réponse réseau.
    expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('rejoint');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/compte/clubs');
    expect(requestBody()).toEqual({ action: 'join', clubId: CLUB_ID });

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Club Alpin')
    );
    expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy();
  });

  it('quitte puis revient à l’état précédent si le serveur refuse', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: 'forbidden' }, false));
    renderClub({ joined: true });

    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }));

    // Optimiste : « Rejoindre » est affiché tout de suite…
    expect(screen.getByRole('button', { name: 'Rejoindre' })).toBeTruthy();

    // …puis rollback et message visible.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestBody()).toEqual({ action: 'leave', clubId: CLUB_ID });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy());
    const status = screen.getByRole('status');
    expect(status.textContent).toContain("n'a pas abouti");
    expect(status.getAttribute('data-error')).toBe('true');
    expect(status.style.color).toBe('var(--danger)');
  });

  it('revient à l’état précédent sur échec réseau', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    renderClub({ joined: true });

    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }));

    expect(screen.getByRole('button', { name: 'Rejoindre' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain("n'a pas abouti");
  });
});

describe('ClubDrawer — statuts d’adhésion', () => {
  it('un membre banni n’a ni Rejoindre/Quitter ni RSVP', () => {
    renderClub({ joined: false, membershipStatus: 'banned' });

    expect(screen.getByText('Banni')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rejoindre' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Je participe' })).toBeNull();
    expect(screen.getByText('RSVP réservé aux membres actifs.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('une demande en attente affiche « En attente » sans bouton Rejoindre', () => {
    renderClub({ joined: false, membershipStatus: 'pending' });

    expect(screen.getByText('En attente')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rejoindre' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Je participe' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un membre actif garde Quitter et le groupe RSVP', () => {
    renderClub({ membershipStatus: 'active' });

    expect(screen.getByRole('button', { name: 'Quitter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Je participe' })).toBeTruthy();
  });
});

describe('ClubDrawer — RSVP persisté', () => {
  it('restaure « Je participe » depuis nextEvent.attending à l’ouverture', () => {
    renderClub({ nextEvent: { ...club.nextEvent, attending: true } });

    expect(
      screen.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Non' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('n’affiche aucune réponse sans participation persistée', () => {
    renderClub({ nextEvent: { ...club.nextEvent, attending: false } });

    expect(
      screen.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')
    ).toBe('false');
    expect(screen.getByRole('button', { name: 'Non' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('enregistre « Je participe » avec un état optimiste', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ clubId: CLUB_ID, eventId: EVENT_ID, attending: true })
    );
    renderClub();

    const participate = screen.getByRole('button', { name: 'Je participe' });
    expect(participate.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(participate);

    expect(
      screen.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Ta réponse');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestBody()).toEqual({
      action: 'rsvp',
      clubId: CLUB_ID,
      eventId: EVENT_ID,
      attending: true,
    });
  });

  it('enregistre « Non » comme participation retirée', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ clubId: CLUB_ID, eventId: EVENT_ID, attending: false })
    );
    renderClub();

    fireEvent.click(screen.getByRole('button', { name: 'Non' }));

    expect(screen.getByRole('button', { name: 'Non' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestBody()).toEqual({
      action: 'rsvp',
      clubId: CLUB_ID,
      eventId: EVENT_ID,
      attending: false,
    });
  });

  it('annule le RSVP optimiste si le serveur échoue', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    renderClub();

    fireEvent.click(screen.getByRole('button', { name: 'Je participe' }));
    expect(
      screen.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')
    ).toBe('true');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')
      ).toBe('false')
    );
    expect(screen.getByRole('status').textContent).toContain("n'a pas abouti");
  });
});

describe('ClubDrawer — kits recommandés du bootstrap', () => {
  it('rend les kits réels sans en inventer', () => {
    renderClub({
      recommendedKits: [
        { id: 'k1', name: 'Kit bivouac', items: 7, weight: 4200 },
        { id: 'k2', name: 'Kit hiver', items: 0, weight: 5100 },
      ],
    });

    expect(screen.getByText('Kit bivouac')).toBeTruthy();
    expect(screen.getByText('7 objets')).toBeTruthy();
    expect(screen.getByText('4200 g')).toBeTruthy();
    expect(screen.getByText('Kit hiver')).toBeTruthy();
    expect(screen.getByText('5100 g')).toBeTruthy();
    // Aucun compteur inventé quand `items` vaut 0.
    expect(screen.queryByText('0 objet')).toBeNull();
  });

  it('affiche l’état vide quand le bootstrap ne fournit aucun kit', () => {
    renderClub({ recommendedKits: [] });

    expect(screen.getByText('Aucun kit recommandé.')).toBeTruthy();
  });
});
