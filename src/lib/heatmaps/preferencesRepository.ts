import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AggregateContributionPreferences } from '@/features/heatmaps/types';
import { normalizeContributionPreferences } from '@/features/heatmaps/consent';
import { HeatmapDataError } from './errors';
import {
  PREFERENCES_TABLE,
  defaultPreferences,
  preferencesToRow,
  rowToPreferences,
  type HeatmapPreferenceRow,
} from './preferencesRows';

const PREFERENCE_PAGE_SIZE = 1_000;

function isMissingTableError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  return (
    candidate?.code === '42P01' ||
    candidate?.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(candidate?.message ?? '')
  );
}

/** Lit les préférences d'un utilisateur ; `null` si aucune ligne n'existe encore. */
export async function loadPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<AggregateContributionPreferences | null> {
  const { data, error } = await supabase
    .from(PREFERENCES_TABLE)
    .select(
      'user_id,global_heatmap_opt_out,global_heatmap,route_recommendations,mobility_aggregates,revision,updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      throw new HeatmapDataError('preferences_unavailable');
    }
    console.error('[heatmaps] lecture préférences impossible', error);
    throw new HeatmapDataError('preferences_unavailable');
  }

  return data ? rowToPreferences(data as HeatmapPreferenceRow) : null;
}

/** Préférences effectives : valeurs fail-closed si l'utilisateur n'a jamais choisi. */
export async function loadEffectivePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<AggregateContributionPreferences> {
  const existing = await loadPreferences(supabase, userId);
  return existing ?? defaultPreferences(userId);
}

export async function savePreferences(
  supabase: SupabaseClient,
  preferences: AggregateContributionPreferences
): Promise<AggregateContributionPreferences> {
  const normalized = normalizeContributionPreferences(preferences);
  const { error } = await supabase
    .from(PREFERENCES_TABLE)
    .upsert(preferencesToRow(normalized), { onConflict: 'user_id' });

  if (error) {
    if (isMissingTableError(error)) {
      throw new HeatmapDataError('preferences_unavailable');
    }
    console.error('[heatmaps] écriture préférences impossible', error);
    throw new HeatmapDataError('preferences_unavailable');
  }

  return normalized;
}

/**
 * Charge la carte des consentements explicitement accordés pour la heatmap
 * mondiale. Toute erreur bloque l'agrégat public (fail-closed).
 */
export async function loadConsentingPreferences(
  supabase: SupabaseClient
): Promise<Map<string, AggregateContributionPreferences>> {
  const preferences = new Map<string, AggregateContributionPreferences>();

  for (let from = 0; ; from += PREFERENCE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(PREFERENCES_TABLE)
      .select(
        'user_id,global_heatmap_opt_out,global_heatmap,route_recommendations,mobility_aggregates,revision,updated_at'
      )
      .eq('global_heatmap', true)
      .eq('global_heatmap_opt_out', false)
      .order('user_id', { ascending: true })
      .range(from, from + PREFERENCE_PAGE_SIZE - 1);

    if (error) {
      if (isMissingTableError(error)) {
        throw new HeatmapDataError('consent_unavailable');
      }
      console.error('[heatmaps] lecture consentements impossible', error);
      throw new HeatmapDataError('consent_unavailable');
    }

    const rows = (data ?? []) as HeatmapPreferenceRow[];
    for (const row of rows) {
      const preferencesRow = rowToPreferences(row);
      if (
        preferencesRow.globalHeatmap === true &&
        preferencesRow.globalHeatmapOptOut === false &&
        preferencesRow.userId.trim() !== ''
      ) {
        preferences.set(preferencesRow.userId, preferencesRow);
      }
    }

    if (rows.length < PREFERENCE_PAGE_SIZE) break;
  }

  return preferences;
}
