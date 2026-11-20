import { beforeEach, expect, it, vi } from 'vitest';
import { openEventAdventure, saveEventAdventure } from '../eventHubActions';

const { resolve, activate, redirect, revalidate, rpc } = vi.hoisted(() => ({
  resolve: vi.fn(),
  activate: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/features/hub/server/resolveEventAdventure', () => ({ resolveEventAdventure: resolve }));
vi.mock('@/features/hub/context/activeAdventureServer', () => ({ setActiveAdventureAction: activate }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ rpc }) }));

const ref = { kind: 'club_event', id: 'abca11e0-2000-4000-8000-000000000001' } as const;
const trip = { id: 'abca11e0-3000-4000-8000-000000000001', slug: 'lien-aventure-club', title: 'Sortie du dimanche' };

beforeEach(() => vi.resetAllMocks());

it('revalide l’accès au clic et sélectionne l’ID canonique de la base', async () => {
  resolve.mockResolvedValue(trip);
  activate.mockResolvedValue({ success: true });
  await openEventAdventure(ref);
  expect(resolve).toHaveBeenCalledWith(ref);
  expect(activate).toHaveBeenCalledWith({ nature: 'sortie', ...trip });
  expect(redirect).toHaveBeenCalledWith('/hub');
});

it('ne sélectionne rien si l’inscription a été révoquée depuis l’affichage', async () => {
  resolve.mockResolvedValue(null);
  await expect(openEventAdventure(ref)).resolves.toEqual({ error: 'Cette aventure est indisponible.' });
  expect(activate).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

it('transmet l’ID choisi à l’organisateur et revalide la fiche et le HUB', async () => {
  const form = new FormData();
  form.set('tripId', trip.id);
  rpc.mockResolvedValue({ error: null });
  await expect(saveEventAdventure(ref, {}, form)).resolves.toEqual({ message: 'Aventure liée.' });
  expect(rpc).toHaveBeenCalledWith('set_event_trip', {
    p_source_kind: 'club_event', p_event_id: ref.id, p_trip_id: trip.id,
  });
  expect(revalidate).toHaveBeenCalledWith('/sorties/' + ref.id);
  expect(revalidate).toHaveBeenCalledWith('/hub', 'layout');
});

it('refuse un identifiant invalide et affiche un refus SQL de façon exploitable', async () => {
  const form = new FormData();
  form.set('tripId', 'le même titre');
  await expect(saveEventAdventure(ref, {}, form)).resolves.toEqual({ error: 'Sélection invalide.' });
  expect(rpc).not.toHaveBeenCalled();

  form.set('tripId', '');
  rpc.mockResolvedValue({ error: { code: '42501' } });
  await expect(saveEventAdventure(ref, {}, form)).resolves.toEqual({ error: 'Impossible de modifier l’aventure liée.' });
  expect(rpc).toHaveBeenCalledWith('set_event_trip', {
    p_source_kind: 'club_event', p_event_id: ref.id, p_trip_id: null,
  });
  expect(revalidate).not.toHaveBeenCalled();
});
