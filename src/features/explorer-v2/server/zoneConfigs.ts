import 'server-only';

/**
 * Persistance privée des configurations de zones et de seuils (S2.10–S2.12).
 *
 * Le contrat de domaine reste `zoneConfiguration.ts` : ce service ne complète
 * aucune valeur, ne crée aucune configuration par défaut et ne réécrit jamais
 * une configuration existante. Une nouvelle configuration est une nouvelle
 * ligne datée ; un rejeu de la même `id` avec le même contenu est idempotent,
 * un rejeu avec un contenu différent est un conflit explicite.
 *
 * Le service s'appuie sur la RLS de `activity_zone_configs` pour les lectures
 * (propriétaire uniquement) et sur la RPC `save_activity_zone_config`
 * (`SECURITY DEFINER`, `auth.uid()` côté serveur) pour les écritures.
 */

import { createClient } from '@/lib/supabase/server';
import type { ZoneMetric, ZoneSet } from '../metrics/activityMetrics';
import {
  ZONE_CONFIG_SELECT_COLUMNS,
  buildSaveZoneConfigRpcBody,
  createZoneSet,
  parseSaveZoneConfigRpcResult,
  zoneConfigRowToZoneSet,
} from '../metrics/zoneConfiguration';

const ZONE_CONFIG_TABLE = 'activity_zone_configs';
const MAX_LIST_LIMIT = 100;
const MAX_DATE_MS = 8_640_000_000_000_000;

export type SaveZoneConfigurationResult =
  | { readonly ok: true; readonly created: boolean; readonly zoneSet: ZoneSet }
  | {
      readonly ok: false;
      readonly reason:
        | 'unauthorized'
        | 'invalid_configuration'
        | 'payload_mismatch'
        | 'unavailable'
        | 'invalid_response';
      readonly errors?: readonly string[];
    };

export interface ListZoneConfigsFailure {
  readonly ok: false;
  readonly reason: 'unauthorized' | 'invalid_query' | 'unavailable' | 'invalid_response';
}

export type ListZoneConfigsResult =
  | { readonly ok: true; readonly configs: readonly ZoneSet[] }
  | ListZoneConfigsFailure;

export type LatestZoneConfigResult =
  | { readonly ok: true; readonly zoneSet: ZoneSet | null }
  | ListZoneConfigsFailure;

export interface ListZoneConfigsQuery {
  /** Filtre facultatif ; `null` signifie « toutes les métriques ». */
  readonly metric: ZoneMetric | null;
  /** Filtre facultatif ; `null` signifie « toutes les disciplines ». */
  readonly discipline: string | null;
  /**
   * Date d'effet recherchée. `null` retourne les configurations les plus
   * récentes ; une valeur retourne celles déjà effectives à cet instant.
   */
  readonly atMs: number | null;
  /** Nombre maximal de lignes, obligatoire et borné. Aucune valeur par défaut. */
  readonly limit: number;
}

function isDiscipline(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(value);
}

/**
 * Enregistre une configuration explicitement fournie.
 *
 * `input` est volontairement `unknown` : la validation commence ici, avant
 * toute lecture d'environnement ou tout appel réseau. Un refus de validation
 * ne touche donc jamais la base.
 */
export async function saveZoneConfiguration(input: unknown): Promise<SaveZoneConfigurationResult> {
  const checked = createZoneSet(input);
  if (!checked.ok) {
    return { ok: false, reason: 'invalid_configuration', errors: checked.errors };
  }

  const body = buildSaveZoneConfigRpcBody(checked.zoneSet);
  if (!body.ok) {
    return { ok: false, reason: 'invalid_configuration', errors: body.errors };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, reason: 'unauthorized' };

    const { data, error } = await supabase.rpc('save_activity_zone_config', body.body);
    if (error) {
      console.error('[explorer-v2] save activity zone configuration', error);
      return { ok: false, reason: 'unavailable' };
    }

    const parsed = parseSaveZoneConfigRpcResult(data);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason === 'payload_mismatch' ? 'payload_mismatch' : 'invalid_response',
      };
    }

    return { ok: true, created: parsed.created, zoneSet: parsed.zoneSet };
  } catch (error) {
    console.error('[explorer-v2] save activity zone configuration', error);
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Liste les configurations privées du propriétaire, de la plus récente à la
 * plus ancienne. Aucune ligne d'un autre utilisateur ne peut être lue : la RLS
 * et la vérification d'authentification sont toutes deux explicites.
 */
export async function listZoneConfigs(
  query: ListZoneConfigsQuery
): Promise<ListZoneConfigsResult> {
  if (
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > MAX_LIST_LIMIT ||
    (query.atMs !== null &&
      (!Number.isSafeInteger(query.atMs) || Math.abs(query.atMs) > MAX_DATE_MS)) ||
    (query.discipline !== null && !isDiscipline(query.discipline))
  ) {
    return { ok: false, reason: 'invalid_query' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, reason: 'unauthorized' };

    let request = supabase
      .from(ZONE_CONFIG_TABLE)
      .select(ZONE_CONFIG_SELECT_COLUMNS)
      .eq('user_id', user.id)
      .order('effective_from', { ascending: false })
      .order('recorded_at', { ascending: false })
      .limit(query.limit);

    if (query.metric !== null) request = request.eq('metric', query.metric);
    if (query.discipline !== null) request = request.eq('discipline', query.discipline);
    if (query.atMs !== null) {
      request = request.lte('effective_from', new Date(query.atMs).toISOString());
    }

    const { data, error } = await request;
    if (error) {
      console.error('[explorer-v2] list activity zone configurations', error);
      return { ok: false, reason: 'unavailable' };
    }
    if (!Array.isArray(data)) return { ok: false, reason: 'invalid_response' };

    const configs: ZoneSet[] = [];
    for (const row of data) {
      const parsed = zoneConfigRowToZoneSet(row);
      if (!parsed.ok) return { ok: false, reason: 'invalid_response' };
      configs.push(parsed.zoneSet);
    }

    return { ok: true, configs };
  } catch (error) {
    console.error('[explorer-v2] list activity zone configurations', error);
    return { ok: false, reason: 'unavailable' };
  }
}

/** Dernière configuration effective (ou la plus récente si `atMs` est `null`). */
export async function getLatestZoneConfig(
  metric: ZoneMetric,
  discipline: string,
  atMs: number | null
): Promise<LatestZoneConfigResult> {
  const listed = await listZoneConfigs({ metric, discipline, atMs, limit: 1 });
  if (!listed.ok) return listed;
  return { ok: true, zoneSet: listed.configs[0] ?? null };
}
