// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationsSheet, type ProfileInvitation } from '../InvitationsSheet';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const PENDING: ProfileInvitation = {
  id: 'inv-1',
  token: 'jeton-abc-0123456789',
  status: 'pending',
  expires_at: '2026-11-20T12:00:00Z',
  created_at: '2026-10-21T12:00:00Z',
};

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
});

describe('InvitationsSheet — données réelles uniquement', () => {
  it('liste les invitations chargées depuis l’API', async () => {
    const fetcher = vi.fn(async () => response({ invitations: [PENDING] }));

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    expect(await screen.findByText('En attente')).toBeTruthy();
    expect(screen.getByText(/\/invitation\/jeton-abc-0123456789$/)).toBeTruthy();
    expect(fetcher).toHaveBeenCalledWith(
      '/api/compte/invitations',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('affiche un état vide honnête', async () => {
    const fetcher = vi.fn(async () => response({ invitations: [] }));

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    expect(await screen.findByText('Aucune invitation pour le moment.')).toBeTruthy();
  });

  it('affiche une erreur et permet de réessayer', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ error: 'server_error' }, 500))
      .mockResolvedValueOnce(response({ invitations: [PENDING] }));

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    expect(
      await screen.findByText('Impossible de charger les invitations pour le moment.')
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('En attente')).toBeTruthy();
  });

  it('crée un lien via POST et l’ajoute à la liste', async () => {
    const created = { ...PENDING, id: 'inv-2', token: 'jeton-nouveau-0123456789' };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ action: 'create' });
        return response({ invitation: created }, 201);
      }
      return response({ invitations: [] });
    });

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un lien' }));
    expect(await screen.findByText('Lien créé. Copie-le pour l’envoyer.')).toBeTruthy();
    expect(screen.getByText(/\/invitation\/jeton-nouveau-0123456789$/)).toBeTruthy();
  });

  it('copie le lien complet dans le presse-papiers', async () => {
    const fetcher = vi.fn(async () => response({ invitations: [PENDING] }));

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Copier le lien de l’invitation inv-1',
      })
    );

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/invitation/jeton-abc-0123456789'
      )
    );
    expect(await screen.findByText('Lien copié.')).toBeTruthy();
  });

  it('révoque une invitation via POST et met à jour son statut', async () => {
    const revoked = { ...PENDING, status: 'revoked' };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          action: 'revoke',
          invitationId: PENDING.id,
        });
        return response({ revoked: true, invitation: revoked });
      }
      return response({ invitations: [PENDING] });
    });

    render(<InvitationsSheet onClose={() => {}} fetcher={fetcher as unknown as typeof fetch} />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Révoquer l’invitation inv-1',
      })
    );

    expect(await screen.findByText('Invitation révoquée.')).toBeTruthy();
    expect(screen.getByText('Révoquée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Révoquer l’invitation inv-1' })).toBeNull();
  });

  it('ferme la feuille avec le bouton dédié', async () => {
    const onClose = vi.fn();
    const fetcher = vi.fn(async () => response({ invitations: [] }));

    render(<InvitationsSheet onClose={onClose} fetcher={fetcher as unknown as typeof fetch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer les invitations' }));
    expect(onClose).toHaveBeenCalled();
  });
});
