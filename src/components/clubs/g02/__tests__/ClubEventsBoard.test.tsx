// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClubEventsBoard } from '../ClubEventsBoard';
import { makeClub, makeEvent, makeMember, makeRegistration, NOW } from './fixtures';

afterEach(() => cleanup());

const club = makeClub();
const member = makeMember({ userId: 'me', clubId: club.id, displayName: 'Moi' });
const registrations = [
  makeRegistration({ userId: 'a', status: 'registered' }),
  makeRegistration({ userId: 'b', status: 'registered' }),
  makeRegistration({ userId: 'c', status: 'waitlist' }),
];

function renderBoard(overrides: Partial<React.ComponentProps<typeof ClubEventsBoard>> = {}) {
  return render(
    <ClubEventsBoard
      events={[makeEvent()]}
      clubsById={new Map([[club.id, club]])}
      memberships={[member]}
      viewerContext={{ viewerId: 'me', viewerClubIds: [club.id] }}
      registrations={registrations}
      currentUserId="me"
      nowIso={NOW}
      onRegister={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe('G02 — sorties K5.21 / S5.15', () => {
  it('affiche une sortie visible et propose la liste d’attente quand c’est complet', () => {
    renderBoard();
    expect(screen.getByText('Sortie Belledonne')).toBeTruthy();
    expect(screen.getByText('Complet · liste d’attente')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejoindre la liste d’attente' })).toBeTruthy();
  });

  it('n’affiche jamais une sortie d’un club secret à un non-membre', () => {
    const secret = makeClub({ id: 'secret', privacy: 'secret', name: 'Club secret' });
    renderBoard({
      events: [makeEvent({ clubId: secret.id, title: 'Sortie secrète' })],
      clubsById: new Map([[secret.id, secret]]),
      viewerContext: { viewerId: 'me' },
    });
    expect(screen.queryByText('Sortie secrète')).toBeNull();
    expect(screen.getByText('Aucune sortie programmée')).toBeTruthy();
  });

  it('filtre par texte et par format puis réinitialise', () => {
    renderBoard({
      events: [
        makeEvent({ id: 'trail', title: 'Trail du Vercors' }),
        makeEvent({ id: 'race', title: 'Course des crêtes', format: 'race', registrationUrl: 'https://example.com/inscription' }),
      ],
    });
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'Vercors' } });
    expect(screen.getByText('Trail du Vercors')).toBeTruthy();
    expect(screen.queryByText('Course des crêtes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(screen.getByText('Course des crêtes')).toBeTruthy();
  });

  it('n’ouvre un lien de course que si l’URL est HTTP(S) validée', () => {
    renderBoard({
      events: [
        makeEvent({ format: 'race', registrationUrl: 'javascript:alert(1)', title: 'Course piégée' }),
        makeEvent({ id: 'safe', format: 'race', registrationUrl: 'https://example.com/race', title: 'Course sûre' }),
      ],
    });
    const links = screen.getAllByRole('link', { name: 'S’inscrire à la course' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://example.com/race');
    expect(links[0].getAttribute('rel')).toContain('noopener');
  });

  it('déclenche l’inscription et désactive le bouton pendant l’appel', async () => {
    let resolve: () => void = () => {};
    const onRegister = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    renderBoard({ registrations: [], onRegister });
    fireEvent.click(screen.getByRole('button', { name: 'S’inscrire' }));
    expect(onRegister).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Inscription…' }) as HTMLButtonElement).disabled).toBe(true));
    resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'S’inscrire' })).toBeTruthy());
  });

  it('ne propose pas d’inscription pour une sortie passée', () => {
    renderBoard({
      events: [makeEvent({ startsAt: '2026-11-01T08:00:00.000Z', endsAt: '2026-11-01T11:00:00.000Z' })],
      registrations: [],
    });
    expect(screen.queryByRole('button', { name: 'S’inscrire' })).toBeNull();
  });
});
