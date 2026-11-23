// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clearPendingRouteDraft } from '@/features/compas/engine/pendingDraft';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/compas/itineraire',
  useSearchParams: () => new URLSearchParams(),
}));
const createTrip = vi.fn();
vi.mock('@/features/compas/server/compasActions', () => ({
  compasCreateTripAction: (...args: unknown[]) => createTrip(...args),
}));

import { RouteCollabPageClient } from '../components/RouteCollabPageClient';
import { activityForRouteSport, buildAttachChoices, type AttachTripChoice } from '../attach';
import { readGuestWorkspace, saveGuestWorkspace } from '../guestDraft';
import { baseWorkspace } from '../insights/__tests__/fixtures';

const T1 = '11111111-2222-4333-8444-555555555551';
const T2 = '11111111-2222-4333-8444-555555555552';
const choices: AttachTripChoice[] = [
  { id: T1, title: 'Tour du lac', destinationName: 'Annecy', startDate: '2026-07-01', endDate: '2026-07-04', role: 'owner', hasRoute: false },
  { id: T2, title: 'GR20', destinationName: null, startDate: null, endDate: null, role: 'editor', hasRoute: true },
];

describe('1.1 choix des voyages (pur)', () => {
  it('ne garde que les voyages modifiables, ceux sans itinéraire d’abord, titre de repli', () => {
    const rows = [
      { id: 'a', title: 'Avec tracé', destination_name: null, start_date: null, end_date: null },
      { id: 'b', title: '  ', destination_name: 'Corse', start_date: null, end_date: null },
      { id: 'c', title: 'Lecture seule', destination_name: null, start_date: null, end_date: null },
    ];
    const roles = new Map([['a', 'owner'], ['b', 'editor'], ['c', 'viewer']]);
    const out = buildAttachChoices(rows, roles, new Set(['a']));
    expect(out.map((c) => c.id)).toEqual(['b', 'a']);
    expect(out[0].title).toBe('Corse');
    expect(out[1].hasRoute).toBe(true);
  });

  it('le profil de routage donne l’activité du voyage créé', () => {
    expect(activityForRouteSport('marche')).toBe('hiking');
    expect(activityForRouteSport('vtt')).toBe('cycling');
    expect(activityForRouteSport('enduro')).toBe('roadtrip');
  });
});

describe('1.1 écran « Rattacher à un voyage »', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearPendingRouteDraft();
    push.mockReset();
    createTrip.mockReset();
  });
  afterEach(() => cleanup());

  const draft = () =>
    baseWorkspace({
      id: 'ws-local-abc',
      tripId: 'unattached',
      sport: 'marche',
      title: 'Mon brouillon',
      sourceOrigin: { kind: 'gpx_import', importedAt: '2026-11-20T08:00:00.000Z', sourceTitle: 'sortie.gpx' },
      members: [{ userId: 'u1', displayName: 'Léa', role: 'owner' }],
    });

  it('connecté, sans ?trip= : la liste des voyages et « Nouveau voyage » remplacent l’espace flottant', async () => {
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} />);
    await waitFor(() => expect(screen.getByTestId('route-attach-screen')).toBeTruthy());
    expect(screen.getByTestId(`attach-trip-${T1}`).textContent).toContain('Tour du lac');
    expect(screen.getByTestId(`attach-trip-${T2}`).textContent).toContain('a déjà un itinéraire');
    expect(screen.getByTestId('attach-new-trip')).toBeTruthy();
    expect(screen.queryByTestId('route-start-screen')).toBeNull();
  });

  it('choisir un voyage : le brouillon (provenance comprise) est ré-étiqueté, puis ?trip=<id> s’ouvre', async () => {
    saveGuestWorkspace(draft());
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} />);
    await waitFor(() => expect(screen.getByTestId('attach-draft-note')).toBeTruthy());
    expect(screen.getByTestId('attach-draft-note').textContent).toContain('Mon GPX');
    fireEvent.click(screen.getByTestId(`attach-trip-${T1}`));
    expect(push).toHaveBeenCalledWith(`/compas/itineraire?trip=${T1}`);
    const kept = readGuestWorkspace(T1);
    expect(kept?.id).toBe('ws-local-abc');
    expect(kept?.tripId).toBe(T1);
    expect(kept?.sourceOrigin.kind).toBe('gpx_import');
  });

  it('« Nouveau voyage » appelle l’action du Compas puis ouvre le voyage créé', async () => {
    createTrip.mockResolvedValue({ success: true, slug: 'randonnee-ab12', id: T1 });
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={[]} />);
    await waitFor(() => expect(screen.getByTestId('attach-empty')).toBeTruthy());
    fireEvent.click(screen.getByTestId('attach-new-trip'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/compas/itineraire?trip=${T1}`));
    expect(createTrip).toHaveBeenCalledWith({ activity: 'hiking' });
  });

  it('création refusée : l’erreur est dite, aucune navigation', async () => {
    createTrip.mockResolvedValue({ success: false, error: 'Connexion requise.' });
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} />);
    await waitFor(() => expect(screen.getByTestId('attach-new-trip')).toBeTruthy());
    fireEvent.click(screen.getByTestId('attach-new-trip'));
    await waitFor(() => expect(screen.getByTestId('attach-error').textContent).toContain('Connexion requise'));
    expect(push).not.toHaveBeenCalled();
  });

  it('« Continuer sans voyage » ouvre le départ habituel, et propose encore le rattachement', async () => {
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} />);
    await waitFor(() => expect(screen.getByTestId('attach-skip')).toBeTruthy());
    fireEvent.click(screen.getByTestId('attach-skip'));
    await waitFor(() => expect(screen.getByTestId('route-start-screen')).toBeTruthy());
    fireEvent.click(screen.getByTestId('start-attach-action'));
    await waitFor(() => expect(screen.getByTestId('route-attach-screen')).toBeTruthy());
  });

  it('visiteur sans compte : on trace d’abord, le rattachement passe par la connexion', async () => {
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} />);
    await waitFor(() => expect(screen.getByTestId('route-start-screen')).toBeTruthy());
    expect(screen.queryByTestId('route-attach-screen')).toBeNull();
    expect(screen.getByTestId('start-attach-note').textContent).toContain('après connexion');
  });

  it('après la connexion, le brouillon tracé sans compte se voit proposer le rattachement', async () => {
    saveGuestWorkspace(draft());
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} />);
    await waitFor(() => expect(screen.getByTestId('route-attach-screen')).toBeTruthy());
    expect(screen.getByTestId('attach-draft-note').textContent).toContain('point');
  });

  it('avec un voyage dans l’adresse : pas d’écran de rattachement', async () => {
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={choices} tripLink="none" />);
    await waitFor(() => expect(screen.getByTestId('route-attach-screen')).toBeTruthy());
    cleanup();
    const trip = {
      tripId: T1, title: 'Tour du lac', destinationName: 'Annecy', countryCode: 'FR', anchor: null, days: 3,
      activity: null, sport: 'marche' as const, sportFrom: 'default' as const, routeDraft: null,
    };
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={null} trip={trip} tripLink="ok" />);
    await waitFor(() => expect(screen.getByTestId('route-start-screen')).toBeTruthy());
    expect(screen.queryByTestId('route-attach-screen')).toBeNull();
  });
});
