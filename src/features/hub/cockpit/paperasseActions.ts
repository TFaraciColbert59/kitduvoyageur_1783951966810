'use server';

import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(['passport', 'insurance', 'booking', 'ticket', 'medical', 'other']);

export type CreateCockpitDocumentResult =
  | { ok: true; document: { id: string; title: string; category: string; expiration: string | null } }
  | { ok: false; message: string };

export async function createCockpitDocument(input: {
  tripId: string;
  title: string;
  category: string;
  reference?: string;
  expiration?: string | null;
}): Promise<CreateCockpitDocumentResult> {
  if (!UUID.test(input.tripId)) return { ok: false, message: 'Voyage introuvable.' };
  const title = input.title.trim().slice(0, 120);
  if (title.length < 2) return { ok: false, message: 'Indique un intitulé de document ou billet.' };
  const category = CATEGORIES.has(input.category) ? input.category : 'booking';
  const expiresAt = input.expiration && DATE_RE.test(input.expiration) ? input.expiration : null;
  const reference = input.reference?.trim().slice(0, 200) || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      trip_id: input.tripId,
      user_id: user.id,
      title,
      category,
      file_url: `hub-ref://${category}/${encodeURIComponent(reference ?? title)}`,
      notes: reference,
      expires_at: expiresAt,
    })
    .select('id,title,category,expires_at')
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === '42501'
        ? 'Droits insuffisants pour ajouter un document.'
        : 'Impossible d’enregistrer cette confirmation.',
    };
  }

  return {
    ok: true,
    document: {
      id: data.id,
      title: data.title,
      category: data.category,
      expiration: data.expires_at,
    },
  };
}
