import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T18 — Découvertes géographiques canoniques.
 *
 * Provenance stricte : `verified` (réalisation contrôlée uniquement),
 * `declared` (saisie personnelle), `virtual` (expédition virtuelle). Une
 * déclaration ou une expédition virtuelle NE DEVIENT PAS une visite réelle :
 * seul le flux vérifié peut poser/remonter la provenance. Aucun XP n'est
 * émis — le passeport et la carte enrichissent des vues, jamais des soldes.
 */

export type DiscoveryEntityType = 'country' | 'region' | 'massif';
export type DiscoveryProvenance = 'verified' | 'declared' | 'virtual';

export interface UserDiscovery {
  entityType: DiscoveryEntityType;
  entityCode: string;
  provenance: DiscoveryProvenance;
  firstSeenAt: string;
}

function createDiscoveryClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour les découvertes.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizeDiscoveryCode(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 2 ? normalized : null;
}

interface SessionRow {
  user_id: string;
  processing_status: string;
  route_id: number | null;
}

/**
 * Dérive les découvertes vérifiées d'une session traitée :
 * région du sentier + pays administratif correspondant quand il est connu.
 * Renvoie le nombre de territoires enregistrés (0 si la preuve est absente).
 */
export async function deriveVerifiedDiscoveriesFromSession(sessionId: string): Promise<number> {
  const supabase = createDiscoveryClient();

  const { data: sessionData, error: sessionError } = await supabase
    .from('hike_sessions')
    .select('user_id, processing_status, route_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  const session = (sessionData ?? null) as SessionRow | null;
  if (!session || session.processing_status !== 'processed') return 0;
  if (session.route_id === null || session.route_id === undefined) return 0;

  const { data: routeData, error: routeError } = await supabase
    .from('hiking_routes')
    .select('region')
    .eq('id', session.route_id)
    .maybeSingle();
  if (routeError) throw new Error(routeError.message);
  const region = (routeData as { region: string | null } | null)?.region ?? null;
  const regionCode = region ? normalizeDiscoveryCode(region) : null;
  if (!regionCode) return 0;

  const codes: Array<{ type: DiscoveryEntityType; code: string }> = [
    { type: 'region', code: regionCode },
  ];

  // Pays administratif : correspondance exacte par nom (ou nom ascii) — aucune
  // géométrie stockée, un simple identifiant canonique.
  // Valeur échappée (guillemets PostgREST) : les noms contiennent espaces,
  // apostrophes et tirets — jamais injectés bruts dans le filtre `or`.
  const safeRegion = regionCode.replace(/"/g, '');
  const { data: countryRows } = await supabase
    .from('admin_regions_geo')
    .select('country_iso_a2')
    .or(`name.ilike."${safeRegion}",name_ascii.ilike."${safeRegion}"`)
    .limit(1);
  const countryCode = normalizeDiscoveryCode(
    ((countryRows ?? [])[0] as { country_iso_a2: string | null } | undefined)?.country_iso_a2 ?? ''
  );
  if (countryCode) codes.push({ type: 'country', code: countryCode });

  let recorded = 0;
  for (const entry of codes) {
    const { data, error } = await supabase.rpc('record_verified_discovery', {
      p_user_id: session.user_id,
      p_entity_type: entry.type,
      p_entity_code: entry.code,
      p_source_type: 'hike_session',
      p_source_id: sessionId,
    });
    if (error) throw new Error(error.message);
    if (data === true) recorded += 1;
  }
  return recorded;
}

/**
 * Découverte déclarée ou virtuelle : insertion SEULE, sans écrasement d'une
 * découverte vérifiée (jamais interchangeable).
 */
export async function recordUnverifiedDiscovery(input: {
  userId: string;
  entityType: DiscoveryEntityType;
  entityCode: string;
  provenance: 'declared' | 'virtual';
  sourceType: string;
  sourceId: string;
}): Promise<boolean> {
  const code = normalizeDiscoveryCode(input.entityCode);
  if (!code) return false;
  const supabase = createDiscoveryClient();
  const { error } = await supabase.from('progression_discoveries').upsert(
    {
      user_id: input.userId,
      entity_type: input.entityType,
      entity_code: code,
      provenance: input.provenance,
      source_type: input.sourceType,
      source_id: input.sourceId,
    },
    { onConflict: 'user_id,entity_type,entity_code', ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
  return true;
}

export async function listUserDiscoveries(userId: string): Promise<UserDiscovery[]> {
  const supabase = createDiscoveryClient();
  const { data, error } = await supabase
    .from('progression_discoveries')
    .select('entity_type, entity_code, provenance, first_seen_at')
    .eq('user_id', userId)
    .order('first_seen_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    entity_type: string;
    entity_code: string;
    provenance: string;
    first_seen_at: string | null;
  }>).map((row) => ({
    entityType: (row.entity_type === 'country' || row.entity_type === 'massif'
      ? row.entity_type
      : 'region') as DiscoveryEntityType,
    entityCode: row.entity_code,
    provenance: (row.provenance === 'declared' || row.provenance === 'virtual'
      ? row.provenance
      : 'verified') as DiscoveryProvenance,
    firstSeenAt: row.first_seen_at ?? '',
  }));
}
