'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const POSITION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSION_HOURS = 72;

export interface LiveSessionInfo {
  id: string;
  startedBy: string | null;
  startedAt: string;
  expiresAt: string;
}

export interface LiveMemberPosition {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  updatedAt: string;
}

export type StartLiveSessionResult =
  | { ok: true; session: LiveSessionInfo }
  | { ok: false; error: string };

export type LiveActionResult = { ok: true } | { ok: false; error: string };

export type GetLiveStateResult =
  | {
      ok: true;
      session: LiveSessionInfo | null;
      mySharing: boolean;
      positions: LiveMemberPosition[];
    }
  | { ok: false; error: string };

const StartSchema = z.object({
  groupId: z.string().uuid(),
  durationHours: z.number().int().min(1).max(MAX_SESSION_HOURS),
});

const ShareSchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10000).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
});

const SessionIdSchema = z.object({ sessionId: z.string().uuid() });

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Demarre une session live (opt-in explicite). Ferme d'abord les sessions expirees. */
export async function startLiveSession(input: {
  groupId: string;
  durationHours: number;
}): Promise<StartLiveSessionResult> {
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Durée invalide (1 à 72 h).' };
  }
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const nowIso = new Date().toISOString();

  await supabase
    .from('group_live_sessions')
    .update({ stopped_at: nowIso })
    .eq('group_id', parsed.data.groupId)
    .is('stopped_at', null)
    .lt('expires_at', nowIso);

  const { data: active } = await supabase
    .from('group_live_sessions')
    .select('id')
    .eq('group_id', parsed.data.groupId)
    .is('stopped_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (active) {
    return { ok: false, error: 'Une sortie live est déjà ouverte pour ce groupe.' };
  }

  const expiresAt = new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000).toISOString();
  const { data: session, error } = await supabase
    .from('group_live_sessions')
    .insert({
      group_id: parsed.data.groupId,
      started_by: user.id,
      expires_at: expiresAt,
    })
    .select('id, started_by, started_at, expires_at')
    .single();

  if (error || !session) {
    console.error('[tribu-live/startLiveSession]', error);
    return { ok: false, error: 'Démarrage impossible pour le moment.' };
  }

  const row = session as {
    id: string;
    started_by: string | null;
    started_at: string;
    expires_at: string;
  };
  return {
    ok: true,
    session: {
      id: row.id,
      startedBy: row.started_by,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
    },
  };
}

/** Cloture une session (starter ou manage_members). Les positions expirent d'elles-memes. */
export async function stopLiveSession(input: { sessionId: string }): Promise<LiveActionResult> {
  const parsed = SessionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { error } = await supabase
    .from('group_live_sessions')
    .update({ stopped_at: new Date().toISOString() })
    .eq('id', parsed.data.sessionId);
  if (error) {
    console.error('[tribu-live/stopLiveSession]', error);
    return { ok: false, error: 'Clôture impossible (droits insuffisants ?).' };
  }
  return { ok: true };
}

/** Partage (upsert) de la position du membre, TTL 15 min. */
export async function sharePosition(input: {
  sessionId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  heading?: number | null;
}): Promise<LiveActionResult> {
  const parsed = ShareSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Position invalide.' };
  }
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const nowIso = new Date().toISOString();
  const { data: session } = await supabase
    .from('group_live_sessions')
    .select('id, stopped_at, expires_at')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();
  const row = session as { stopped_at: string | null; expires_at: string } | null;
  if (!row || row.stopped_at !== null || row.expires_at <= nowIso) {
    return { ok: false, error: 'Sortie live fermée ou expirée.' };
  }

  const { error } = await supabase.from('group_live_positions').upsert(
    {
      session_id: parsed.data.sessionId,
      user_id: user.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracy_m: parsed.data.accuracyM ?? null,
      heading: parsed.data.heading ?? null,
      updated_at: nowIso,
      expires_at: new Date(Date.now() + POSITION_TTL_MS).toISOString(),
    },
    { onConflict: 'session_id,user_id' }
  );
  if (error) {
    console.error('[tribu-live/sharePosition]', error);
    return { ok: false, error: 'Partage impossible pour le moment.' };
  }
  return { ok: true };
}

/** Arret immediat du partage de sa propre position (suppression, zero historique). */
export async function stopSharingPosition(input: { sessionId: string }): Promise<LiveActionResult> {
  const parsed = SessionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { error } = await supabase
    .from('group_live_positions')
    .delete()
    .eq('session_id', parsed.data.sessionId)
    .eq('user_id', user.id);
  if (error) {
    console.error('[tribu-live/stopSharingPosition]', error);
    return { ok: false, error: 'Arrêt impossible pour le moment.' };
  }
  return { ok: true };
}

/** Etat live du groupe : session ouverte, mon partage, positions des membres. */
export async function getLiveState(groupId: string): Promise<GetLiveStateResult> {
  if (!z.string().uuid().safeParse(groupId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const nowIso = new Date().toISOString();
  const { data: session } = await supabase
    .from('group_live_sessions')
    .select('id, started_by, started_at, expires_at')
    .eq('group_id', groupId)
    .is('stopped_at', null)
    .gt('expires_at', nowIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { ok: true, session: null, mySharing: false, positions: [] };
  }
  const row = session as {
    id: string;
    started_by: string | null;
    started_at: string;
    expires_at: string;
  };

  const { data: positions } = await supabase
    .from('group_live_positions')
    .select('user_id, lat, lng, updated_at')
    .eq('session_id', row.id)
    .order('updated_at', { ascending: false });

  const rows = (positions ?? []) as Array<{
    user_id: string;
    lat: number;
    lng: number;
    updated_at: string;
  }>;

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url')
    .in('id', rows.map((r) => r.user_id));

  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(
      (p) => [p.id, p]
    )
  );

  return {
    ok: true,
    session: {
      id: row.id,
      startedBy: row.started_by,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
    },
    mySharing: rows.some((r) => r.user_id === user.id),
    positions: rows.map((r) => ({
      userId: r.user_id,
      name: profileMap.get(r.user_id)?.full_name || 'Voyageur',
      avatarUrl: profileMap.get(r.user_id)?.avatar_url ?? null,
      lat: Number(r.lat),
      lng: Number(r.lng),
      updatedAt: r.updated_at,
    })),
  };
}
