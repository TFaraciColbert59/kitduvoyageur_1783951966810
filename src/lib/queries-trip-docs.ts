import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TripDocument, TripDocumentCategory } from '@/features/trips/types/trip.types';

/**
 * 7.3.1 Récupérer les documents d'un voyage (strictement protégés par RLS)
 */
export async function getTripDocuments(tripId: string): Promise<TripDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_documents')
    .select(`
      id,
      trip_id,
      user_id,
      title,
      category,
      file_url,
      file_name,
      file_size_bytes,
      mime_type,
      expires_at,
      notes,
      created_at,
      updated_at
    `)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[LKDV Docs] Erreur getTripDocuments:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.user_id,
    title: row.title,
    category: row.category as TripDocumentCategory,
    file_url: row.file_url,
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    expires_at: row.expires_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * 7.3.2 Ajouter un document sécurisé sur un voyage
 */
export async function addTripDocument(input: {
  trip_id: string;
  user_id: string;
  title: string;
  category: TripDocumentCategory;
  file_url: string;
  file_name?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}): Promise<TripDocument | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      trip_id: input.trip_id,
      user_id: input.user_id,
      title: input.title,
      category: input.category,
      file_url: input.file_url,
      file_name: input.file_name || null,
      expires_at: input.expires_at || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[LKDV Docs] Erreur addTripDocument:', error);
    return null;
  }

  return {
    id: data.id,
    trip_id: data.trip_id,
    user_id: data.user_id,
    title: data.title,
    category: data.category as TripDocumentCategory,
    file_url: data.file_url,
    file_name: data.file_name,
    file_size_bytes: data.file_size_bytes,
    mime_type: data.mime_type,
    expires_at: data.expires_at,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * 7.3.3 Supprimer un document de voyage
 */
export async function deleteTripDocument(tripId: string, documentId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_documents')
    .delete()
    .eq('id', documentId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[LKDV Docs] Erreur deleteTripDocument:', error);
    return false;
  }

  return true;
}
