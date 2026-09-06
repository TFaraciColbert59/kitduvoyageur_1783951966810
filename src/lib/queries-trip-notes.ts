import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TripNote } from '@/features/trips/types/trip.types';

/**
 * 8.1 Récupérer les notes et récits d'un voyage
 */
export async function getTripNotes(tripId: string): Promise<TripNote[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_notes')
    .select(`
      id,
      trip_id,
      author_id,
      title,
      content,
      day_number,
      is_pinned,
      created_at,
      updated_at
    `)
    .eq('trip_id', tripId)
    .order('is_pinned', { ascending: false })
    .order('day_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[LKDV TripNotes] Erreur getTripNotes:', error);
    return [];
  }

  // Enrichir avec les profils auteurs
  const authorIds = Array.from(new Set((data || []).map(r => r.author_id)));
  const profileMap = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .in('id', authorIds);

    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, {
        full_name: p.full_name || p.username,
        avatar_url: p.avatar_url,
      });
    });
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    trip_id: row.trip_id,
    author_id: row.author_id,
    title: row.title,
    content: row.content,
    day_number: row.day_number,
    is_pinned: row.is_pinned,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: profileMap.get(row.author_id),
  }));
}

/**
 * 8.2 Ajouter une note / récit au carnet de bord
 */
export async function addTripNote(params: {
  tripId: string;
  authorId: string;
  content: string;
  title?: string | null;
  dayNumber?: number | null;
  isPinned?: boolean;
}): Promise<{ success: boolean; note?: TripNote; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_notes')
    .insert({
      trip_id: params.tripId,
      author_id: params.authorId,
      title: params.title || null,
      content: params.content,
      day_number: params.dayNumber || null,
      is_pinned: params.isPinned || false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[LKDV TripNotes] Erreur addTripNote:', error);
    return { success: false, error: error.message };
  }

  return { success: true, note: data as TripNote };
}

/**
 * 8.3 Mettre à jour une note
 */
export async function updateTripNote(params: {
  noteId: string;
  tripId: string;
  title?: string | null;
  content?: string;
  dayNumber?: number | null;
  isPinned?: boolean;
}): Promise<{ success: boolean; note?: TripNote; error?: string }> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) updates.title = params.title;
  if (params.content !== undefined) updates.content = params.content;
  if (params.dayNumber !== undefined) updates.day_number = params.dayNumber;
  if (params.isPinned !== undefined) updates.is_pinned = params.isPinned;

  const { data, error } = await supabase
    .from('trip_notes')
    .update(updates)
    .eq('id', params.noteId)
    .eq('trip_id', params.tripId)
    .select('*')
    .single();

  if (error) {
    console.error('[LKDV TripNotes] Erreur updateTripNote:', error);
    return { success: false, error: error.message };
  }

  return { success: true, note: data as TripNote };
}

/**
 * 8.4 Supprimer une note
 */
export async function deleteTripNote(
  noteId: string,
  tripId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_notes')
    .delete()
    .eq('id', noteId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[LKDV TripNotes] Erreur deleteTripNote:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
