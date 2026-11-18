import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  estimateSortiePerformance,
  type ParticipantPerformanceStats,
  type SortieActivityKind,
  type SortieRouteInput,
} from '@/features/community/v2/create/sortie/sortiePerformanceEngine';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function median(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;
}

function normalizeActivity(raw: string | null | undefined): SortieActivityKind {
  const s = (raw ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (s.includes('trail')) return 'trail';
  if (s.includes('ski')) return 'ski';
  if (s.includes('velo') || s.includes('vtt') || s.includes('gravel') || s.includes('bike')) return 'velo';
  if (s.includes('escalade') || s.includes('alpin')) return 'escalade';
  if (s.includes('autre')) return 'autre';
  return 'rando';
}

async function loadParticipantsStats(
  userIds: string[],
): Promise<Map<string, ParticipantPerformanceStats>> {
  const uniqueIds = Array.from(
    new Set(userIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))),
  ).slice(0, 50);

  const map = new Map<string, ParticipantPerformanceStats>();
  for (const uid of uniqueIds) {
    map.set(uid, { userId: uid });
  }
  if (uniqueIds.length === 0) return map;

  const db = getServiceSupabase() ?? (await createClient());

  const [perfRes, sessionsRes, memberRes, profileRes] = await Promise.all([
    db
      .from('user_performance_profiles')
      .select(
        'user_id, flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h, pause_model, calibration_level, confidence, sample_count',
      )
      .in('user_id', uniqueIds),
    db
      .from('hike_sessions')
      .select('user_id, distance_km, elevation_gain_m, duration_seconds, moving_time_seconds')
      .in('user_id', uniqueIds)
      .order('started_at', { ascending: false })
      .limit(250),
    db
      .from('trip_member_profiles')
      .select(
        'user_id, flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h, pack_weight_kg, max_carry_kg, experience_level, sample_count, is_child',
      )
      .in('user_id', uniqueIds)
      .order('updated_at', { ascending: false })
      .limit(100),
    db.from('user_profiles').select('id, level, xp').in('id', uniqueIds),
  ]);

  // 1. Profils généraux (`user_profiles`)
  for (const row of ((profileRes.data ?? []) as Row[])) {
    const uid = toStr(row.id);
    if (!uid || !map.has(uid)) continue;
    const entry = map.get(uid)!;
    entry.userLevel = toNum(row.level);
  }

  // 2. Profils membres de voyage (`trip_member_profiles` — plus récent d'abord)
  const seenMember = new Set<string>();
  for (const row of ((memberRes.data ?? []) as Row[])) {
    const uid = toStr(row.user_id);
    if (!uid || !map.has(uid) || seenMember.has(uid)) continue;
    seenMember.add(uid);
    const entry = map.get(uid)!;
    entry.flatSpeedKmh = toNum(row.flat_speed_kmh);
    entry.ascentSpeedMPerH = toNum(row.ascent_speed_m_per_h);
    entry.descentSpeedMPerH = toNum(row.descent_speed_m_per_h);
    entry.packWeightKg = toNum(row.pack_weight_kg);
    entry.maxCarryKg = toNum(row.max_carry_kg);
    entry.experienceLevel = toStr(row.experience_level);
    entry.sampleCount = toNum(row.sample_count);
    entry.isChild = row.is_child === true;
  }

  // 3. Profils de performance appris (`user_performance_profiles` — prioritaire sur les vitesses)
  for (const row of ((perfRes.data ?? []) as Row[])) {
    const uid = toStr(row.user_id);
    if (!uid || !map.has(uid)) continue;
    const entry = map.get(uid)!;
    const flat = toNum(row.flat_speed_kmh);
    const asc = toNum(row.ascent_speed_m_per_h);
    const desc = toNum(row.descent_speed_m_per_h);
    if (flat && flat > 0) entry.flatSpeedKmh = flat;
    if (asc && asc > 0) entry.ascentSpeedMPerH = asc;
    if (desc && desc > 0) entry.descentSpeedMPerH = desc;
    const cal = toStr(row.calibration_level);
    if (cal) entry.calibrationLevel = cal;
    const sc = toNum(row.sample_count);
    if (sc != null) entry.sampleCount = Math.max(entry.sampleCount ?? 0, sc);

    const confObj = row.confidence as { score?: unknown } | null;
    const confScore = toNum(confObj?.score);
    if (confScore != null) entry.confidenceScore = confScore;

    const pauseObj = row.pause_model as {
      pauseMinutesPerHour?: unknown;
      pauseMinutesPerAscentM?: unknown;
    } | null;
    const pmH = toNum(pauseObj?.pauseMinutesPerHour);
    const pmA = toNum(pauseObj?.pauseMinutesPerAscentM);
    if (pmH != null) entry.pauseMinutesPerHour = pmH;
    if (pmA != null) entry.pauseMinutesPer100mDplus = pmA * 100;
  }

  // 4. Historique des sorties GPS enregistrées (`hike_sessions`)
  const sessionsByUser = new Map<string, Row[]>();
  for (const row of ((sessionsRes.data ?? []) as Row[])) {
    const uid = toStr(row.user_id);
    if (!uid || !map.has(uid)) continue;
    const list = sessionsByUser.get(uid) ?? [];
    list.push(row);
    sessionsByUser.set(uid, list);
  }

  for (const [uid, list] of sessionsByUser.entries()) {
    const entry = map.get(uid)!;
    let count = 0;
    let totalKm = 0;
    let totalDplus = 0;
    const flatSpeeds: number[] = [];
    const ascentSpeeds: number[] = [];

    for (const s of list) {
      const km = toNum(s.distance_km) ?? 0;
      const gain = toNum(s.elevation_gain_m) ?? 0;
      const movingS = toNum(s.moving_time_seconds) ?? toNum(s.duration_seconds) ?? 0;
      if (km <= 0.2 && gain <= 10) continue;
      count += 1;
      totalKm += Math.max(0, km);
      totalDplus += Math.max(0, gain);

      if (movingS >= 600 && km >= 0.5) {
        const hours = movingS / 3600;
        // Vitesse équivalente à plat corrigée du D+ (100 m D+ ≈ 1 km-effort horizontal)
        const eqFlatKmh = (km + gain / 150) / hours;
        if (eqFlatKmh >= 1.8 && eqFlatKmh <= 14) {
          flatSpeeds.push(eqFlatKmh);
        }
        if (gain >= 120 && hours >= 0.3) {
          // Part du temps consacrée à la montée
          const estAscentHours = Math.max(0.2, hours * Math.min(0.85, (gain / 350) / Math.max(0.25, hours)));
          const ascSpeed = gain / estAscentHours;
          if (ascSpeed >= 150 && ascSpeed <= 1100) {
            ascentSpeeds.push(ascSpeed);
          }
        }
      }
    }

    entry.recordedOutingsCount = count;
    entry.totalRecordedKm = Math.round(totalKm * 10) / 10;
    entry.totalRecordedDplusM = Math.round(totalDplus);
    entry.observedFlatSpeedKmh = median(flatSpeeds);
    entry.observedAscentSpeedMPerH = median(ascentSpeeds);
  }

  return map;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId')?.trim() || null;
    const kitId = searchParams.get('kitId')?.trim() || null;
    const syncDuration = searchParams.get('sync') === '1';

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const db = getServiceSupabase() ?? authClient;

    let routeInput: SortieRouteInput = {
      activity: normalizeActivity(searchParams.get('activity')),
      distanceKm: toNum(searchParams.get('distanceKm')) ?? 0,
      elevationGainM: toNum(searchParams.get('elevationGainM')) ?? 0,
      elevationLossM: toNum(searchParams.get('elevationLossM')),
      maxAltitudeM: toNum(searchParams.get('maxAltitudeM')),
      nbJours: toNum(searchParams.get('nbJours')) ?? 1,
      packWeightKg: toNum(searchParams.get('packWeightKg')),
    };

    let orderedUserIds: string[] = [];
    let effectiveKitId = kitId;

    if (eventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      const [{ data: eventRow }, { data: partRows }] = await Promise.all([
        db.from('events').select('*').eq('id', eventId).maybeSingle(),
        db
          .from('event_participants')
          .select('user_id, status, created_at')
          .eq('event_id', eventId)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: true }),
      ]);

      if (eventRow) {
        const ev = eventRow as Row;
        const orgId = toStr(ev.organizer_id);
        if (orgId) orderedUserIds.push(orgId);
        for (const p of ((partRows ?? []) as Row[])) {
          const uid = toStr(p.user_id);
          if (uid && !orderedUserIds.includes(uid)) orderedUserIds.push(uid);
        }
        const startMs = toStr(ev.starts_at) ? Date.parse(toStr(ev.starts_at)!) : NaN;
        const endMs = toStr(ev.ends_at) ? Date.parse(toStr(ev.ends_at)!) : NaN;
        const derivedDays =
          Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
            ? Math.max(1, Math.ceil((endMs - startMs) / 86_400_000))
            : 1;

        routeInput = {
          activity: normalizeActivity(toStr(ev.type) ?? toStr(ev.activity)),
          distanceKm: routeInput.distanceKm > 0 ? routeInput.distanceKm : (toNum(ev.distance_km) ?? 0),
          elevationGainM:
            routeInput.elevationGainM > 0 ? routeInput.elevationGainM : (toNum(ev.elevation_gain_m) ?? 0),
          elevationLossM: routeInput.elevationLossM,
          maxAltitudeM: routeInput.maxAltitudeM,
          nbJours: routeInput.nbJours && routeInput.nbJours > 1 ? routeInput.nbJours : derivedDays,
          packWeightKg: routeInput.packWeightKg,
        };
        if (!effectiveKitId) effectiveKitId = toStr(ev.kit_id);
      }
    }

    if (orderedUserIds.length === 0 && user?.id) {
      orderedUserIds.push(user.id);
    }

    if (
      effectiveKitId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveKitId) &&
      !routeInput.packWeightKg
    ) {
      const { data: kitRow } = await db
        .from('materiel_kits')
        .select('total_weight_g')
        .eq('id', effectiveKitId)
        .maybeSingle();
      const weightG = toNum((kitRow as Row | null)?.total_weight_g);
      if (weightG && weightG > 0) {
        routeInput.packWeightKg = Math.round((weightG / 1000) * 100) / 100;
      }
    }

    const statsMap = await loadParticipantsStats(orderedUserIds);
    const participantsList = orderedUserIds
      .map((uid) => statsMap.get(uid) ?? null)
      .filter((s): s is ParticipantPerformanceStats => s !== null);

    const estimate = estimateSortiePerformance(routeInput, participantsList);

    // Persiste la nouvelle durée estimée sur la sortie lorsque la composition des participants évolue
    if (syncDuration && eventId && estimate.formattedDuration) {
      await db
        .from('events')
        .update({ duration: estimate.formattedDuration })
        .eq('id', eventId);
    }

    // Ne renvoie les stats individuelles brutes que pour l'utilisateur authentifié lui-même (privacy ADR-AI-003)
    const creatorStats = user?.id ? (statsMap.get(user.id) ?? null) : null;

    return NextResponse.json({
      ok: true,
      creatorStats,
      estimate,
    });
  } catch (error) {
    console.error('[API /api/sorties/performance-estimate]', error);
    return NextResponse.json({ ok: false, error: 'estimate_failed' }, { status: 500 });
  }
}
