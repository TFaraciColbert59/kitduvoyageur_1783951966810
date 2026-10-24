// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileInvitationLoginPath } from '@/lib/invitationPaths';
import { ProfileInvitationAccept } from '../ProfileInvitationAccept';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const TOKEN = 'jeton-profil-0123456789';

afterEach(cleanup);

describe('ProfileInvitationAccept — états honnêtes', () => {
  it('accepte une invitation et renvoie vers le profil du propriétaire', async () => {
    const fetcher = vi.fn(async () =>
      response({ accepted: true, already: false, owner_id: 'owner-1' })
    );
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Invitation acceptée')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Voir le profil' }).getAttribute('href')
    ).toBe('/profil/owner-1');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/compte/invitations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'accept', token: TOKEN }),
      })
    );
  });

  it('signale une invitation déjà acceptée', async () => {
    const fetcher = vi.fn(async () =>
      response({ accepted: true, already: true, owner_id: 'owner-1' })
    );
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Invitation déjà acceptée')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Voir le profil' }).getAttribute('href')
    ).toBe('/profil/owner-1');
  });

  it('affiche « Invitation introuvable » sur 404', async () => {
    const fetcher = vi.fn(async () => response({ error: 'not_found' }, 404));
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Invitation introuvable')).toBeTruthy();
  });

  it('affiche « Invitation expirée » sur 409', async () => {
    const fetcher = vi.fn(async () => response({ error: 'invalid_state' }, 409));
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Invitation expirée')).toBeTruthy();
  });

  it('affiche « Invitation réservée à une autre personne » sur 403', async () => {
    const fetcher = vi.fn(async () => response({ error: 'forbidden' }, 403));
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(
      await screen.findByText('Invitation réservée à une autre personne')
    ).toBeTruthy();
  });

  it('propose de réessayer après une panne, puis accepte', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'server_error' }, 500))
      .mockResolvedValueOnce(response({ accepted: true, already: false, owner_id: null }));
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Impossible d’accepter l’invitation')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Invitation acceptée')).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('renvoie vers la connexion si la session a expiré (401)', async () => {
    const fetcher = vi.fn(async () => response({ error: 'unauthenticated' }, 401));
    render(
      <ProfileInvitationAccept token={TOKEN} fetcher={fetcher as unknown as typeof fetch} />
    );

    expect(await screen.findByText('Connexion requise')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')
    ).toBe(profileInvitationLoginPath(TOKEN));
  });
});
