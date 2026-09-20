import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface DeclaredTerritoryInput {
  city_code?: string | null;
  region_code?: string | null;
  country_code?: string | null;
  city_name?: string | null;
}

export interface PrivateAttachmentInput {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  consent?: boolean;
  correction?: boolean;
}

export interface TerritoryState {
  declared: {
    cityName: string | null;
    cityCode: string | null;
    regionCode: string | null;
    countryCode: string | null;
    source: string;
    updatedAt: string | null;
  } | null;
  privateAttachment: {
    present: boolean;
    consentAt: string | null;
    lockedUntil: string | null;
    locked: boolean;
  };
}

export type TerritoryWriteResult =
  | { ok: true; declared: TerritoryState['declared'] }
  | { ok: true; privateAttachment: TerritoryState['privateAttachment'] }
  | { ok: false; error: 'consent_required' | 'invalid_coordinates' | 'lock_active' | 'correction_limit' | 'territory_locked_24h' };

const CORRECTION_WINDOW_DAYS = 30;

function createTerritoryServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour le territoire.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidLat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLng(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export async function getTerritoryState(userId: string): Promise<TerritoryState> {
  const supabase = createTerritoryServiceClient();

  const [declaredRes, privateRes] = await Promise.all([
    supabase
      .from('user_territory')
      .select('city_name, city_code, region_code, country_code, source, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_territory_private')
      .select('consent_at, locked_until')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (declaredRes.error) throw declaredRes.error;
  if (privateRes.error) throw privateRes.error;

  const declaredRow = declaredRes.data as {
    city_name: string | null;
    city_code: string | null;
    region_code: string | null;
    country_code: string | null;
    source: string;
    updated_at: string | null;
  } | null;

  const privateRow = privateRes.data as {
    consent_at: string | null;
    locked_until: string | null;
  } | null;

  const lockedUntil = privateRow?.locked_until ?? null;
  return {
    declared: declaredRow
      ? {
          cityName: declaredRow.city_name,
          cityCode: declaredRow.city_code,
          regionCode: declaredRow.region_code,
          countryCode: declaredRow.country_code,
          source: declaredRow.source,
          updatedAt: declaredRow.updated_at,
        }
      : null,
    privateAttachment: {
      present: privateRow !== null,
      consentAt: privateRow?.consent_at ?? null,
      lockedUntil,
      locked: lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now(),
    },
  };
}

export async function updateDeclaredTerritory(
  userId: string,
  input: DeclaredTerritoryInput
): Promise<TerritoryWriteResult> {
  const supabase = createTerritoryServiceClient();
  const countryCode = normalizeCode(input.country_code);
  const nextCity = normalizeCode(input.city_code);
  const nextRegion = normalizeCode(input.region_code);

  // Anti-manipulation de classement : un changement réel de ville/région/pays
  // est plafonné à un par 24 h et journalisé ; re-soumettre l'identique est libre.
  const { data: current } = await supabase
    .from('user_territory')
    .select('city_code, region_code, country_code')
    .eq('user_id', userId)
    .maybeSingle();

  const unchanged =
    current !== null &&
    (current.city_code ?? null) === nextCity &&
    (current.region_code ?? null) === nextRegion &&
    (current.country_code ?? 'FR') === (countryCode ?? 'FR');

  if (current !== null && !unchanged) {
    const { data: lastChange } = await supabase
      .from('territory_change_log')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      lastChange?.created_at &&
      Date.now() - new Date(lastChange.created_at).getTime() < 24 * 60 * 60 * 1000
    ) {
      return { ok: false, error: 'territory_locked_24h' };
    }
    await supabase.from('territory_change_log').insert({
      user_id: userId,
      reason: 'declared_territory_change',
    });
  }

  const { data, error } = await supabase
    .from('user_territory')
    .upsert(
      {
        user_id: userId,
        country_code: countryCode ?? 'FR',
        city_code: nextCity,
        region_code: nextRegion,
        city_name: normalizeCode(input.city_name),
        source: 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('city_name, city_code, region_code, country_code, source, updated_at')
    .maybeSingle();

  if (error) throw error;

  const row = data as {
    city_name: string | null;
    city_code: string | null;
    region_code: string | null;
    country_code: string | null;
    source: string;
    updated_at: string | null;
  } | null;

  return {
    ok: true,
    declared: row
      ? {
          cityName: row.city_name,
          cityCode: row.city_code,
          regionCode: row.region_code,
          countryCode: row.country_code,
          source: row.source,
          updatedAt: row.updated_at,
        }
      : null,
  };
}

export async function updatePrivateAttachment(
  userId: string,
  input: PrivateAttachmentInput
): Promise<TerritoryWriteResult> {
  if (input.consent !== true) {
    return { ok: false, error: 'consent_required' };
  }
  if (!isValidLat(input.lat) || !isValidLng(input.lng)) {
    return { ok: false, error: 'invalid_coordinates' };
  }

  const supabase = createTerritoryServiceClient();

  const { data: existing, error: existingError } = await supabase
    .from('user_territory_private')
    .select('lat, lng, locked_until')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;

  const existingRow = existing as {
    lat: number;
    lng: number;
    locked_until: string | null;
  } | null;

  const now = Date.now();
  const lockActive =
    existingRow?.locked_until !== null &&
    existingRow?.locked_until !== undefined &&
    new Date(existingRow.locked_until).getTime() > now;

  if (lockActive) {
    if (input.correction !== true) {
      return { ok: false, error: 'lock_active' };
    }
    const since = new Date(now - CORRECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('territory_change_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count ?? 0) >= 1) {
      return { ok: false, error: 'correction_limit' };
    }
  }

  const lockedUntil = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('user_territory_private')
    .upsert(
      {
        user_id: userId,
        lat: input.lat,
        lng: input.lng,
        accuracy_m:
          typeof input.accuracy_m === 'number' && Number.isFinite(input.accuracy_m)
            ? Math.round(input.accuracy_m)
            : null,
        consent_at: new Date().toISOString(),
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('consent_at, locked_until')
    .maybeSingle();

  if (error) throw error;

  if (lockActive && existingRow) {
    const { error: logError } = await supabase.from('territory_change_log').insert({
      user_id: userId,
      old_lat: existingRow.lat,
      old_lng: existingRow.lng,
      new_lat: input.lat,
      new_lng: input.lng,
      reason: 'correction',
    });
    if (logError) throw logError;
  }

  const row = data as { consent_at: string | null; locked_until: string | null } | null;

  return {
    ok: true,
    privateAttachment: {
      present: true,
      consentAt: row?.consent_at ?? null,
      lockedUntil: row?.locked_until ?? null,
      locked: true,
    },
  };
}
