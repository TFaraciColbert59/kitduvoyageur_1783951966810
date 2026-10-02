// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  respondTripInvitationAction: vi.fn(async () => ({ success: true, tripId: 'trip-1' })),
}));
vi.mock('../server/invitationActions', () => actions);
const compas = vi.hoisted(() => ({
  compasOpenTripAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/compasActions', () => compas);

import { TripInvitationsInbox } from '../components/TripInvitations';

const INV = {
  invitationId: '0f1e2d3c-0000-4000-8000-000000000001',
  tripId: 'trip-1',
  token: null,
  role: 'editor' as const,
  tripTitle: 'Val Joly en famille',
  destination: 'Val Joly',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  inviterName: 'Tony',
  inviterAvatar: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TripInvitationsInbox', () => {
  it('accepte sur place, sans redirection, puis propose « Voir »', async () => {
    render(<TripInvitationsInbox invitations={[INV]} />);
    expect(screen.getByText('Val Joly en famille')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    await waitFor(() =>
      expect(actions.respondTripInvitationAction).toHaveBeenCalledWith({
        invitationId: INV.invitationId,
        accept: true,
      })
    );
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Voir' }));
    await waitFor(() => expect(compas.compasOpenTripAction).toHaveBeenCalledWith({ tripId: 'trip-1' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/compas'));
  });

  it('refuse sur place ; une erreur remet le choix', async () => {
    actions.respondTripInvitationAction.mockResolvedValueOnce({
      success: false,
      error: 'Cette invitation n’est plus ouverte.',
    } as never);
    render(<TripInvitationsInbox invitations={[INV]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    expect(await screen.findByText('Refusée')).toBeTruthy();
  });

  it('rien à afficher sans invitation', () => {
    const { container } = render(<TripInvitationsInbox invitations={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
