import { createClient } from '@/lib/supabase/client';

/**
 * Paramètres d'entrée de `/messagerie`.
 *
 * Trois formes existent dans l'app, et une seule était traitée :
 *   - `?conversation=<uuid>` — ouvre une discussion existante (supporté) ;
 *   - `?dest=<uuid>` — ouvre (ou crée) le DM avec ce profil (supporté) ;
 *   - `?to=<handle>` — lien « Message » des profils publics et des lignes de
 *     réseau (`PublicProfileV2`, `UserRow`) : **ignoré jusqu'ici**. On le résout
 *     en identifiant avant d'appliquer le chemin `dest`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MessageDeepLink {
  conversationId: string | null;
  recipientId: string | null;
  handle: string | null;
}

/** Analyse pure de la query string : aucune requête, testable sans réseau. */
export function parseMessageDeepLink(search: string): MessageDeepLink {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const conversation = params.get('conversation');
  const dest = params.get('dest');
  const to = params.get('to');
  return {
    conversationId: conversation && UUID_RE.test(conversation) ? conversation : null,
    recipientId: dest && UUID_RE.test(dest) ? dest : null,
    handle: to ? normaliseHandle(to) : null,
  };
}

export function normaliseHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(handle)) return null;
  return handle;
}

/**
 * Résout un `handle` public en identifiant de profil. Renvoie `null` si le
 * profil n'existe pas (jamais de faux destinataire).
 */
export async function resolveHandleToUserId(handle: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, handle')
    .ilike('handle', handle)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}
