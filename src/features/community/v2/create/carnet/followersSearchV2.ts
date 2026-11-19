'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SubscriberProfileV2 {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

/**
 * Normalise une chaîne pour filtrer côté client sans sensibilité à la casse
 * ni aux accents.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Récupère **uniquement les abonnés / abonnements réels** de l'utilisateur
 * connecté (`user_follows` -> `public_profiles`, complété par
 * `/api/users/search?scope=friends` pour garantir la projection publique et les
 * avatars), sans jamais exposer des profils hors cercle d'abonnés.
 */
export async function fetchSubscribersOnlyV2(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriberProfileV2[]> {
  if (!userId) return [];

  const byId = new Map<string, SubscriberProfileV2>();

  // 1) Abonnements (personnes suivies par l'utilisateur) via l'API serveur officielle
  try {
    const res = await fetch('/api/users/search?scope=friends&limit=25', {
      credentials: 'same-origin',
    });
    if (res.ok) {
      const payload = (await res.json()) as {
        users?: Array<{
          id?: string;
          fullName?: string | null;
          avatarUrl?: string | null;
        }>;
      };
      for (const u of payload.users ?? []) {
        if (!u?.id || u.id === userId) continue;
        byId.set(String(u.id), {
          id: String(u.id),
          name: String(u.fullName || '').trim() || 'Voyageur',
          handle: null,
          avatarUrl: typeof u.avatarUrl === 'string' && u.avatarUrl.trim() ? u.avatarUrl : null,
        });
      }
    }
  } catch {
    /* fallback requête directe ci-dessous */
  }

  // 2) Abonnés réels (followers qui suivent l'utilisateur + abonnements + handle)
  try {
    const [{ data: followers }, { data: following }] = await Promise.all([
      supabase.from('user_follows').select('follower_id').eq('following_id', userId).limit(50),
      supabase.from('user_follows').select('following_id').eq('follower_id', userId).limit(50),
    ]);

    const ids = new Set<string>();
    for (const row of followers ?? []) {
      const fid = (row as { follower_id?: unknown }).follower_id;
      if (typeof fid === 'string' && fid && fid !== userId) ids.add(fid);
    }
    for (const row of following ?? []) {
      const gid = (row as { following_id?: unknown }).following_id;
      if (typeof gid === 'string' && gid && gid !== userId) ids.add(gid);
    }

    if (ids.size > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, handle, full_name, avatar_url')
        .in('id', [...ids]);

      for (const row of profiles ?? []) {
        const rec = row as Record<string, unknown>;
        const id = typeof rec.id === 'string' ? rec.id : '';
        if (!id || id === userId) continue;
        const fullName = typeof rec.full_name === 'string' ? rec.full_name.trim() : '';
        const handle = typeof rec.handle === 'string' && rec.handle.trim() ? rec.handle.trim() : null;
        const avatarUrl =
          typeof rec.avatar_url === 'string' && rec.avatar_url.trim() ? rec.avatar_url.trim() : null;
        const prev = byId.get(id);
        byId.set(id, {
          id,
          name: fullName || (handle ? `@${handle}` : prev?.name || 'Voyageur'),
          handle: handle ?? prev?.handle ?? null,
          avatarUrl: avatarUrl ?? prev?.avatarUrl ?? null,
        });
      }
    }
  } catch {
    /* conserve la liste déjà chargée via /api/users/search */
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
