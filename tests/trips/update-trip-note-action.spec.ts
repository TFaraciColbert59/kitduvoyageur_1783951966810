/**
 * Task 13 — `updateTripNoteAction` : édition sur place d'une note.
 *
 *   (a) identifiants/contenu invalides → refus sans requête ;
 *   (b) session absente → refus sans requête ;
 *   (c) note introuvable / auteur non propriétaire / voyage d'autrui → refus ;
 *   (d) succès → `updateTripNote` appelé (contenu normalisé, note + voyage
 *       scopés) puis revalidation des vues ;
 *   (e) échec de mise à jour → erreur remontée, aucune revalidation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/queries-trip-notes', () => ({ updateTripNote: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateTripNote } from '@/lib/queries-trip-notes';
import { updateTripNoteAction } from '@/features/trips/actions/updateTripNoteAction';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '99999999-9999-4999-8999-999999999999';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

interface SessionOptions {
  user?: { id: string } | null;
  note?: Record<string, unknown> | null;
  noteError?: { message: string } | null;
  trip?: Record<string, unknown> | null;
  tripError?: { message: string } | null;
}

function createSession(options: SessionOptions) {
  return {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (table === 'trip_notes') {
          if (options.noteError) return { data: null, error: options.noteError };
          return { data: options.note ?? null, error: null };
        }
        if (table === 'trips') {
          if (options.tripError) return { data: null, error: options.tripError };
          return { data: options.trip ?? null, error: null };
        }
        return { data: null, error: null };
      };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => settle();
      return builder;
    },
  };
}

const NOTE = { id: NOTE_ID, trip_id: TRIP_ID, author_id: USER_ID };
const TRIP = { user_id: USER_ID, slug: 'tour-du-lac-blanc' };

const mockedCreateClient = vi.mocked(createClient);
const mockedUpdateTripNote = vi.mocked(updateTripNote);
const mockedRevalidate = vi.mocked(revalidatePath);

describe('updateTripNoteAction — action serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpdateTripNote.mockResolvedValue({ success: true });
  });

  it('(a) refuse une note invalide ou un contenu vide sans requête', async () => {
    const invalidId = await updateTripNoteAction('pas-un-uuid', 'Contenu');
    expect(invalidId).toEqual({ ok: false, error: 'Identifiant de note invalide' });

    const empty = await updateTripNoteAction(NOTE_ID, '   ');
    expect(empty).toEqual({ ok: false, error: 'Le contenu de la note est requis' });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) refuse une session absente sans toucher aux données', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);

    const result = await updateTripNoteAction(NOTE_ID, 'Contenu');

    expect(result).toEqual({ ok: false, error: 'Non authentifié' });
    expect(mockedUpdateTripNote).not.toHaveBeenCalled();
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('(c) refuse note introuvable, auteur différent ou voyage d’autrui', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID }, note: null }) as never);
    expect(await updateTripNoteAction(NOTE_ID, 'Contenu')).toEqual({
      ok: false,
      error: 'Note introuvable',
    });

    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID }, note: { ...NOTE, author_id: OTHER_ID } }) as never
    );
    expect(await updateTripNoteAction(NOTE_ID, 'Contenu')).toEqual({
      ok: false,
      error: 'Permission refusée',
    });

    mockedCreateClient.mockResolvedValue(
      createSession({
        user: { id: USER_ID },
        note: NOTE,
        trip: { ...TRIP, user_id: OTHER_ID },
      }) as never
    );
    expect(await updateTripNoteAction(NOTE_ID, 'Contenu')).toEqual({
      ok: false,
      error: 'Permission refusée',
    });
    expect(mockedUpdateTripNote).not.toHaveBeenCalled();
  });

  it('(d) succès → contenu normalisé, note + voyage vérifiés, vues revalidées', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID }, note: NOTE, trip: TRIP }) as never
    );

    const result = await updateTripNoteAction(NOTE_ID, '  Récit du jour 1  ');

    expect(result).toEqual({ ok: true });
    expect(mockedUpdateTripNote).toHaveBeenCalledWith({
      noteId: NOTE_ID,
      tripId: TRIP_ID,
      content: 'Récit du jour 1',
    });
    expect(mockedRevalidate).toHaveBeenCalledWith('/voyages/tour-du-lac-blanc');
    expect(mockedRevalidate).toHaveBeenCalledWith('/hub/itineraire');
  });

  it('(e) échec de mise à jour → erreur remontée, aucune revalidation', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID }, note: NOTE, trip: TRIP }) as never
    );
    mockedUpdateTripNote.mockResolvedValue({ success: false, error: 'permission denied' });

    const result = await updateTripNoteAction(NOTE_ID, 'Contenu');

    expect(result).toEqual({ ok: false, error: 'permission denied' });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});
