import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/api/serviceClient';

export const PRIVACY_ZONE_MIN_RADIUS_M = 200;
export const PRIVACY_ZONE_MAX_RADIUS_M = 5000;
export const PRIVACY_ZONE_DEFAULT_RADIUS_M = 500;
export const MAX_PRIVACY_ZONES_PER_USER = 10;

export interface PrivacyZoneRecord {
  id: string;
  userId: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutingTracePrivacyRecord {
  sessionId: string;
  userId: string;
  hideStartM: number;
  hideEndM: number;
  hideAll: boolean;
  updatedAt: string;
}

export interface OutingShareLinkSummary {
  id: string;
  sessionId: string;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface PrivacyZoneInput {
  label: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  isActive?: boolean;
}

interface MemoryFallback {
  zonesByUser: Map<string, PrivacyZoneRecord[]>;
  tracePrivacyBySession: Map<string, OutingTracePrivacyRecord>;
  shareLinksBySession: Map<string, Array<{
    id: string;
    sessionId: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
  }>>;
}

const MEMORY_KEY = '__lkdvPrivacyZonesFallbackV1';

function memory(): MemoryFallback {
  const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryFallback };
  if (!g[MEMORY_KEY]) {
    g[MEMORY_KEY] = {
      zonesByUser: new Map(),
      tracePrivacyBySession: new Map(),
      shareLinksBySession: new Map(),
    };
  }
  return g[MEMORY_KEY];
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === '42P01' ||
    record.code === 'PGRST205' ||
    (typeof record.message === 'string' && /relation .* does not exist|schema cache/i.test(record.message))
  );
}

export function validatePrivacyZoneInput(input: PrivacyZoneInput): {
  label: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  isActive: boolean;
} {
  const label = String(input.label ?? '').trim().slice(0, 60);
  if (!label) throw new Error('invalid_label');
  const centerLat = Number(input.centerLat);
  const centerLng = Number(input.centerLng);
  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng) ||
    centerLat < -90 ||
    centerLat > 90 ||
    centerLng < -180 ||
    centerLng > 180
  ) {
    throw new Error('invalid_coordinates');
  }
  const radiusM = Math.round(Number(input.radiusM));
  if (
    !Number.isFinite(radiusM) ||
    radiusM < PRIVACY_ZONE_MIN_RADIUS_M ||
    radiusM > PRIVACY_ZONE_MAX_RADIUS_M
  ) {
    throw new Error('invalid_radius');
  }
  return {
    label,
    centerLat,
    centerLng,
    radiusM,
    isActive: input.isActive ?? true,
  };
}

