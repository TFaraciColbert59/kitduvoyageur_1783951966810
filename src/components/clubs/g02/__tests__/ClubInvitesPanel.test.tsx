// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClubInvitesPanel } from '../ClubInvitesPanel';
import { makeClub, makeInvite, makeMember, NOW } from './fixtures';

afterEach(() => cleanup());

const club = makeClub();
const admin = makeMember({ clubId: club.id, userId: 'admin', displayName: 'Ada', role: 'admin' });
const member = makeMember({ clubId: club.id, userId: 'member', displayName: 'Mia' });

function renderPanel(overrides: Partial<React.ComponentProps<typeof ClubInvitesPanel>> = {}) {
  return render(
    <ClubInvitesPanel
      invites={[makeInvite({ createdBy: 'admin' })]}
      memberships={[admin, member]}
      viewerContext={{ viewerId: 'admin' }}
      currentUserId="admin"
      nowIso={NOW}
      onCreateInvite={vi.fn()}
      onRevokeInvite={vi.fn()}
      {...overrides}
    />,
  );
}

describe('G02 — invitations K5.21/K5.22/S5.19', () => {
  it('affiche le lien, le QR et l’état d’un lien actif', () => {
    renderPanel();
    expect(screen.getByText('https://lkdv.fr/invite/token-demo')).toBeTruthy();
    expect(screen.getByText('lkdv://invite/club/111?token=token-demo')).toBeTruthy();
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/0 \/ 2 utilisations/)).toBeTruthy();
  });

  it('signale un lien expiré et empêche toute révocation inutile', () => {
    renderPanel({ invites: [makeInvite({ expiresAt: '2026-01-01T00:00:00.000Z', createdBy: 'admin' })] });
    expect(screen.getByText('Expiré')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Révoquer' })).toBeNull();
  });

  it('réserve la révocation au créateur ou à un modérateur', () => {
    const onRevokeInvite = vi.fn();
    renderPanel({ currentUserId: 'member', viewerContext: { viewerId: 'member' }, onRevokeInvite });
    expect(screen.queryByRole('button', { name: 'Révoquer' })).toBeNull();
  });

  it('révoque un lien actif pour un admin du club', () => {
    const onRevokeInvite = vi.fn();
    renderPanel({ onRevokeInvite });
    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    expect(onRevokeInvite).toHaveBeenCalledTimes(1);
  });

  it('accepte une invitation de trace reçue', () => {
    const onRespondActivityInvite = vi.fn();
    renderPanel({
      currentUserId: 'member',
      viewerContext: { viewerId: 'member' },
      activityInvites: [
        {
          id: 'inv',
          activityId: 'act',
          ownerUserId: 'admin',
          inviteeUserId: 'member',
          status: 'pending',
          createdAt: NOW,
          respondedAt: null,
        },
      ],
      onRespondActivityInvite,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(onRespondActivityInvite).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv' }), 'accept');
  });

  it('valide la cible avant de créer un lien', () => {
    const onCreateInvite = vi.fn();
    renderPanel({ canCreate: true, onCreateInvite });
    fireEvent.click(screen.getByRole('button', { name: 'Générer le lien' }));
    expect(onCreateInvite).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/cible/i);
  });
});
