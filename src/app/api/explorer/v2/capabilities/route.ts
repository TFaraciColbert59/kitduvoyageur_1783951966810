import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  buildUserCapabilityManifest,
  createGuestFailSafeManifest,
} from '@/features/explorer-v2/routing/capabilityManifest';
import type { BiometricWellnessSnapshot, SessionRecord } from '@/features/explorer-v2/adaptive/types';
import type { Sport } from '@/features/explorer-v2/state/types';
import type { UserCapabilityManifest } from '@/features/explorer-v2/routing/types';

export const dynamic = 'force-dynamic';

const VALID_SPORTS = new Set<Sport>([
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
]);

function normalizeSport(raw: unknown): Sport {
  const s = typeof raw === 'string' ? raw.toLowerCase() : 'rando';
  return VALID_SPORTS.has(s as Sport) ? (s as Sport) : 'rando';
}

/**
 * Loads the authenticated user's real capability manifest from Supabase (or returns
 * the silent Fail-Safe guest manifest when unauthenticated / tables not yet migrated).
 */
export async function loadServerCapabilityManifest(options?: {
  selectedKitId?: string | null;
  packWeightOverrideKg?: number | null;
}): Promise<UserCapabilityManifest> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return createGuestFailSafeManifest({
        packWeightKg: options?.packWeightOverrideKg ?? null,
      });
    }

    const since28d = new Date(Date.now() - 28 * 86_400_000).toISOString();

    const [
      physRes,
      orientRes,
      travRes,
      perfRes,
      sportCapsRes,
      locomotionRes,
      gearRes,
      kitsRes,
      zonesRes,
      actSessionsRes,
      wellnessRes,
    ] = await Promise.all([
      supabase
        .from('user_physiology')
        .select('weight_kg, height_cm, vo2max_ml_kg_min, vma_kmh, mobility_profile, declared_level')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_orientation')
        .select('priority, experience')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_traveller')
        .select('home_altitude_m')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_performance_profiles')
        .select('flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h, sample_count, calibration_level')
        .eq('user_id', user.id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_sport_capabilities')
        .select(
          'sport, practiced, experience_level, sac_max_grade, mtb_max_grade, whitewater_max_grade, via_ferrata_ok, winter_avalanche_trained, max_comfortable_dplus_m, max_comfortable_km',
        )
        .eq('user_id', user.id),
      supabase
        .from('user_locomotion_assets')
        .select('asset_kind, is_active, range_km, battery_wh')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('product_ownership')
        .select('name, category, function_id, weight_g, condition')
        .eq('user_id', user.id)
        .limit(200),
      supabase
        .from('materiel_kits')
        .select('id, name, total_weight_g, season, is_favorite')
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .order('is_favorite', { ascending: false })
        .limit(12),
      supabase
        .from('activity_zone_configs')
        .select('threshold_kind, threshold_value')
        .eq('user_id', user.id)
        .limit(10),
      supabase
        .from('activity_sessions')
        .select('id, sport, started_at, ended_at, distance_m, elev_gain_m, moving_s')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .gte('started_at', since28d)
        .order('started_at', { ascending: false })
        .limit(60),
      supabase
        .from('user_wellness_snapshots')
        .select(
          'recorded_at, sleep_hours, sleep_quality, resting_hr_bpm, hrv_ms, soreness_level, subjective_energy, rehab_pain_level, rehab_body_zone',
        )
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const recentSessions: SessionRecord[] = (actSessionsRes.data ?? [])
      .filter((row) => typeof row.started_at === 'string')
      .map((row) => ({
        id: String(row.id),
        sport: normalizeSport(row.sport),
        startedAtMs: Date.parse(row.started_at),
        endedAtMs: row.ended_at ? Date.parse(row.ended_at) : Date.parse(row.started_at) + Number(row.moving_s ?? 0) * 1000,
        movingSeconds: Math.max(0, Number(row.moving_s ?? 0)),
        distanceKm: Math.max(0, Number(row.distance_m ?? 0) / 1000),
        elevationGainM: Math.max(0, Number(row.elev_gain_m ?? 0)),
        elevationLossM: Math.max(0, Number(row.elev_gain_m ?? 0)),
      }));

    const latestWellness: BiometricWellnessSnapshot | null = wellnessRes.data
      ? {
          recordedAtMs: Date.parse(wellnessRes.data.recorded_at),
          sleepHours: wellnessRes.data.sleep_hours ?? null,
          sleepQuality: wellnessRes.data.sleep_quality ?? null,
          restingHrBpm: wellnessRes.data.resting_hr_bpm ?? null,
          hrvMs: wellnessRes.data.hrv_ms ?? null,
          sorenessLevel: wellnessRes.data.soreness_level ?? null,
          subjectiveEnergy: wellnessRes.data.subjective_energy ?? null,
          rehabPainLevel: wellnessRes.data.rehab_pain_level ?? null,
          rehabBodyZone: wellnessRes.data.rehab_body_zone ?? null,
        }
      : null;

    return buildUserCapabilityManifest({
      authenticated: true,
      physiology: physRes.error ? null : physRes.data,
      orientation: orientRes.error ? null : orientRes.data,
      traveller: travRes.error ? null : travRes.data,
      perfProfile: perfRes.error ? null : perfRes.data,
      sportCapabilities: sportCapsRes.error ? [] : (sportCapsRes.data ?? []),
      locomotionAssets: locomotionRes.error ? [] : (locomotionRes.data ?? []),
      gearItems: gearRes.error ? [] : (gearRes.data ?? []),
      kits: kitsRes.error ? [] : (kitsRes.data ?? []),
      zoneConfigs: zonesRes.error ? [] : (zonesRes.data ?? []),
      recentSessions,
      latestWellness,
      selectedKitId: options?.selectedKitId ?? null,
      packWeightOverrideKg: options?.packWeightOverrideKg ?? null,
    });
  } catch {
    return createGuestFailSafeManifest({
      packWeightKg: options?.packWeightOverrideKg ?? null,
    });
  }
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const kitId = sp.get('kitId');
  const rawPack = sp.get('packWeightKg');
  const packWeightOverrideKg =
    rawPack !== null && Number.isFinite(Number(rawPack)) ? Number(rawPack) : null;

  const manifest = await loadServerCapabilityManifest({
    selectedKitId: kitId,
    packWeightOverrideKg,
  });

  return NextResponse.json(
    { ok: true, manifest },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

const patchSchema = z.object({
  sportCapabilities: z
    .array(
      z.object({
        sport: z.enum([
          'rando',
          'trail',
          'course',
          'velo',
          'gravel',
          'vtt',
          'ski',
          'raquettes',
          'kayak',
          'packraft',
          'sup',
          'escalade',
          'bivouac',
        ]),
        practiced: z.boolean().default(true),
        sac_max_grade: z.number().int().min(1).max(6).optional(),
        mtb_max_grade: z.number().int().min(0).max(5).optional(),
        whitewater_max_grade: z.number().int().min(0).max(6).optional(),
        via_ferrata_ok: z.boolean().optional(),
        winter_avalanche_trained: z.boolean().optional(),
      }),
    )
    .optional(),
  locomotionAssets: z
    .array(
      z.object({
        asset_kind: z.enum([
          'foot',
          'road_bike',
          'gravel_bike',
          'mtb',
          'ebike',
          'car',
          'van_4x4',
          'motorcycle',
          'kayak',
          'packraft',
          'sup',
          'ski_touring',
          'snowshoes',
          'public_transit',
        ]),
        is_active: z.boolean().default(true),
        label: z.string().max(80).optional(),
        range_km: z.number().int().min(5).max(1500).optional(),
      }),
    )
    .optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  if (parsed.data.sportCapabilities?.length) {
    await supabase.from('user_sport_capabilities').upsert(
      parsed.data.sportCapabilities.map((c) => ({
        user_id: user.id,
        ...c,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,sport' },
    );
  }

  if (parsed.data.locomotionAssets?.length) {
    for (const asset of parsed.data.locomotionAssets) {
      await supabase
        .from('user_locomotion_assets')
        .delete()
        .eq('user_id', user.id)
        .eq('asset_kind', asset.asset_kind);
      await supabase.from('user_locomotion_assets').insert({
        user_id: user.id,
        asset_kind: asset.asset_kind,
        is_active: asset.is_active,
        label: asset.label ?? null,
        range_km: asset.range_km ?? null,
      });
    }
  }

  const manifest = await loadServerCapabilityManifest();
  return NextResponse.json(
    { ok: true, manifest },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