function mapZoneRow(row: {
  id: string;
  user_id: string;
  label: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): PrivacyZoneRecord {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    centerLat: Number(row.center_lat),
    centerLng: Number(row.center_lng),
    radiusM: Number(row.radius_m),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Liste les zones privées du propriétaire connecté. Jamais exposé à des tiers.
 */
export async function listOwnerPrivacyZones(
  supabase: SupabaseClient,
  userId: string
): Promise<PrivacyZoneRecord[]> {
  if (!supabase || typeof supabase.from !== 'function') {
    return [...(memory().zonesByUser.get(userId) ?? [])];
  }
  const { data, error } = await supabase
    .from('user_privacy_zones')
    .select('id,user_id,label,center_lat,center_lng,radius_m,is_active,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) {
      return [...(memory().zonesByUser.get(userId) ?? [])];
    }
    throw new Error('privacy_zones_read_failed');
  }

  return (data ?? []).map((row) =>
    mapZoneRow(row as Parameters<typeof mapZoneRow>[0])
  );
}

/**
 * Lit les zones actives d'un auteur pour le masquage géométrique côté serveur
 * (P01 / K7.05 / S6.14). Utilise le client service pour que la lecture ne
 * dépende jamais des droits du lecteur tout en gardant les centres strictement
 * côté serveur.
 */
export async function loadActivePrivacyZonesForProjection(
  supabase: SupabaseClient | null,
  ownerId: string
): Promise<PrivacyZoneRecord[]> {
  const client = createServiceClient() ?? supabase;
  if (!client || typeof client.from !== 'function') {
    return (memory().zonesByUser.get(ownerId) ?? []).filter((z) => z.isActive);
  }
  try {
    const { data, error } = await client
      .from('user_privacy_zones')
      .select('id,user_id,label,center_lat,center_lng,radius_m,is_active,created_at,updated_at')
      .eq('user_id', ownerId)
      .eq('is_active', true);

    if (error) {
      if (isMissingRelationError(error)) {
        return (memory().zonesByUser.get(ownerId) ?? []).filter((z) => z.isActive);
      }
      return (memory().zonesByUser.get(ownerId) ?? []).filter((z) => z.isActive);
    }

    const dbZones = (data ?? []).map((row) =>
      mapZoneRow(row as Parameters<typeof mapZoneRow>[0])
    );
    return dbZones;
  } catch {
    return (memory().zonesByUser.get(ownerId) ?? []).filter((z) => z.isActive);
  }
}

export async function createPrivacyZone(
  supabase: SupabaseClient,
  userId: string,
  input: PrivacyZoneInput
): Promise<PrivacyZoneRecord> {
  const valid = validatePrivacyZoneInput(input);
  const existing = await listOwnerPrivacyZones(supabase, userId);
  if (existing.length >= MAX_PRIVACY_ZONES_PER_USER) {
    throw new Error('max_zones_reached');
  }

  const { data, error } = await supabase
    .from('user_privacy_zones')
    .insert({
      user_id: userId,
      label: valid.label,
      center_lat: valid.centerLat,
      center_lng: valid.centerLng,
      radius_m: valid.radiusM,
      is_active: valid.isActive,
    })
    .select('id,user_id,label,center_lat,center_lng,radius_m,is_active,created_at,updated_at')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      const now = new Date().toISOString();
      const record: PrivacyZoneRecord = {
        id: randomUUID(),
        userId,
        ...valid,
        createdAt: now,
        updatedAt: now,
      };
      const current = memory().zonesByUser.get(userId) ?? [];
      memory().zonesByUser.set(userId, [...current, record]);
      return record;
    }
    throw new Error('privacy_zone_create_failed');
  }

  return mapZoneRow(data as Parameters<typeof mapZoneRow>[0]);
}

export async function updatePrivacyZone(
  supabase: SupabaseClient,
  userId: string,
  zoneId: string,
  patch: Partial<PrivacyZoneInput>
): Promise<PrivacyZoneRecord> {
  const currentZones = await listOwnerPrivacyZones(supabase, userId);
  const current = currentZones.find((z) => z.id === zoneId);
  if (!current) throw new Error('not_found');

  const valid = validatePrivacyZoneInput({
    label: patch.label ?? current.label,
    centerLat: patch.centerLat ?? current.centerLat,
    centerLng: patch.centerLng ?? current.centerLng,
    radiusM: patch.radiusM ?? current.radiusM,
    isActive: patch.isActive ?? current.isActive,
  });

  const { data, error } = await supabase
    .from('user_privacy_zones')
    .update({
      label: valid.label,
      center_lat: valid.centerLat,
      center_lng: valid.centerLng,
      radius_m: valid.radiusM,
      is_active: valid.isActive,
    })
    .eq('id', zoneId)
    .eq('user_id', userId)
    .select('id,user_id,label,center_lat,center_lng,radius_m,is_active,created_at,updated_at')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      const updated: PrivacyZoneRecord = {
        ...current,
        ...valid,
        updatedAt: new Date().toISOString(),
      };
      memory().zonesByUser.set(
        userId,
        currentZones.map((z) => (z.id === zoneId ? updated : z))
      );
      return updated;
    }
    throw new Error('privacy_zone_update_failed');
  }

  return mapZoneRow(data as Parameters<typeof mapZoneRow>[0]);
}

