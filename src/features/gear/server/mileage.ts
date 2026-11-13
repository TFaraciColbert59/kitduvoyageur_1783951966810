import type { SupabaseClient } from '@supabase/supabase-js';
import {
  componentMileage,
  computeGearMileage,
  resolveMileageAlert,
  type MileageAlertInput,
} from '@/features/gear/domain/mileage';
import type {
  GearComponent,
  GearComponentMileage,
  GearMileage,
  GearMileageAlert,
  GearUsageEvent,
} from '@/features/gear/domain/types';

/**
 * Lecture et écriture du kilométrage équipement.
 *
 * Le kilométrage n'est jamais stocké en double : il est dérivé des séances
 * liées. Une correction de `hike_sessions.distance_km` se répercute donc sans
 * rejeu, et une même séance ne peut pas être comptée deux fois.
 */

export class GearError extends Error {
  constructor(public readonly code: 'not_found' | 'no_mileage' | 'invalid' | 'migration_required') {
    super(code);
    this.name = 'GearError';
  }
}

type GearRow = {
  id: string;
  name: string | null;
  category: string | null;
  condition: string | null;
  usage_count: number | null;
  weight_g: number | null;
  image: string | null;
};

type LinkRow = { session_id: string; gear_item_id: string | null; sport: string | null };
type SessionRow = {
  id: string;
  distance_km: number | string | null;
  started_at: string | null;
  ended_at: string | null;
  activity_session_id: string | null;
};
type ActivityRow = { id: string; sport: string | null; status: string | null; distance_m: number | null };
type SettingsRow = {
  threshold_km: number | string | null;
  threshold_version: number | null;
  notified_version: number | null;
  dismissed_version: number | null;
};

type ComponentRow = {
  id: string;
  gear_item_id: string;
  name: string;
  kind: string;
  installed_at_km: number | string | null;
  replaced_at_km: number | string | null;
  threshold_km: number | string | null;
};

export interface GearMileageSettings {
  thresholdKm: number | null;
  thresholdVersion: number;
  notifiedVersion: number | null;
  dismissedVersion: number | null;
}

export interface GearMileagePayload {
  gear: { id: string; name: string; category: string | null; condition: string | null };
  mileage: GearMileage;
  settings: GearMileageSettings;
  alert: GearMileageAlert;
  components: Array<GearComponent & { mileage: GearComponentMileage }>;
  /** `false` quand la migration du lot n'est pas encore appliquée. */
  persistenceReady: boolean;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /does not exist|schema cache/i.test(error.message ?? '');
}

