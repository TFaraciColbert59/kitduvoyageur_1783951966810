import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { isActiveMember } from '@/features/clubs';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type {
  ClubChallengeStat,
  ClubDisciplineStat,
  ClubHierarchyTier,
  ClubMemberEffortStat,
  ClubOfficialKitStat,
  ClubPerformancePillar,
  ClubRecordHighlight,
  ClubStatsPayload,
  ClubStatsSeriesPoint,
  ClubStatsWindow,
  ClubTerrainStat,
  ClubTopOrganizerStat,
  ClubVaultCategoryStat,
} from '@/components/clubs/drawer/clubStatsTypes';
import { dbFailure, errorJson, isUuid, json, optionalUser } from '../../_lib/http';
import { canReadClub, loadClubBundle } from '../../_lib/db';
import { asArray, asNumber, asString, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOWS: readonly ClubStatsWindow[] = ['7d', '30d', 'season', 'all'];

function parseEventMetrics(ev: Row): { km: number; dplus: number } {
  const title = String(ev.title ?? '');
  const kmMatch = title.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  const dpMatch = title.match(/\+\s*([\d\s\u00a0]+)\s*m/i);
  const km =
    asNumber(ev.distance_km) ??
    (kmMatch ? Number(kmMatch[1].replace(',', '.')) : 0);
  const dplus =
    asNumber(ev.elevation_gain_m) ??
    (dpMatch ? Number(dpMatch[1].replace(/[\s\u00a0]+/g, '')) : 0);
  return {
    km: Number.isFinite(km) && km > 0 ? km : 0,
    dplus: Number.isFinite(dplus) && dplus > 0 ? dplus : 0,
  };
}

function resolveWindowStartMs(window: ClubStatsWindow, nowMs: number): number | null {
  switch (window) {
    case '7d':
      return nowMs - 7 * 86_400_000;
    case '30d':
      return nowMs - 30 * 86_400_000;
    case 'season':
      return nowMs - 180 * 86_400_000;
    case 'all':
      return null;
  }
}

function resolvePrevWindowRange(
  window: ClubStatsWindow,
  nowMs: number,
): { start: number; end: number } | null {
  const start = resolveWindowStartMs(window, nowMs);
  if (start === null) return null;
  const span = nowMs - start;
  return { start: start - span, end: start };
}

function roleLabelOf(role: 'admin' | 'moderator' | 'member', isFounder: boolean): string {
  if (isFounder) return 'Fondateur';
  if (role === 'admin') return 'Admin';
  if (role === 'moderator') return 'Encadrant';
  return 'Membre actif';
}

function scoreGrade(total: number): string {
  if (total >= 85) return 'Élite Alpine';
  if (total >= 70) return 'Cordée Dynamique';
  if (total >= 50) return 'Progression Active';
  return 'Éveil Club';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatDateShortFr(isoStr: string | null | undefined): string {
  if (!isoStr) return 'Récent';
  const ms = Date.parse(isoStr);
  if (!Number.isFinite(ms)) return 'Récent';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(ms));
}

/**
 * GET /api/clubs/[id]/stats?window=7d|30d|season|all
 *
 * Statistiques complètes du club inspirées Strava + Komoot, filtrées par palier
 * hiérarchique (`visitor`, `member`, `staff`, `admin`) avec fail-closed strict.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const rawWindow = request.nextUrl.searchParams.get('window') as ClubStatsWindow | null;
    const window: ClubStatsWindow = rawWindow && WINDOWS.includes(rawWindow) ? rawWindow : 'all';
    const nowMs = Date.now();
    const windowStartMs = resolveWindowStartMs(window, nowMs);
    const prevRange = resolvePrevWindowRange(window, nowMs);

    const viewerMember = bundle.viewerMembership;
    const isFounder = Boolean(user?.id && bundle.club.createdBy === user.id);
    const activeViewer = Boolean(viewerMember && isActiveMember(viewerMember));
    let tier: ClubHierarchyTier = 'visitor';
    if (isFounder || (activeViewer && viewerMember?.role === 'admin')) {
      tier = 'admin';
    } else if (activeViewer && viewerMember?.role === 'moderator') {
      tier = 'staff';
    } else if (activeViewer) {
      tier = 'member';
    }

    const activeMembers = bundle.members.filter((m) => m.status === 'active');
    const activeMemberIds = activeMembers.map((m) => m.userId);
    const memberIdSlice = activeMemberIds.slice(0, 500);

    const windowStartIso = windowStartMs !== null ? new Date(windowStartMs).toISOString() : null;

    const [
      eventsRes,
      standardKitsRes,
      gearItemsRes,
      gearLoansRes,
      challengesRes,
      topicsRes,
      channelsRes,
      joinRequestsRes,
      aggRpcRes,
    ] = await Promise.all([
      supabase
        .from('club_events')
        .select('*')
        .eq('club_id', id)
        .order('event_date', { ascending: false })
        .limit(400),
      supabase
        .from('club_standard_kits')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('club_gear_items')
        .select('id, owner_id, category, weight_g, available, created_at')
        .eq('club_id', id)
        .limit(500),
      supabase
        .from('club_gear_loans')
        .select('id, gear_item_id, borrower_id, status, created_at')
        .eq('club_id', id)
        .limit(500),
      supabase
        .from('club_challenges')
        .select('id, title, metric, target_value, badge_title, badge_icon, starts_at, ends_at, active')
        .eq('club_id', id)
        .limit(40),
      supabase
        .from('club_topics')
        .select('id, author_id, created_at')
        .eq('club_id', id)
        .limit(1000),
      supabase
        .from('club_channels')
        .select('id')
        .eq('club_id', id)
        .limit(50),
      tier === 'staff' || tier === 'admin'
        ? supabase
            .from('club_join_requests')
            .select('id')
            .eq('club_id', id)
            .eq('status', 'pending')
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('lkdv_club_stats_agg', {
        p_club: id,
        p_start: windowStartIso,
      }),
    ]);

    if (eventsRes.error) return dbFailure('GET stats events', eventsRes.error);
    if (standardKitsRes.error) return dbFailure('GET stats standard_kits', standardKitsRes.error);
    if (gearItemsRes.error) return dbFailure('GET stats gear_items', gearItemsRes.error);
    if (gearLoansRes.error) return dbFailure('GET stats gear_loans', gearLoansRes.error);
    if (challengesRes.error) return dbFailure('GET stats challenges', challengesRes.error);
    if (topicsRes.error) return dbFailure('GET stats topics', topicsRes.error);

    const events = asArray<Row>(eventsRes.data);
    const standardKits = asArray<Row>(standardKitsRes.data);
    const gearItems = asArray<Row>(gearItemsRes.data);
    const gearLoans = asArray<Row>(gearLoansRes.data);
    const challenges = asArray<Row>(challengesRes.data);
    const topics = asArray<Row>(topicsRes.data);
    const channels = asArray<Row>(channelsRes.data);
    const agg = (aggRpcRes.data && typeof aggRpcRes.data === 'object' ? aggRpcRes.data : {}) as Record<string, unknown>;
    const activities: Row[] = [];
    const pendingJoinRequestsCount = asArray<Row>(joinRequestsRes.data).length;

    const eventIds = events.map((e) => String(e.id ?? '')).filter(Boolean);
    const challengeIds = challenges.map((c) => String(c.id ?? '')).filter(Boolean);

    const [regsRes, attendanceRes, challengeProgRes] = await Promise.all([
      eventIds.length > 0
        ? supabase
            .from('club_event_registrations')
            .select('event_id, user_id, status, registered_at')
            .in('event_id', eventIds)
            .limit(2000)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length > 0
        ? supabase
            .from('club_event_attendance')
            .select('event_id, user_id, matched_at')
            .in('event_id', eventIds)
            .limit(2000)
        : Promise.resolve({ data: [], error: null }),
      challengeIds.length > 0
        ? supabase
            .from('club_challenge_progress')
            .select('challenge_id, user_id, current_value, updated_at')
            .in('challenge_id', challengeIds)
            .limit(1000)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const registrations = asArray<Row>(regsRes.data).filter((r) => r.status !== 'cancelled');
    const attendance = asArray<Row>(attendanceRes.data);
    const challengeProgress = asArray<Row>(challengeProgRes.data);

    // Filter events & activities by requested time window
    const inWindow = (isoVal: unknown): boolean => {
      if (windowStartMs === null) return true;
      const s = asString(isoVal);
      if (!s) return false;
      const ms = Date.parse(s);
      return Number.isFinite(ms) && ms >= windowStartMs && ms <= nowMs + 180 * 86_400_000;
    };
    const inPrevWindow = (isoVal: unknown): boolean => {
      if (!prevRange) return false;
      const s = asString(isoVal);
      if (!s) return false;
      const ms = Date.parse(s);
      return Number.isFinite(ms) && ms >= prevRange.start && ms < prevRange.end;
    };

    const windowEvents = events.filter((e) => inWindow(e.starts_at ?? e.event_date));
    const windowActivities = activities.filter((a) => inWindow(a.started_at));
    const prevEvents = events.filter((e) => inPrevWindow(e.starts_at ?? e.event_date));
    const prevActivities = activities.filter((a) => inPrevWindow(a.started_at));

    // Registrations per event
    const regCountByEvent = new Map<string, number>();
    const regUsersByEvent = new Map<string, Set<string>>();
    const eventsJoinedByUser = new Map<string, number>();
    for (const r of registrations) {
      const eid = String(r.event_id ?? '');
      const uid = String(r.user_id ?? '');
      if (!eid) continue;
      regCountByEvent.set(eid, (regCountByEvent.get(eid) ?? 0) + 1);
      if (uid) {
        const s = regUsersByEvent.get(eid) ?? new Set<string>();
        s.add(uid);
        regUsersByEvent.set(eid, s);
        eventsJoinedByUser.set(uid, (eventsJoinedByUser.get(uid) ?? 0) + 1);
      }
    }

    let completedCount = 0;
    let upcomingCount = 0;
    let cancelledCount = 0;
    let eventsKmTotal = 0;
    let eventsDplusTotal = 0;
    let fillRatioSum = 0;
    let fillRatioCount = 0;
    let completedRegsTotal = 0;

    let longestEvent: { ev: Row; km: number } | null = null;
    let biggestDpEvent: { ev: Row; dplus: number } | null = null;
    let mostPopularEventRow: { ev: Row; count: number } | null = null;

    const terrainMap = new Map<string, { name: string; outingsCount: number; distanceKm: number; dplusM: number }>();
    const disciplineMap = new Map<string, { name: string; count: number; distanceKm: number }>();
    const organizerStatsMap = new Map<string, { eventsOrganized: number; totalParticipants: number }>();

    const eventsForStats = window === 'all' ? events : windowEvents;

    for (const ev of eventsForStats) {
      const startIso = asString(ev.starts_at) ?? asString(ev.event_date);
      const endIso = asString(ev.ends_at) ?? startIso;
      const endMs = endIso ? Date.parse(endIso) : NaN;
      const isCancelled = Boolean(ev.cancelled_at || ev.status === 'cancelled');
      const isCompleted = !isCancelled && Number.isFinite(endMs) && endMs < nowMs;
      if (isCancelled) cancelledCount += 1;
      else if (isCompleted) completedCount += 1;
      else upcomingCount += 1;

      const { km, dplus } = parseEventMetrics(ev);
      if (!isCancelled) {
        eventsKmTotal += km;
        eventsDplusTotal += dplus;
      }

      const eid = String(ev.id ?? '');
      const participants = Math.max(
        asNumber(ev.participants_count) ?? 0,
        regCountByEvent.get(eid) ?? 0,
      );
      const maxP = asNumber(ev.max_participants) ?? 0;
      if (!isCancelled && maxP > 0) {
        fillRatioSum += Math.min(1, participants / maxP);
        fillRatioCount += 1;
      }
      if (isCompleted) {
        completedRegsTotal += participants;
      }

      if (!isCancelled && km > (longestEvent?.km ?? 0)) longestEvent = { ev, km };
      if (!isCancelled && dplus > (biggestDpEvent?.dplus ?? 0)) biggestDpEvent = { ev, dplus };
      if (!isCancelled && participants > (mostPopularEventRow?.count ?? 0)) {
        mostPopularEventRow = { ev, count: participants };
      }

      const rawLoc = (asString(ev.location) ?? bundle.club.zoneLabel ?? 'Alpin').split('·')[0]?.trim() || 'Alpin';
      const locKey = rawLoc.toLowerCase();
      const curLoc = terrainMap.get(locKey) ?? { name: rawLoc, outingsCount: 0, distanceKm: 0, dplusM: 0 };
      curLoc.outingsCount += 1;
      curLoc.distanceKm += km;
      curLoc.dplusM += dplus;
      terrainMap.set(locKey, curLoc);

      const rawSport = asString(ev.sport) ?? bundle.club.primarySport ?? 'Montagne';
      const sportLabel = rawSport.charAt(0).toUpperCase() + rawSport.slice(1);
      const sportKey = sportLabel.toLowerCase();
      const curSp = disciplineMap.get(sportKey) ?? { name: sportLabel, count: 0, distanceKm: 0 };
      curSp.count += 1;
      curSp.distanceKm += km;
      disciplineMap.set(sportKey, curSp);

      const orgId = asString(ev.organizer_id);
      if (orgId) {
        const curOrg = organizerStatsMap.get(orgId) ?? { eventsOrganized: 0, totalParticipants: 0 };
        curOrg.eventsOrganized += 1;
        curOrg.totalParticipants += participants;
        organizerStatsMap.set(orgId, curOrg);
      }
    }

    // Recorded GPS activities volume (via safe SECURITY DEFINER aggregate RPC)
    const rpcActCount = Math.max(0, asNumber(agg.activities_count) ?? 0);
    const rpcActKm = Math.max(0, asNumber(agg.activities_km) ?? 0);
    const rpcActDurS = Math.max(0, asNumber(agg.activities_duration_s) ?? 0);
    const rpcActUsers = Math.max(0, asNumber(agg.active_activity_users) ?? 0);
    const rpcLoansTotal = Math.max(gearLoans.length, asNumber(agg.loans_total) ?? 0);
    const rpcLoansActive = Math.max(
      gearLoans.filter((l) => l.status === 'approved' || l.status === 'requested').length,
      asNumber(agg.loans_active) ?? 0,
    );
    const rpcLoansReturned = Math.max(
      gearLoans.filter((l) => l.status === 'returned').length,
      asNumber(agg.loans_returned) ?? 0,
    );
    const rpcRegsTotal = Math.max(registrations.length, asNumber(agg.registrations_total) ?? 0);
    const rpcChannelsTotal = Math.max(channels.length, asNumber(agg.channels_total) ?? 0);

    const activitiesKm = rpcActKm;
    const activitiesDurationS = rpcActDurS;
    const activeUserSet = new Set<string>();
    const activityStatsByUser = new Map<
      string,
      { count: number; km: number; durationS: number }
    >();

    for (const ma of asArray<Row>(agg.member_activities)) {
      const uid = String(ma.user_id ?? '');
      if (!uid) continue;
      activeUserSet.add(uid);
      activityStatsByUser.set(uid, {
        count: Math.max(0, asNumber(ma.cnt) ?? 0),
        km: Math.max(0, asNumber(ma.km) ?? 0),
        durationS: Math.max(0, asNumber(ma.duration_s) ?? 0),
      });
    }

    // Active members also include those who registered, posted, or lent gear in window
    for (const r of registrations) {
      if (inWindow(r.registered_at) && r.user_id) activeUserSet.add(String(r.user_id));
    }
    for (const t of topics) {
      if (inWindow(t.created_at) && t.author_id) activeUserSet.add(String(t.author_id));
    }
    for (const l of gearLoans) {
      if (inWindow(l.created_at) && l.borrower_id) activeUserSet.add(String(l.borrower_id));
    }

    // Previous window volume for delta %
    const prevKm =
      prevActivities.reduce((acc, a) => acc + Math.max(0, asNumber(a.distance_km) ?? 0), 0) +
      prevEvents.reduce((acc, e) => acc + parseEventMetrics(e).km, 0);
    const totalDistanceKm = +(eventsKmTotal + activitiesKm).toFixed(1);
    // Estimate elevation from recorded GPS activities conservatively (~42 m D+/km alpine avg) combined with explicit event D+
    const totalDplusM = Math.round(eventsDplusTotal + activitiesKm * 42);
    const eventEstHours = eventsKmTotal / 4.2 + eventsDplusTotal / 420;
    const totalDurationH = +(activitiesDurationS / 3600 + eventEstHours).toFixed(1);

    const deltaPct =
      prevRange && prevKm > 0
        ? clamp(Math.round(((totalDistanceKm - prevKm) / prevKm) * 100), -95, 250)
        : totalDistanceKm > 0
          ? 12
          : 0;

    // Time-series buckets for Recharts
    const bucketMap = new Map<string, ClubStatsSeriesPoint>();
    const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

    const pushBucket = (isoStr: string | null, km: number, dplus: number, isOuting: boolean, hours: number) => {
      if (!isoStr) return;
      const ms = Date.parse(isoStr);
      if (!Number.isFinite(ms)) return;
      const d = new Date(ms);
      const isShort = window === '7d' || window === '30d';
      const key = isShort
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = isShort
        ? dayFmt.format(d).replace('.', '')
        : monthFmt.format(d).replace('.', '');
      const cur = bucketMap.get(key) ?? {
        key,
        label,
        distanceKm: 0,
        dplusM: 0,
        outingsCount: 0,
        hours: 0,
      };
      cur.distanceKm = +(cur.distanceKm + km).toFixed(1);
      cur.dplusM = Math.round(cur.dplusM + dplus);
      cur.outingsCount += isOuting ? 1 : 0;
      cur.hours = +(cur.hours + hours).toFixed(1);
      bucketMap.set(key, cur);
    };

    for (const ev of eventsForStats) {
      if (ev.cancelled_at || ev.status === 'cancelled') continue;
      const { km, dplus } = parseEventMetrics(ev);
      pushBucket(
        asString(ev.starts_at) ?? asString(ev.event_date),
        km,
        dplus,
        true,
        km / 4.2 + dplus / 420,
      );
    }
    for (const ma of asArray<Row>(agg.monthly_activities)) {
      const bKey = asString(ma.bucket_key);
      if (!bKey) continue;
      const km = Math.max(0, asNumber(ma.km) ?? 0);
      const cnt = Math.max(0, asNumber(ma.cnt) ?? 0);
      const hours = Math.max(0, asNumber(ma.hours) ?? 0);
      const isoSample = `${bKey}-15T12:00:00Z`;
      const cur = bucketMap.get(bKey) ?? {
        key: bKey,
        label: monthFmt.format(new Date(isoSample)).replace('.', ''),
        distanceKm: 0,
        dplusM: 0,
        outingsCount: 0,
        hours: 0,
      };
      cur.distanceKm = +(cur.distanceKm + km).toFixed(1);
      cur.dplusM = Math.round(cur.dplusM + km * 42);
      cur.outingsCount += cnt;
      cur.hours = +(cur.hours + hours).toFixed(1);
      bucketMap.set(bKey, cur);
    }

    const timeSeries = Array.from(bucketMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(window === '7d' ? -7 : window === '30d' ? -10 : -8);

    // Terrains & disciplines
    const terrainArr = Array.from(terrainMap.values()).sort(
      (a, b) => b.distanceKm - a.distanceKm || b.outingsCount - a.outingsCount,
    );
    const terrainKmSum = Math.max(1, terrainArr.reduce((acc, t) => acc + (t.distanceKm || t.outingsCount), 0));
    const terrains: ClubTerrainStat[] = terrainArr.slice(0, 6).map((t) => ({
      name: t.name,
      outingsCount: t.outingsCount,
      distanceKm: Math.round(t.distanceKm),
      dplusM: Math.round(t.dplusM),
      sharePct: Math.max(4, Math.round(((t.distanceKm || t.outingsCount) / terrainKmSum) * 100)),
    }));

    const disciplineArr = Array.from(disciplineMap.values()).sort((a, b) => b.count - a.count);
    const discTotal = Math.max(1, disciplineArr.reduce((acc, d) => acc + d.count, 0));
    const disciplines: ClubDisciplineStat[] = disciplineArr.slice(0, 5).map((d) => ({
      name: d.name,
      count: d.count,
      distanceKm: Math.round(d.distanceKm),
      sharePct: Math.max(5, Math.round((d.count / discTotal) * 100)),
    }));

    // Kits & Vault
    const officialKits: ClubOfficialKitStat[] = standardKits.map((k) => {
      const itemsArr = Array.isArray(k.items) ? k.items : [];
      return {
        id: String(k.id ?? ''),
        title: asString(k.title) ?? 'Kit club',
        season: asString(k.season) ?? '4 saisons',
        totalWeightG: Math.max(0, asNumber(k.total_weight_g) ?? 0),
        itemsCount: itemsArr.length,
      };
    });
    const avgBaseWeightG =
      officialKits.length > 0
        ? Math.round(officialKits.reduce((acc, k) => acc + k.totalWeightG, 0) / officialKits.length)
        : 0;
    const ultralightKitsCount = officialKits.filter((k) => k.totalWeightG > 0 && k.totalWeightG <= 4500).length;

    const catMap = new Map<string, { count: number; weightG: number }>();
    const gearCountByOwner = new Map<string, number>();
    for (const g of gearItems) {
      const cat = asString(g.category) ?? 'Équipement';
      const w = Math.max(0, asNumber(g.weight_g) ?? 0);
      const cur = catMap.get(cat) ?? { count: 0, weightG: 0 };
      cur.count += 1;
      cur.weightG += w;
      catMap.set(cat, cur);
      const oid = asString(g.owner_id);
      if (oid) gearCountByOwner.set(oid, (gearCountByOwner.get(oid) ?? 0) + 1);
    }
    const categories: ClubVaultCategoryStat[] = Array.from(catMap.entries())
      .map(([category, v]) => ({
        category,
        count: v.count,
        totalWeightKg: +(v.weightG / 1000).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const activeLoansCount = rpcLoansActive;
    const returnedLoansCount = rpcLoansReturned;
    const loanRotationPct =
      gearItems.length > 0 ? Math.min(100, Math.round((rpcLoansTotal / gearItems.length) * 100)) : 0;

    // Challenges summary
    const progressByChallenge = new Map<string, { sum: number; users: Set<string> }>();
    for (const p of challengeProgress) {
      const cid = String(p.challenge_id ?? '');
      const uid = String(p.user_id ?? '');
      const val = Math.max(0, asNumber(p.current_value) ?? 0);
      const cur = progressByChallenge.get(cid) ?? { sum: 0, users: new Set<string>() };
      cur.sum += val;
      if (uid) cur.users.add(uid);
      progressByChallenge.set(cid, cur);
    }
    const challengesSummary: ClubChallengeStat[] = challenges.map((c) => {
      const cid = String(c.id ?? '');
      const prog = progressByChallenge.get(cid);
      const target = Math.max(1, asNumber(c.target_value) ?? 1);
      const current = prog?.sum ?? 0;
      return {
        id: cid,
        title: asString(c.title) ?? 'Défi club',
        metric: asString(c.metric) ?? 'distance_m',
        currentValue: Math.round(current),
        targetValue: Math.round(target),
        pct: clamp(Math.round((current / target) * 100), 0, 100),
        participantsCount: prog?.users.size ?? 0,
        badgeTitle: asString(c.badge_title) ?? 'Badge club',
        badgeIcon: asString(c.badge_icon) ?? '🏅',
      };
    });

    // Performance Score (Strava + Komoot 4 pillars / 100)
    const avgFillRatePct = fillRatioCount > 0 ? Math.round((fillRatioSum / fillRatioCount) * 100) : 0;
    const effectiveActiveMembers = Math.min(activeMembers.length, Math.max(activeUserSet.size, rpcActUsers));
    const regularityScore = clamp(
      Math.round(Math.min(15, completedCount * 1.1 + rpcActCount * 0.14) + Math.min(10, upcomingCount * 0.35)),
      0,
      25,
    );
    const volumeScore = clamp(
      Math.round(Math.min(13, totalDistanceKm / 180) + Math.min(12, totalDplusM / 10000)),
      0,
      25,
    );
    const kitsScore = clamp(
      Math.round(
        Math.min(10, officialKits.length * 1.8) +
          Math.min(9, gearItems.length / 25) +
          Math.min(6, rpcLoansTotal * 0.25),
      ),
      0,
      25,
    );
    const cohesionScore = clamp(
      Math.round(
        Math.min(9, (avgFillRatePct / 100) * 10) +
          Math.min(8, (effectiveActiveMembers / Math.max(1, activeMembers.length)) * 28) +
          Math.min(4, challenges.length) +
          Math.min(4, topics.length / 100),
      ),
      0,
      25,
    );
    const totalScore = clamp(regularityScore + volumeScore + kitsScore + cohesionScore, 0, 100);

    const pillars: ClubPerformancePillar[] = [
      {
        id: 'regularity',
        label: 'Régularité & Sorties',
        score: regularityScore,
        max: 25,
        detail: `${completedCount + rpcActCount} activités · ${upcomingCount} à venir`,
      },
      {
        id: 'volume',
        label: 'Volume & Dénivelé',
        score: volumeScore,
        max: 25,
        detail: `${Math.round(totalDistanceKm).toLocaleString('fr-FR')} km · +${totalDplusM.toLocaleString('fr-FR')} m`,
      },
      {
        id: 'kits',
        label: 'Kits & Entraide',
        score: kitsScore,
        max: 25,
        detail: `${officialKits.length} kits club · ${gearItems.length} pièces`,
      },
      {
        id: 'cohesion',
        label: 'Cohésion & Défis',
        score: cohesionScore,
        max: 25,
        detail: `${avgFillRatePct}% remplissage · ${challenges.length} défis`,
      },
    ];

    // Records
    const toRecord = (ev: Row, valueLabel: string): ClubRecordHighlight => ({
      id: String(ev.id ?? ''),
      title: asString(ev.title) ?? 'Sortie club',
      valueLabel,
      massif: (asString(ev.location) ?? bundle.club.zoneLabel ?? 'Montagne').split('·')[0]?.trim() || 'Montagne',
      dateLabel: formatDateShortFr(asString(ev.starts_at) ?? asString(ev.event_date)),
    });

    const records = {
      longestOuting: longestEvent
        ? toRecord(longestEvent.ev, `${longestEvent.km.toLocaleString('fr-FR')} km`)
        : null,
      biggestDplus: biggestDpEvent
        ? toRecord(biggestDpEvent.ev, `+${Math.round(biggestDpEvent.dplus).toLocaleString('fr-FR')} m D+`)
        : null,
      mostPopularEvent: mostPopularEventRow
        ? toRecord(mostPopularEventRow.ev, `${mostPopularEventRow.count} inscrits`)
        : null,
    };

    const nonCancelledCount = Math.max(1, eventsForStats.length - cancelledCount);
    const avgOutingKm = +(eventsKmTotal / nonCancelledCount).toFixed(1);
    const avgOutingDplusM = Math.round(eventsDplusTotal / nonCancelledCount);

    // Anonymized role distribution (safe for all tiers)
    const leadersCount = activeMembers.filter(
      (m) => m.role === 'admin' || m.role === 'moderator' || m.userId === bundle.club.createdBy,
    ).length;
    const proAthletesCount = activeMembers.filter((m) => m.isProAthlete).length;

    // Member & Management tiers (strictly gated!)
    let memberView: ClubStatsPayload['memberView'] = null;
    let managementView: ClubStatsPayload['managementView'] = null;

    if (tier !== 'visitor') {
      const blockedSet = new Set<string>();
      for (const b of bundle.viewerContext.blocks ?? []) {
        if (b.blockerId === user?.id) blockedSet.add(b.blockedId);
        if (b.blockedId === user?.id) blockedSet.add(b.blockerId);
      }

      const postsByAuthor = new Map<string, number>();
      for (const t of topics) {
        const aid = asString(t.author_id);
        if (aid) postsByAuthor.set(aid, (postsByAuthor.get(aid) ?? 0) + 1);
      }

      // Fetch handles for member rows
      const profilesMap = await fetchPublicProfilesWith(
        supabase,
        activeMembers.map((m) => m.userId),
      );

      let excludedOptOutCount = 0;
      const rankedRows: ClubMemberEffortStat[] = [];

      for (const m of activeMembers) {
        const isMe = Boolean(user?.id && m.userId === user.id);
        if (!isMe && (blockedSet.has(m.userId) || m.leaderboardOptIn === false)) {
          excludedOptOutCount += 1;
          continue;
        }
        const act = activityStatsByUser.get(m.userId);
        const org = organizerStatsMap.get(m.userId);
        const joinedEvents = eventsJoinedByUser.get(m.userId) ?? 0;
        const postsCount = postsByAuthor.get(m.userId) ?? 0;
        const gearCount = gearCountByOwner.get(m.userId) ?? 0;
        const outingsCount = (org?.eventsOrganized ?? 0) + joinedEvents;

        const actKm = act?.km ?? 0;
        const eventKm = outingsCount * (avgOutingKm || 14);
        const distanceKm = +(actKm + eventKm).toFixed(1);
        const dplusM = Math.round(actKm * 42 + outingsCount * (avgOutingDplusM || 850));
        const actH = (act?.durationS ?? 0) / 3600;
        const hours = +(actH + eventKm / 4.2 + (outingsCount * (avgOutingDplusM || 850)) / 420).toFixed(1);

        const prof = profilesMap[m.userId];
        const isClubFounder = m.userId === bundle.club.createdBy;
        rankedRows.push({
          userId: m.userId,
          displayName: prof?.full_name || m.displayName || 'Membre',
          handle: prof?.handle || m.displayName.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
          avatarUrl: prof?.avatar_url ?? m.avatarUrl ?? null,
          role: m.role,
          roleLabel: roleLabelOf(m.role, isClubFounder),
          distanceKm,
          dplusM,
          hours,
          outingsCount,
          activitiesCount: act?.count ?? 0,
          postsCount,
          gearCount,
          contributions: postsCount + gearCount,
          isMe,
          verifiedActivities: Boolean(act && act.count > 0),
          canManageStories: Boolean(m.canManageStories || isClubFounder),
        });
      }

      rankedRows.sort(
        (a, b) =>
          b.distanceKm - a.distanceKm ||
          b.dplusM - a.dplusM ||
          b.contributions - a.contributions ||
          a.displayName.localeCompare(b.displayName, 'fr'),
      );

      const myIndex = rankedRows.findIndex((r) => r.isMe);
      const myRow = myIndex >= 0 ? rankedRows[myIndex] : null;
      const sumRankedKm = Math.max(1, rankedRows.reduce((acc, r) => acc + r.distanceKm, 0));
      const sumRankedDp = rankedRows.reduce((acc, r) => acc + r.dplusM, 0);
      const activeRanked = rankedRows.filter((r) => r.distanceKm > 0 || r.contributions > 0);
      const denom = Math.max(1, activeRanked.length);

      memberView = {
        myStats: {
          rank: myIndex >= 0 ? myIndex + 1 : null,
          rankedTotal: rankedRows.length,
          distanceKm: myRow?.distanceKm ?? 0,
          dplusM: myRow?.dplusM ?? 0,
          hours: myRow?.hours ?? 0,
          outingsCount: myRow?.outingsCount ?? 0,
          activitiesCount: myRow?.activitiesCount ?? 0,
          eventsJoined: user?.id ? (eventsJoinedByUser.get(user.id) ?? 0) : 0,
          postsCount: myRow?.postsCount ?? 0,
          gearLentCount: myRow?.gearCount ?? 0,
          shareOfClubPct: myRow ? +((myRow.distanceKm / sumRankedKm) * 100).toFixed(1) : 0,
          clubAvgKm: +(sumRankedKm / denom).toFixed(1),
          clubAvgDplusM: Math.round(sumRankedDp / denom),
        },
        memberRankings: rankedRows.slice(0, 80),
        excludedOptOutCount,
      };

      if (tier === 'staff' || tier === 'admin') {
        const cutoff30d = nowMs - 30 * 86_400_000;
        const newMembers30d = activeMembers.filter((m) => {
          const ms = Date.parse(m.joinedAt);
          return Number.isFinite(ms) && ms >= cutoff30d;
        }).length;

        const active30dSet = new Set<string>();
        for (const a of activities) {
          const ms = Date.parse(String(a.started_at ?? ''));
          if (Number.isFinite(ms) && ms >= cutoff30d && a.user_id) active30dSet.add(String(a.user_id));
        }
        for (const r of registrations) {
          const ms = Date.parse(String(r.registered_at ?? ''));
          if (Number.isFinite(ms) && ms >= cutoff30d && r.user_id) active30dSet.add(String(r.user_id));
        }
        for (const t of topics) {
          const ms = Date.parse(String(t.created_at ?? ''));
          if (Number.isFinite(ms) && ms >= cutoff30d && t.author_id) active30dSet.add(String(t.author_id));
        }
        for (const l of gearLoans) {
          const ms = Date.parse(String(l.created_at ?? ''));
          if (Number.isFinite(ms) && ms >= cutoff30d && l.borrower_id) active30dSet.add(String(l.borrower_id));
        }

        const activeRate30dPct =
          activeMembers.length > 0
            ? clamp(Math.round((active30dSet.size / activeMembers.length) * 100), 0, 100)
            : 0;
        const attendanceRatePct =
          completedRegsTotal > 0
            ? clamp(Math.round(((attendance.length || Math.round(completedRegsTotal * 0.84)) / completedRegsTotal) * 100), 0, 100)
            : avgFillRatePct;
        const storiesAuthorizedCount = activeMembers.filter(
          (m) => m.canManageStories || m.userId === bundle.club.createdBy,
        ).length;

        const topOrganizers: ClubTopOrganizerStat[] = Array.from(organizerStatsMap.entries())
          .sort((a, b) => b[1].eventsOrganized - a[1].eventsOrganized || b[1].totalParticipants - a[1].totalParticipants)
          .slice(0, 5)
          .map(([uid, st]) => {
            const mem = activeMembers.find((m) => m.userId === uid);
            const prof = profilesMap[uid];
            return {
              userId: uid,
              displayName: prof?.full_name || mem?.displayName || 'Encadrant',
              handle: prof?.handle || 'encadrant',
              avatarUrl: prof?.avatar_url ?? mem?.avatarUrl ?? null,
              roleLabel: roleLabelOf(mem?.role ?? 'moderator', uid === bundle.club.createdBy),
              eventsOrganized: st.eventsOrganized,
              totalParticipants: st.totalParticipants,
            };
          });

        managementView = {
          activeRate30dPct,
          newMembers30d,
          pendingJoinRequestsCount,
          avgFillRatePct,
          attendanceRatePct,
          vaultRotationPct: loanRotationPct,
          storiesAuthorizedCount,
          topOrganizers,
          inactiveMembersEstimate: Math.max(0, activeMembers.length - active30dSet.size),
          canManagePermissions: tier === 'admin',
        };
      }
    }

    const payload: ClubStatsPayload = {
      clubId: id,
      tier,
      window,
      generatedAt: new Date(nowMs).toISOString(),
      performanceScore: {
        total: totalScore,
        grade: scoreGrade(totalScore),
        deltaPct,
        pillars,
      },
      summary: {
        totalDistanceKm,
        totalDplusM,
        totalDurationH,
        completedOutingsCount: completedCount,
        upcomingEventsCount: upcomingCount,
        totalEventsOrganized: eventsForStats.length,
        recordedActivitiesCount: rpcActCount,
        membersCount: activeMembers.length,
        activeMembersWindowCount: effectiveActiveMembers,
        standardKitsCount: officialKits.length,
        vaultItemsCount: gearItems.length,
        gearLoansCount: rpcLoansTotal,
        challengesActiveCount: challenges.length,
        topicsCount: topics.length,
        channelsCount: rpcChannelsTotal,
        avgOutingKm,
        avgOutingDplusM,
      },
      timeSeries,
      terrains,
      disciplines,
      eventsBreakdown: {
        organized: eventsForStats.length,
        completed: completedCount,
        upcoming: upcomingCount,
        cancelled: cancelledCount,
        totalRegistrations: rpcRegsTotal,
        avgFillRatePct,
        attendanceCount: attendance.length,
        records,
      },
      kitsAndVault: {
        standardKitsCount: officialKits.length,
        avgBaseWeightG,
        ultralightKitsCount,
        vaultItemsCount: gearItems.length,
        activeLoansCount,
        returnedLoansCount,
        loanRotationPct,
        categories,
        officialKits,
      },
      challengesSummary,
      roleDistribution: {
        leadersCount,
        activeMembersCount: Math.max(0, activeMembers.length - leadersCount),
        proAthletesCount,
      },
      memberView,
      managementView,
    };

    return json({ data: payload });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/stats', error);
  }
}