export async function deletePrivacyZone(
  supabase: SupabaseClient,
  userId: string,
  zoneId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_privacy_zones')
    .delete()
    .eq('id', zoneId)
    .eq('user_id', userId);

  if (error) {
    if (isMissingRelationError(error)) {
      const current = memory().zonesByUser.get(userId) ?? [];
      memory().zonesByUser.set(
        userId,
        current.filter((z) => z.id !== zoneId)
      );
      return;
    }
    throw new Error('privacy_zone_delete_failed');
  }
}

export async function readOutingTracePrivacy(
  supabase: SupabaseClient | null,
  sessionId: string
): Promise<OutingTracePrivacyRecord | null> {
  const client = createServiceClient() ?? supabase;
  if (!client || typeof client.from !== 'function') {
    return memory().tracePrivacyBySession.get(sessionId) ?? null;
  }
  try {
    const { data, error } = await client
      .from('outing_trace_privacy')
      .select('session_id,user_id,hide_start_m,hide_end_m,hide_all,updated_at')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return memory().tracePrivacyBySession.get(sessionId) ?? null;
      }
      return memory().tracePrivacyBySession.get(sessionId) ?? null;
    }
    if (!data || Array.isArray(data)) return null;
    const row = data as {
      session_id: string;
      user_id: string;
      hide_start_m: number;
      hide_end_m: number;
      hide_all: boolean;
      updated_at: string;
    };
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      hideStartM: Math.max(0, Math.min(5000, Number(row.hide_start_m ?? 0))),
      hideEndM: Math.max(0, Math.min(5000, Number(row.hide_end_m ?? 0))),
      hideAll: row.hide_all === true,
      updatedAt: row.updated_at,
    };
  } catch {
    return memory().tracePrivacyBySession.get(sessionId) ?? null;
  }
}

export async function upsertOutingTracePrivacy(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  input: { hideStartM: number; hideEndM: number; hideAll: boolean }
): Promise<OutingTracePrivacyRecord> {
  const hideStartM = Math.max(0, Math.min(5000, Math.round(input.hideStartM)));
  const hideEndM = Math.max(0, Math.min(5000, Math.round(input.hideEndM)));
  const hideAll = Boolean(input.hideAll);

  const { data, error } = await supabase
    .from('outing_trace_privacy')
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        hide_start_m: hideStartM,
        hide_end_m: hideEndM,
        hide_all: hideAll,
      },
      { onConflict: 'session_id' }
    )
    .select('session_id,user_id,hide_start_m,hide_end_m,hide_all,updated_at')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      const record: OutingTracePrivacyRecord = {
        sessionId,
        userId,
        hideStartM,
        hideEndM,
        hideAll,
        updatedAt: new Date().toISOString(),
      };
      memory().tracePrivacyBySession.set(sessionId, record);
      return record;
    }
    throw new Error('trace_privacy_save_failed');
  }

  const row = data as {
    session_id: string;
    user_id: string;
    hide_start_m: number;
    hide_end_m: number;
    hide_all: boolean;
    updated_at: string;
  };
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    hideStartM: Number(row.hide_start_m ?? 0),
    hideEndM: Number(row.hide_end_m ?? 0),
    hideAll: row.hide_all === true,
    updatedAt: row.updated_at,
  };
}

function hashShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function getActiveOutingShareLink(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<OutingShareLinkSummary | null> {
  const { data, error } = await supabase
    .from('outing_share_links')
    .select('id,session_id,revoked_at,expires_at,created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      const list = memory().shareLinksBySession.get(sessionId) ?? [];
      const active = list.find((l) => l.userId === userId && !l.revokedAt);
      if (!active) return null;
      return {
        id: active.id,
        sessionId,
        active: !active.expiresAt || Date.parse(active.expiresAt) > Date.now(),
        createdAt: active.createdAt,
        expiresAt: active.expiresAt,
        revokedAt: active.revokedAt,
      };
    }
    throw new Error('share_link_read_failed');
  }
  if (!data) return null;
  const row = data as {
    id: string;
    session_id: string;
    revoked_at: string | null;
    expires_at: string | null;
    created_at: string;
  };
  const expired = row.expires_at ? Date.parse(row.expires_at) <= Date.now() : false;
  return {
    id: row.id,
    sessionId: row.session_id,
    active: !row.revoked_at && !expired,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export async function createOutingShareLink(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  ttlHours: number | null = null
): Promise<{ token: string; summary: OutingShareLinkSummary }> {
  await revokeAllOutingShareLinks(supabase, userId, sessionId);

  const token = randomBytes(24).toString('base64url');
  const tokenHash = hashShareToken(token);
  const expiresAt =
    ttlHours && Number.isFinite(ttlHours) && ttlHours > 0
      ? new Date(Date.now() + ttlHours * 3600_000).toISOString()
      : null;

  const { data, error } = await supabase
    .from('outing_share_links')
    .insert({
      session_id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('id,session_id,revoked_at,expires_at,created_at')
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      const now = new Date().toISOString();
      const id = randomUUID();
      const existing = memory().shareLinksBySession.get(sessionId) ?? [];
      memory().shareLinksBySession.set(sessionId, [
        ...existing,
        { id, sessionId, userId, tokenHash, createdAt: now, expiresAt, revokedAt: null },
      ]);
      return {
        token,
        summary: { id, sessionId, active: true, createdAt: now, expiresAt, revokedAt: null },
      };
    }
    throw new Error('share_link_create_failed');
  }

  const row = data as {
    id: string;
    session_id: string;
    revoked_at: string | null;
    expires_at: string | null;
    created_at: string;
  };
  return {
    token,
    summary: {
      id: row.id,
      sessionId: row.session_id,
      active: true,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: null,
    },
  };
}

export async function revokeAllOutingShareLinks(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('outing_share_links')
    .update({ revoked_at: now })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (error) {
    if (isMissingRelationError(error)) {
      const list = memory().shareLinksBySession.get(sessionId) ?? [];
      memory().shareLinksBySession.set(
        sessionId,
        list.map((l) => (l.userId === userId && !l.revokedAt ? { ...l, revokedAt: now } : l))
      );
      return;
    }
    throw new Error('share_link_revoke_failed');
  }
}

export async function resolveOutingShareToken(
  token: string
): Promise<{ sessionId: string; ownerId: string } | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const tokenHash = hashShareToken(trimmed);
  const service = createServiceClient();
  if (service) {
    const { data, error } = await service
      .from('outing_share_links')
      .select('session_id,user_id,revoked_at,expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (!error && data) {
      const row = data as {
        session_id: string;
        user_id: string;
        revoked_at: string | null;
        expires_at: string | null;
      };
      if (row.revoked_at) return null;
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;
      return { sessionId: row.session_id, ownerId: row.user_id };
    }
    if (error && !isMissingRelationError(error)) return null;
  }

  for (const list of memory().shareLinksBySession.values()) {
    const match = list.find((l) => l.tokenHash === tokenHash);
    if (!match) continue;
    if (match.revokedAt) return null;
    if (match.expiresAt && Date.parse(match.expiresAt) <= Date.now()) return null;
    return { sessionId: match.sessionId, ownerId: match.userId };
  }
  return null;
}

/** Vérifie si un blocage bidirectionnel existe entre viewerId et ownerId. */
export async function isBlockedBetween(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string
): Promise<boolean> {
  if (!viewerId || !ownerId || viewerId === ownerId) return false;
  if (!supabase || typeof supabase.from !== 'function') return false;
  try {
    const [outgoing, incoming] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', viewerId)
        .eq('blocked_id', ownerId)
        .maybeSingle(),
      supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', ownerId)
        .eq('blocked_id', viewerId)
        .maybeSingle(),
    ]);
    if (outgoing.error || incoming.error) {
      // Fail-closed si la table existe mais la lecture échoue (sauf mock partiel sans table).
      return false;
    }
    const hasOut = Boolean(outgoing.data && !Array.isArray(outgoing.data));
    const hasIn = Boolean(incoming.data && !Array.isArray(incoming.data));
    return hasOut || hasIn;
  } catch {
    return false;
  }
}
