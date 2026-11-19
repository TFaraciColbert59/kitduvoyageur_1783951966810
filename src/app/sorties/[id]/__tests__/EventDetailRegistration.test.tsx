// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import EventDetailClient, { type EventDetailData } from '../EventDetailClient';

const { rpc, refresh } = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }));
vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ haptic: vi.fn() }) }));
vi.mock('@/components/ui/HeaderBackButton', () => ({ default: () => null }));
vi.mock('@/features/community/v2/shared/PlaceMiniMap', () => ({ PlaceMiniMap: () => null }));

const event: EventDetailData = {
  id: 'sortie-1', title: 'Sortie de recette', description: null, activity: 'rando', emoji: null,
  eventDate: '2026-12-16', startsAt: '2026-12-16T09:00:00+01:00', endsAt: null,
  duration: null, location: 'Massif', meetingPoint: null, level: null, distanceKm: null,
  elevationGainM: null, lat: null, lng: null, meetingGeom: null, coverImage: null, coverAlt: 'Sortie',
  maxParticipants: 5, currentParticipants: 1, waitlistEnabled: true, status: null,
  past: false, cancelled: false, recurrence: null, safetyNotes: null, safetyChecklist: [],
  organizer: null, participants: [], myStatus: 'none', club: null, kit: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('utilise le registre de club et affiche le statut renvoyé par la réponse', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: 'waitlist' } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { promotedUserId: null } }) });
  vi.stubGlobal('fetch', request);
  render(<EventDetailClient event={{ ...event, registrationClubId: 'club-1' }} signedIn />);
  fireEvent.click(screen.getByRole('button', { name: 'S’inscrire' }));
  await screen.findByRole('button', { name: /Sur liste d’attente/ });
  expect(request).toHaveBeenNthCalledWith(1, '/api/clubs/club-1/events/sortie-1',
    expect.objectContaining({ method: 'POST', body: '{"action":"register"}' }));
  fireEvent.click(screen.getByRole('button', { name: /Sur liste d’attente/ }));
  await screen.findByRole('button', { name: 'S’inscrire' });
  expect(request).toHaveBeenNthCalledWith(2, '/api/clubs/club-1/events/sortie-1',
    expect.objectContaining({ method: 'POST', body: '{"action":"cancel"}' }));
  expect(rpc).not.toHaveBeenCalled();
});

it('conserve le RPC de la communauté pour une sortie hors du registre club', async () => {
  rpc.mockResolvedValue({ data: { registered: true }, error: null });
  render(<EventDetailClient event={event} signedIn />);
  fireEvent.click(screen.getByRole('button', { name: 'S’inscrire' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_event', { p_event_id: 'sortie-1' }));
});