export async function loadGearMileage(
  supabase: SupabaseClient,
  userId: string,
  gearItemId: string
): Promise<GearMileagePayload> {
  const { data: gearData, error: gearError } = await supabase
    .from('gear_items')
    .select('id,name,category,condition,usage_count,weight_g,image')
    .eq('id', gearItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (gearError) throw gearError;
  if (!gearData) throw new GearError('not_found');
  const gear = gearData as GearRow;

  let persistenceReady = true;

  let settingsRow: SettingsRow | null = null;
  const settingsRes = await supabase
    .from('gear_mileage_settings')
    .select('threshold_km,threshold_version,notified_version,dismissed_version')
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (settingsRes.error) {
    if (isMissingTable(settingsRes.error)) persistenceReady = false;
    else throw settingsRes.error;
  } else {
    settingsRow = settingsRes.data as SettingsRow | null;
  }

  const { data: linkData, error: linkError } = await supabase
    .from('hike_session_gear')
    .select('session_id,gear_item_id,sport')
    .eq('gear_item_id', gearItemId);
  if (linkError) {
    // Colonne absente : la migration n'est pas appliquée, on renvoie une
    // absence explicite plutôt qu'un total trompeur.
    if (isMissingTable(linkError) || linkError.code === '42703') {
      return {
        gear: {
          id: gear.id,
          name: gear.name?.trim() || 'Objet',
          category: gear.category,
          condition: gear.condition,
        },
        mileage: computeGearMileage([]),
        settings: { thresholdKm: null, thresholdVersion: 1, notifiedVersion: null, dismissedVersion: null },
        alert: resolveMileageAlert({
          totalKm: 0,
          thresholdKm: null,
          thresholdVersion: 1,
          lastNotifiedVersion: null,
          dismissedVersion: null,
        }),
        components: [],
        persistenceReady: false,
      };
    }
    throw linkError;
  }

  const links = (linkData ?? []) as LinkRow[];
  const sessionIds = [...new Set(links.map((link) => link.session_id).filter(Boolean))];
  const sessionById = new Map<string, SessionRow>();
  const activityById = new Map<string, ActivityRow>();

  if (sessionIds.length > 0) {
    const { data: sessionData, error: sessionError } = await supabase
      .from('hike_sessions')
      .select('id,distance_km,started_at,ended_at,activity_session_id')
      .in('id', sessionIds);
    if (sessionError) throw sessionError;
    for (const row of (sessionData ?? []) as SessionRow[]) sessionById.set(row.id, row);

    const activityIds = [...new Set(
      (sessionData ?? [])
        .map((row) => (row as SessionRow).activity_session_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )];
    if (activityIds.length > 0) {
      const { data: activityData, error: activityError } = await supabase
        .from('activity_sessions')
        .select('id,sport,status,distance_m')
        .in('id', activityIds);
      if (!activityError) {
        for (const row of (activityData ?? []) as ActivityRow[]) activityById.set(row.id, row);
      }
    }
  }

  const usages: GearUsageEvent[] = [];
  for (const link of links) {
    const session = sessionById.get(link.session_id);
    if (!session) continue;
    const activity = session.activity_session_id ? activityById.get(session.activity_session_id) : null;
    const summaryKm = numberOrNull(session.distance_km);
    const activityKm = activity?.distance_m != null ? activity.distance_m / 1000 : null;
    usages.push({
      sessionId: session.id,
      gearItemId: gearItemId,
      sport: link.sport ?? activity?.sport ?? null,
      distanceKm: summaryKm !== null ? summaryKm : activityKm,
      status: session.ended_at ? 'finished' : activity?.status ?? null,
      endedAt: session.ended_at,
    });
  }

  const mileage = computeGearMileage(usages);

  let componentRows: ComponentRow[] = [];
  const componentRes = await supabase
    .from('gear_components')
    .select('id,gear_item_id,name,kind,installed_at_km,replaced_at_km,threshold_km')
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (componentRes.error) {
    if (isMissingTable(componentRes.error)) persistenceReady = false;
    else throw componentRes.error;
  } else {
    componentRows = (componentRes.data ?? []) as ComponentRow[];
  }

  const components = componentRows.map((row) => {
    const component: GearComponent = {
      id: row.id,
      gearItemId: row.gear_item_id,
      name: row.name,
      kind: row.kind,
      installedAtKm: numberOrNull(row.installed_at_km),
      replacedAtKm: numberOrNull(row.replaced_at_km),
      thresholdKm: numberOrNull(row.threshold_km),
    };
    return { ...component, mileage: componentMileage(component, mileage.totalKm) };
  });

  let lastNotifiedVersion: number | null = null;
  const historyRes = await supabase
    .from('gear_alert_history')
    .select('threshold_version')
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId)
    .order('threshold_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historyRes.error && !isMissingTable(historyRes.error)) throw historyRes.error;
  if (historyRes.data) lastNotifiedVersion = Number((historyRes.data as { threshold_version: number }).threshold_version);

  const settings: GearMileageSettings = {
    thresholdKm: numberOrNull(settingsRow?.threshold_km),
    thresholdVersion: Number(settingsRow?.threshold_version ?? 1) || 1,
    notifiedVersion: numberOrNull(settingsRow?.notified_version),
    dismissedVersion: numberOrNull(settingsRow?.dismissed_version),
  };

  const alertInput: MileageAlertInput = {
    totalKm: mileage.totalKm,
    thresholdKm: settings.thresholdKm,
    thresholdVersion: settings.thresholdVersion,
    lastNotifiedVersion,
    dismissedVersion: settings.dismissedVersion,
  };

  return {
    gear: {
      id: gear.id,
      name: gear.name?.trim() || 'Objet',
      category: gear.category,
      condition: gear.condition,
    },
    mileage,
    settings,
    alert: resolveMileageAlert(alertInput),
    components,
    persistenceReady,
  };
}

async function assertGearOwner(supabase: SupabaseClient, userId: string, gearItemId: string): Promise<void> {
  const { data, error } = await supabase
    .from('gear_items')
    .select('id')
    .eq('id', gearItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GearError('not_found');
}

export async function saveGearThreshold(
  supabase: SupabaseClient,
  userId: string,
  gearItemId: string,
  thresholdKm: number | null
): Promise<GearMileageSettings> {
  await assertGearOwner(supabase, userId, gearItemId);
  if (thresholdKm !== null && (!Number.isFinite(thresholdKm) || thresholdKm <= 0)) {
    throw new GearError('invalid');
  }

  const { data: current, error: currentError } = await supabase
    .from('gear_mileage_settings')
    .select('threshold_km,threshold_version,notified_version,dismissed_version')
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (currentError) {
    if (isMissingTable(currentError)) throw new GearError('migration_required');
    throw currentError;
  }

  const previousThreshold = numberOrNull((current as { threshold_km?: unknown } | null)?.threshold_km);
  const previousVersion = Number((current as { threshold_version?: unknown } | null)?.threshold_version ?? 1) || 1;
  const changed = previousThreshold !== thresholdKm;
  const nextVersion = changed ? previousVersion + 1 : previousVersion;

  const { data, error } = await supabase
    .from('gear_mileage_settings')
    .upsert(
      {
        gear_item_id: gearItemId,
        user_id: userId,
        threshold_km: thresholdKm,
        threshold_version: nextVersion,
        notified_version: (current as { notified_version?: unknown } | null)?.notified_version ?? null,
        dismissed_version: (current as { dismissed_version?: unknown } | null)?.dismissed_version ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'gear_item_id' }
    )
    .select('threshold_km,threshold_version,notified_version,dismissed_version')
    .single();
  if (error) {
    if (isMissingTable(error)) throw new GearError('migration_required');
    throw error;
  }

  const row = data as {
    threshold_km: number | string | null;
    threshold_version: number;
    notified_version: number | null;
    dismissed_version: number | null;
  };
  return {
    thresholdKm: numberOrNull(row.threshold_km),
    thresholdVersion: Number(row.threshold_version) || 1,
    notifiedVersion: numberOrNull(row.notified_version),
    dismissedVersion: numberOrNull(row.dismissed_version),
  };
}

export interface GearAlertAckResult {
  recorded: boolean;
  dismissed: boolean;
}

/**
 * Acquitte une alerte. L'insertion dans `gear_alert_history` est unique par
 * (objet, version) : rejouer l'action ne crée jamais de doublon.
 */
export async function acknowledgeGearAlert(
  supabase: SupabaseClient,
  userId: string,
  gearItemId: string,
  action: 'seen' | 'dismiss' = 'seen'
): Promise<GearAlertAckResult> {
  // On relit l'état réel : acquitter une alerte qui n'est pas due inscrirait
  // une version en historique et empêcherait l'alerte future légitime.
  const payload = await loadGearMileage(supabase, userId, gearItemId);
  if (!payload.alert.due || payload.settings.thresholdKm === null) {
    return { recorded: false, dismissed: false };
  }
  const thresholdKm = payload.settings.thresholdKm;
  const thresholdVersion = payload.settings.thresholdVersion;

  let recorded = true;
  const { error: insertError } = await supabase.from('gear_alert_history').insert({
    gear_item_id: gearItemId,
    user_id: userId,
    threshold_km: thresholdKm,
    threshold_version: thresholdVersion,
  });
  if (insertError && insertError.code === '23505') recorded = false;
  else if (insertError) throw insertError;

  const patch: Record<string, unknown> = {
    notified_version: thresholdVersion,
    updated_at: new Date().toISOString(),
  };
  if (action === 'dismiss') patch.dismissed_version = thresholdVersion;
  const { error: updateError } = await supabase
    .from('gear_mileage_settings')
    .update(patch)
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId);
  if (updateError) throw updateError;

  return { recorded, dismissed: action === 'dismiss' };
}

export interface AddGearComponentInput {
  name: string;
  kind: string;
  installedAtKm: number | null;
  thresholdKm: number | null;
}

export async function addGearComponent(
  supabase: SupabaseClient,
  userId: string,
  gearItemId: string,
  input: AddGearComponentInput
): Promise<GearComponent> {
  await assertGearOwner(supabase, userId, gearItemId);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new GearError('invalid');
  if (input.installedAtKm !== null && (!Number.isFinite(input.installedAtKm) || input.installedAtKm < 0)) {
    throw new GearError('invalid');
  }
  if (input.thresholdKm !== null && (!Number.isFinite(input.thresholdKm) || input.thresholdKm <= 0)) {
    throw new GearError('invalid');
  }

  const { data, error } = await supabase
    .from('gear_components')
    .insert({
      user_id: userId,
      gear_item_id: gearItemId,
      name,
      kind: input.kind,
      installed_at_km: input.installedAtKm,
      threshold_km: input.thresholdKm,
    })
    .select('id,gear_item_id,name,kind,installed_at_km,replaced_at_km,threshold_km')
    .single();
  if (error) throw error;
  const row = data as ComponentRow;
  return {
    id: row.id,
    gearItemId: row.gear_item_id,
    name: row.name,
    kind: row.kind,
    installedAtKm: numberOrNull(row.installed_at_km),
    replacedAtKm: numberOrNull(row.replaced_at_km),
    thresholdKm: numberOrNull(row.threshold_km),
  };
}

/**
 * Remplace un composant au kilométrage réel du vélo. Si `replacedAtKm` n'est
 * pas fourni, on relit le kilométrage courant ; sans séance éligible on refuse
 * plutôt que d'écrire un zéro inventé.
 */
export async function replaceGearComponent(
  supabase: SupabaseClient,
  userId: string,
  gearItemId: string,
  componentId: string,
  replacedAtKm?: number | null
): Promise<GearComponent> {
  await assertGearOwner(supabase, userId, gearItemId);

  let endKm = replacedAtKm ?? null;
  if (endKm === null) {
    const payload = await loadGearMileage(supabase, userId, gearItemId);
    if (payload.mileage.sessionCount === 0) throw new GearError('no_mileage');
    endKm = payload.mileage.totalKm;
  }
  if (!Number.isFinite(endKm) || endKm < 0) throw new GearError('invalid');

  const { data, error } = await supabase
    .from('gear_components')
    .update({ replaced_at_km: endKm, updated_at: new Date().toISOString() })
    .eq('id', componentId)
    .eq('gear_item_id', gearItemId)
    .eq('user_id', userId)
    .select('id,gear_item_id,name,kind,installed_at_km,replaced_at_km,threshold_km')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GearError('not_found');
  const row = data as ComponentRow;
  return {
    id: row.id,
    gearItemId: row.gear_item_id,
    name: row.name,
    kind: row.kind,
    installedAtKm: numberOrNull(row.installed_at_km),
    replacedAtKm: numberOrNull(row.replaced_at_km),
    thresholdKm: numberOrNull(row.threshold_km),
  };
}
