// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClubEventDetail } from '../ClubEventDetail';
import { makeClub, makeEvent, makeMember, makeRegistration, NOW } from './fixtures';

afterEach(() => cleanup());

const club = makeClub();
const admin = makeMember({ clubId: club.id, userId: 'admin', displayName: 'Ada', role: 'admin' });

function renderDetail(overrides: Partial<React.ComponentProps<typeof ClubEventDetail>> = {}) {
  return render(
    <ClubEventDetail
      event={makeEvent()}
      club={club}
      memberships={[admin]}
      registrations={[makeRegistration({ userId: 'admin' })]}
      viewerContext={{ viewerId: 'admin', viewerClubIds: [club.id] }}
      currentUserId="admin"
      nowIso={NOW}
      shareUrl="https://lkdv.fr/clubs/trail-alpes/evenements/evt"
      onRegister={vi.fn()}
      onCancel={vi.fn()}
      onPublishRoute={vi.fn()}
      onSyncRoute={vi.fn()}
      {...overrides}
    />,
  );
}

describe('G02 — fiche sortie K5.21/K5.23/S5.14', () => {
  it('affiche les informations, la présence consentie et le flyer', () => {
    renderDetail({
      attendanceRecords: [
        { eventId: makeEvent().id, userId: 'admin', activityId: 'act', consentGranted: true, activityVisibility: 'club_only', matchedAt: NOW },
      ],
    });
    expect(screen.getByText('Sortie Belledonne')).toBeTruthy();
    expect(screen.getByText(/Présence réelle/)).toBeTruthy();
    expect(screen.getByText(/1 inscrit/)).toBeTruthy();
    expect(screen.getByText(/lkdv:\/\/event\//)).toBeTruthy();
  });

  it('affiche une décision de tracé et synchronise', () => {
    const onSyncRoute = vi.fn();
    renderDetail({
      routeSyncState: {
        eventId: makeEvent().id,
        userId: 'admin',
        lastSyncedRevision: 1,
        pendingRevision: 2,
        decisionRequired: true,
        revoked: false,
        syncedAt: NOW,
      },
      onSyncRoute,
    });
    expect(screen.getByText('Décision requise')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter la nouvelle trace' }));
    expect(onSyncRoute).toHaveBeenCalledTimes(1);
  });

  it('valide l’identifiant et la distance avant de publier une révision', () => {
    const onPublishRoute = vi.fn();
    renderDetail({ onPublishRoute });
    fireEvent.change(screen.getByLabelText('Empreinte (checksum)'), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Publier la révision' }).closest('form') as HTMLFormElement);
    expect(onPublishRoute).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Distance invalide/);
  });

  it('cache tout le contenu d’une sortie d’un club fermé à un non-membre', () => {
    renderDetail({
      club: makeClub({ privacy: 'closed' }),
      memberships: [],
      viewerContext: { viewerId: 'outsider' },
      currentUserId: 'outsider',
    });
    expect(screen.getByText('Sortie non accessible')).toBeTruthy();
    expect(screen.queryByText('Sortie Belledonne')).toBeNull();
  });
});
