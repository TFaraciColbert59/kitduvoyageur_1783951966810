// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClubEventDetail } from '../ClubEventDetail';
import { makeClub, makeEvent, makeMember, makeRegistration, NOW } from './fixtures';

vi.mock('@/features/community/v2/create/carnet/TrailSearchFieldV2', () => ({
  TrailSearchFieldV2: ({ onPickTrail }: { onPickTrail: (trail: { id: string }) => void }) => (
    <button type="button" onClick={() => onPickTrail({ id: '925000912' })}>Choisir le tracé du col</button>
  ),
}));

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

  it('distingue la réception d’une révision de la décision du participant', async () => {
    const onSyncRoute = vi.fn();
    const latestRevision = {
      eventId: makeEvent().id,
      routeId: '925000912',
      canonicalRevisionId: 'pinned-route',
      revision: 2,
      checksum: 'recorded',
      distanceM: 4000,
      elevationGainM: null,
      updatedBy: 'admin',
      updatedAt: NOW,
      requiresParticipantDecision: true,
    };
    const first = renderDetail({ latestRevision, onSyncRoute });
    expect(screen.queryByRole('button', { name: 'Adopter ce tracé' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir la révision' }));
    await waitFor(() => expect(onSyncRoute).toHaveBeenCalledTimes(1));
    first.unmount();

    const onDecideRoute = vi.fn();
    renderDetail({
      latestRevision,
      routeSyncState: {
        eventId: makeEvent().id,
        userId: 'admin',
        lastSyncedRevision: 2,
        pendingRevision: 2,
        decisionRequired: true,
        revoked: false,
        syncedAt: NOW,
      },
      onDecideRoute,
    });
    expect(screen.getByText('Décision requise')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recevoir la révision' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Garder mon tracé' }));
    await waitFor(() => expect(onDecideRoute).toHaveBeenCalledWith(2, false));
  });

  it('révision issue d’un espace d’itinéraire : mention de version et mêmes gestes de décision', async () => {
    const onDecideRoute = vi.fn();
    renderDetail({
      latestRevision: {
        eventId: makeEvent().id, routeId: 'ws-1', canonicalRevisionId: null, sourceRevisionNo: 3, revision: 2,
        checksum: 'sum', distanceM: 3300, elevationGainM: 200, updatedBy: 'admin', updatedAt: NOW,
        requiresParticipantDecision: true,
      },
      routeSyncState: {
        eventId: makeEvent().id, userId: 'admin', lastSyncedRevision: 2, pendingRevision: 2,
        decisionRequired: true, revoked: false, syncedAt: NOW,
      },
      onDecideRoute,
    });
    expect(screen.getByTestId('route-source').textContent).toBe('Proposé depuis l’itinéraire · version 3');
    fireEvent.click(screen.getByRole('button', { name: 'Adopter ce tracé' }));
    await waitFor(() => expect(onDecideRoute).toHaveBeenCalledWith(2, true));
  });

  it('publie le tracé choisi dans le catalogue et la révision attendue', async () => {
    const onPublishRoute = vi.fn();
    renderDetail({ onPublishRoute });
    const publish = screen.getByRole('button', { name: 'Publier la révision' });
    fireEvent.click(publish);
    expect(onPublishRoute).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Choisis un tracé/);

    fireEvent.click(screen.getByRole('button', { name: 'Choisir le tracé du col' }));
    fireEvent.change(screen.getByLabelText('Rendez-vous'), { target: { value: ' Passerelle aval ' } });
    fireEvent.click(publish);
    await waitFor(() => expect(onPublishRoute).toHaveBeenCalledWith({
      routeId: '925000912', expectedRevision: 1, meetingPoint: 'Passerelle aval',
    }));
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
