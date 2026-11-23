'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import NumberFlow from '@number-flow/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  Award,
  Backpack,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Crown,
  Flame,
  Lock,
  Mountain,
  Package,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { KitCard, type KitProductView } from '@/components/compte/drawer/cards/KitCard';
import type { PickerProduct } from '@/features/community/create/kit/types';
import { mapClubStandardKitToKitEntry } from './clubKitAdapter';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false },
);
import { ClubEmptyCard, normalizeSearchText } from './ClubSharedUi';
import type {
  ClubChallengeItem,
  ClubDrawerNavHandler,
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubStandardKit,
  ClubToastPayload,
} from './ClubDrawerTypes';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';
import type {
  ClubHierarchyTier,
  ClubMemberEffortStat,
  ClubStatsPayload,
  ClubStatsWindow,
} from './clubStatsTypes';

export interface ClubStatsHubDrawerBodyProps {
  activeSubTab: number;
  active: boolean;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  challenges: ClubChallengeItem[];
  currentUserId?: string | null;
  windowKey?: ClubStatsWindow;
  onWindowChange?: (next: ClubStatsWindow) => void;
  memberSort?: MemberSortMetric;
  memberRoleFilter?: MemberRoleFilter;
  onToggleJoinClub: (clubId: string) => Promise<boolean> | void;
  onInspectMember: (member: ClubMemberData) => void;
  onInspectOuting: (outing: ClubOutingData) => void;
  onOpenMemberProfile: (handle: string) => void;
  onToggleMemberStoryPermission?: (
    userId: string,
    canManageStories: boolean,
  ) => Promise<boolean> | void;
  onSwitchTabAndLens: ClubDrawerNavHandler;
  onToast?: (toast: ClubToastPayload) => void;
}

type ChartMetricId = 'distanceKm' | 'dplusM' | 'outingsCount';
export type MemberSortMetric = 'distance' | 'dplus' | 'outings' | 'hours' | 'contributions';
export type MemberRoleFilter = 'all' | 'leaders' | 'members';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statsCache = new Map<string, { data: ClubStatsPayload; ts: number }>();
const STATS_TTL_MS = 45_000;

const WINDOW_OPTIONS: Array<{ id: ClubStatsWindow; label: string }> = [
  { id: '7d', label: '7 j' },
  { id: '30d', label: '30 j' },
  { id: 'season', label: 'Saison' },
  { id: 'all', label: 'Tout' },
];

const CHART_COLORS = ['#17402c', '#2d5f43', '#497a5b', '#6d9b77', '#96ba8e', '#b8d4b2'];

function canUseNumberFlow(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.customElements !== 'undefined' &&
    typeof window.ResizeObserver !== 'undefined' &&
    !/jsdom/i.test(window.navigator?.userAgent || '')
  );
}

function StatsAnimatedNumber({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  if (canUseNumberFlow()) {
    return (
      <NumberFlow
        value={safe}
        prefix={prefix}
        suffix={suffix}
        locales="fr-FR"
        format={{ maximumFractionDigits: decimals }}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
    );
  }
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {safe.toLocaleString('fr-FR', { maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

function tierBadgeMeta(tier: ClubHierarchyTier): { label: string; bg: string; color: string } {
  switch (tier) {
    case 'admin':
      return { label: 'Vue Direction', bg: '#17402c', color: '#ffffff' };
    case 'staff':
      return { label: 'Vue Encadrant', bg: 'rgba(23, 64, 44, 0.14)', color: '#17402c' };
    case 'member':
      return { label: 'Vue Membre', bg: 'rgba(91, 127, 85, 0.16)', color: '#24482a' };
    default:
      return { label: 'Vue Publique', bg: 'rgba(23, 43, 36, 0.08)', color: '#56665d' };
  }
}

function rankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { background: '#fef3c7', color: '#92400e', border: '1px solid rgba(180, 83, 9, 0.28)' };
  if (rank === 2) return { background: '#f1f5f9', color: '#334155', border: '1px solid rgba(71, 85, 105, 0.25)' };
  if (rank === 3) return { background: '#ffedd5', color: '#9a3412', border: '1px solid rgba(154, 52, 18, 0.25)' };
  return { background: 'rgba(23, 64, 44, 0.08)', color: '#17402c', border: '1px solid rgba(23, 64, 44, 0.12)' };
}

function buildLocalFallbackStats(
  props: ClubStatsHubDrawerBodyProps,
  window: ClubStatsWindow,
): ClubStatsPayload {
  const { activeClub, members, outings, posts, vaultGear, standardKits, challenges, currentUserId } = props;
  let tier: ClubHierarchyTier = 'visitor';
  if (
    activeClub.viewerRole === 'admin' ||
    (currentUserId && activeClub.createdBy === currentUserId) ||
    /fondateur|admin/i.test(activeClub.role || '')
  ) {
    tier = 'admin';
  } else if (activeClub.viewerRole === 'moderator' || /modérateur|encadrant|guide/i.test(activeClub.role || '')) {
    tier = 'staff';
  } else if (activeClub.joined) {
    tier = 'member';
  }

  const totalDistanceKm = Math.round(
    Math.max(activeClub.totalKm || 0, outings.reduce((a, o) => a + (o.km || 0), 0)),
  );
  const totalDplusM = Math.round(
    Math.max(activeClub.totalDplus || 0, outings.reduce((a, o) => a + (o.dplus || 0), 0)),
  );
  const totalDurationH = +(totalDistanceKm / 4.2 + totalDplusM / 420).toFixed(1);
  const completed = outings.filter((o) => o.status === 'completed').length;
  const upcoming = outings.filter((o) => o.status === 'upcoming' || o.status === 'live').length;
  const cancelled = outings.filter((o) => o.status === 'cancelled').length;

  const avgBaseWeightG =
    standardKits.length > 0
      ? Math.round(standardKits.reduce((a, k) => a + k.totalWeightG, 0) / standardKits.length)
      : 0;

  const catMap = new Map<string, { count: number; weightG: number }>();
  for (const g of vaultGear) {
    const cur = catMap.get(g.category || 'Matériel') ?? { count: 0, weightG: 0 };
    cur.count += 1;
    cur.weightG += g.weightG || 0;
    catMap.set(g.category || 'Matériel', cur);
  }

  const leaders = members.filter(
    (m) => m.rawRole === 'admin' || m.rawRole === 'moderator' || /fondateur|guide|encadrant/i.test(m.role),
  );

  const memberRankings: ClubMemberEffortStat[] = members.map((m, idx) => {
    const oCount = Math.max(1, m.outingsCount ?? (idx === 0 ? 4 : 2));
    const km = +(oCount * 14.5).toFixed(1);
    const dp = Math.round(oCount * 820);
    const pCount = posts.filter((p) => p.authorHandle === m.handle || p.authorName === m.name).length;
    const gCount = vaultGear.filter((g) => g.ownerHandle === m.handle || g.ownerName === m.name).length;
    return {
      userId: m.userId || m.id,
      displayName: m.name,
      handle: m.handle,
      avatarUrl: m.avatarUrl ?? null,
      role: m.rawRole ?? (m.role === 'Fondateur' ? 'admin' : m.role === 'Encadrant' || m.role === 'Guide & Sécurité' ? 'moderator' : 'member'),
      roleLabel: m.role,
      distanceKm: km,
      dplusM: dp,
      hours: +(km / 4.2 + dp / 420).toFixed(1),
      outingsCount: oCount,
      activitiesCount: oCount,
      postsCount: pCount,
      gearCount: gCount,
      contributions: pCount + gCount,
      isMe: Boolean(currentUserId && (m.userId === currentUserId || m.id === currentUserId)),
      verifiedActivities: false,
      canManageStories: Boolean(m.canManageStories || m.rawRole === 'admin' || m.rawRole === 'moderator'),
    };
  });

  const longest = [...outings].sort((a, b) => (b.km || 0) - (a.km || 0))[0];
  const steepest = [...outings].sort((a, b) => (b.dplus || 0) - (a.dplus || 0))[0];
  const popular = [...outings].sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0))[0];

  return {
    clubId: activeClub.id,
    tier,
    window,
    generatedAt: new Date().toISOString(),
    performanceScore: {
      total: Math.min(96, Math.max(48, 52 + Math.min(20, outings.length * 4) + Math.min(14, standardKits.length * 3))),
      grade: 'Cordée Dynamique',
      deltaPct: 11,
      pillars: [
        { id: 'regularity', label: 'Régularité & Sorties', score: 19, max: 25, detail: `${outings.length} sorties` },
        { id: 'volume', label: 'Volume & Dénivelé', score: 18, max: 25, detail: `${totalDistanceKm} km · +${totalDplusM} m` },
        { id: 'kits', label: 'Kits & Entraide', score: 17, max: 25, detail: `${standardKits.length} kits · ${vaultGear.length} pièces` },
        { id: 'cohesion', label: 'Cohésion & Défis', score: 18, max: 25, detail: `${challenges.length} défis actifs` },
      ],
    },
    summary: {
      totalDistanceKm,
      totalDplusM,
      totalDurationH,
      completedOutingsCount: completed,
      upcomingEventsCount: upcoming,
      totalEventsOrganized: outings.length,
      recordedActivitiesCount: outings.length,
      membersCount: Math.max(activeClub.membersCount, members.length),
      activeMembersWindowCount: members.length,
      standardKitsCount: standardKits.length,
      vaultItemsCount: vaultGear.length,
      gearLoansCount: vaultGear.filter((g) => g.reservedByMe).length,
      challengesActiveCount: challenges.length,
      topicsCount: posts.length,
      channelsCount: activeClub.salonsCount ?? 1,
      avgOutingKm: outings.length > 0 ? +(totalDistanceKm / outings.length).toFixed(1) : 0,
      avgOutingDplusM: outings.length > 0 ? Math.round(totalDplusM / outings.length) : 0,
    },
    timeSeries: [
      { key: 'm1', label: 'M-2', distanceKm: Math.round(totalDistanceKm * 0.25), dplusM: Math.round(totalDplusM * 0.25), outingsCount: Math.max(1, Math.round(outings.length * 0.25)), hours: Math.round(totalDurationH * 0.25) },
      { key: 'm2', label: 'M-1', distanceKm: Math.round(totalDistanceKm * 0.35), dplusM: Math.round(totalDplusM * 0.35), outingsCount: Math.max(1, Math.round(outings.length * 0.35)), hours: Math.round(totalDurationH * 0.35) },
      { key: 'm3', label: 'Actuel', distanceKm: Math.round(totalDistanceKm * 0.4), dplusM: Math.round(totalDplusM * 0.4), outingsCount: Math.max(1, Math.round(outings.length * 0.4)), hours: Math.round(totalDurationH * 0.4) },
    ],
    terrains: [
      {
        name: activeClub.massif || 'Alpin',
        outingsCount: Math.max(1, outings.length),
        distanceKm: totalDistanceKm,
        dplusM: totalDplusM,
        sharePct: 100,
      },
    ],
    disciplines: [
      {
        name: activeClub.category || 'Montagne',
        count: Math.max(1, outings.length),
        distanceKm: totalDistanceKm,
        sharePct: 100,
      },
    ],
    eventsBreakdown: {
      organized: outings.length,
      completed,
      upcoming,
      cancelled,
      totalRegistrations: outings.reduce((a, o) => a + (o.participantsCount || 0), 0),
      avgFillRatePct: 68,
      attendanceCount: completed,
      records: {
        longestOuting: longest ? { id: longest.id, title: longest.title, valueLabel: `${longest.km} km`, massif: longest.massif, dateLabel: longest.date } : null,
        biggestDplus: steepest ? { id: steepest.id, title: steepest.title, valueLabel: `+${steepest.dplus} m D+`, massif: steepest.massif, dateLabel: steepest.date } : null,
        mostPopularEvent: popular ? { id: popular.id, title: popular.title, valueLabel: `${popular.participantsCount} inscrits`, massif: popular.massif, dateLabel: popular.date } : null,
      },
    },
    kitsAndVault: {
      standardKitsCount: standardKits.length,
      avgBaseWeightG,
      ultralightKitsCount: standardKits.filter((k) => k.totalWeightG <= 4500).length,
      vaultItemsCount: vaultGear.length,
      activeLoansCount: vaultGear.filter((g) => g.reservedByMe).length,
      returnedLoansCount: 0,
      loanRotationPct: vaultGear.length > 0 ? 18 : 0,
      categories: Array.from(catMap.entries()).map(([category, v]) => ({
        category,
        count: v.count,
        totalWeightKg: +(v.weightG / 1000).toFixed(1),
      })),
      officialKits: standardKits.map((k) => ({
        id: k.id,
        title: k.title,
        season: k.season,
        totalWeightG: k.totalWeightG,
        itemsCount: k.itemsCount || k.items.length,
      })),
    },
    challengesSummary: challenges.map((c) => ({
      id: c.id,
      title: c.title,
      metric: c.unit,
      currentValue: c.current,
      targetValue: c.target,
      pct: Math.min(100, Math.round((c.current / Math.max(1, c.target)) * 100)),
      participantsCount: Math.max(1, members.length),
      badgeTitle: c.rewardBadge,
      badgeIcon: '🏅',
    })),
    roleDistribution: {
      leadersCount: leaders.length,
      activeMembersCount: Math.max(0, members.length - leaders.length),
      proAthletesCount: members.filter((m) => m.isProAthlete).length,
    },
    memberView:
      tier === 'visitor'
        ? null
        : {
            myStats: {
              rank: 1,
              rankedTotal: memberRankings.length,
              distanceKm: memberRankings[0]?.distanceKm ?? 0,
              dplusM: memberRankings[0]?.dplusM ?? 0,
              hours: memberRankings[0]?.hours ?? 0,
              outingsCount: memberRankings[0]?.outingsCount ?? 0,
              activitiesCount: memberRankings[0]?.activitiesCount ?? 0,
              eventsJoined: outings.filter((o) => o.rsvpJoined).length,
              postsCount: memberRankings[0]?.postsCount ?? 0,
              gearLentCount: memberRankings[0]?.gearCount ?? 0,
              shareOfClubPct: 18.5,
              clubAvgKm: 24,
              clubAvgDplusM: 1200,
            },
            memberRankings,
            excludedOptOutCount: 0,
          },
    managementView:
      tier === 'staff' || tier === 'admin'
        ? {
            activeRate30dPct: 58,
            newMembers30d: members.filter((m) => m.isNew7d).length,
            pendingJoinRequestsCount: activeClub.pendingRequestsCount ?? 0,
            avgFillRatePct: 68,
            attendanceRatePct: 86,
            vaultRotationPct: 18,
            storiesAuthorizedCount: leaders.length,
            topOrganizers: leaders.slice(0, 3).map((m) => ({
              userId: m.userId || m.id,
              displayName: m.name,
              handle: m.handle,
              avatarUrl: m.avatarUrl ?? null,
              roleLabel: m.role,
              eventsOrganized: Math.max(1, outings.length),
              totalParticipants: outings.reduce((a, o) => a + o.participantsCount, 0),
            })),
            inactiveMembersEstimate: Math.max(0, activeClub.membersCount - members.length),
            canManagePermissions: tier === 'admin',
          }
        : null,
  };
}

export function ClubStatsHubDrawerBody(props: ClubStatsHubDrawerBodyProps) {
  const {
    activeSubTab,
    active,
    activeClub,
    members,
    outings,
    onToggleJoinClub,
    onInspectMember,
    onInspectOuting,
    onOpenMemberProfile,
    onToggleMemberStoryPermission,
    onSwitchTabAndLens,
    onToast,
  } = props;

  const [localWindowKey, setLocalWindowKey] = useState<ClubStatsWindow>('all');
  const windowKey = props.windowKey ?? localWindowKey;
  const setWindowKey = props.onWindowChange ?? setLocalWindowKey;
  const [chartMetric, setChartMetric] = useState<ChartMetricId>('distanceKm');
  const [memberSearch, setMemberSearch] = useState('');
  const [internalMemberSort] = useState<MemberSortMetric>('distance');
  const memberSort = props.memberSort ?? internalMemberSort;
  const [internalMemberRoleFilter] = useState<MemberRoleFilter>('all');
  const memberRoleFilter = props.memberRoleFilter ?? internalMemberRoleFilter;
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [visibleMembersCount, setVisibleMembersCount] = useState(20);
  const [savingStoryPermId, setSavingStoryPermId] = useState<string | null>(null);
  const kitsPaneRef = useRef<HTMLDivElement | null>(null);
  const [kitsCompact, setKitsCompact] = useState(false);

  useEffect(() => {
    if (activeSubTab !== 2 || !active) {
      setKitsCompact(false);
      return;
    }
    const scroller = kitsPaneRef.current?.closest('.lkdv-lens-pane') as HTMLElement | null;
    if (!scroller) return;
    const onScroll = () => {
      const top = scroller.scrollTop;
      setKitsCompact((prev) => (top > 24 ? true : top <= 8 ? false : prev));
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [active, activeSubTab]);
  const [selectedKitProductState, setSelectedKitProductState] = useState<{
    kitTitle: string;
    totalWeightG: number;
    products: KitProductView[];
    index: number;
  } | null>(null);

  const cacheKey = `${activeClub.id}:${windowKey}`;
  const [remoteStats, setRemoteStats] = useState<ClubStatsPayload | null>(
    () => statsCache.get(cacheKey)?.data ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRealUuid = UUID_RE.test(activeClub.id);

  const fetchStats = useCallback(
    async (force = false) => {
      if (!isRealUuid || typeof fetch !== 'function') return;
      const hit = statsCache.get(cacheKey);
      if (!force && hit && Date.now() - hit.ts < STATS_TTL_MS) {
        setRemoteStats(hit.data);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(activeClub.id)}/stats?window=${encodeURIComponent(windowKey)}`,
          { credentials: 'include' },
        );
        const json = (await res.json().catch(() => null)) as {
          data?: ClubStatsPayload;
          message?: string;
          error?: string;
        } | null;
        if (!res.ok || !json?.data) {
          throw new Error(json?.message || json?.error || 'Impossible de charger les statistiques.');
        }
        statsCache.set(cacheKey, { data: json.data, ts: Date.now() });
        setRemoteStats(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau');
      } finally {
        setLoading(false);
      }
    },
    [activeClub.id, cacheKey, isRealUuid, windowKey],
  );

  useEffect(() => {
    if (!active) return;
    void fetchStats(false);
  }, [active, fetchStats]);

  const fallbackStats = useMemo(
    () => buildLocalFallbackStats(props, windowKey),
    [
      props.activeClub,
      props.challenges,
      props.currentUserId,
      props.members,
      props.outings,
      props.posts,
      props.standardKits,
      props.vaultGear,
      windowKey,
    ],
  );

  const stats: ClubStatsPayload = remoteStats ?? fallbackStats;
  const tierBadge = tierBadgeMeta(stats.tier);
  const hasRechartsEnv = typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined' && !/jsdom/i.test(window.navigator?.userAgent || '');

  const handleOpenMemberById = (userId: string, handle: string) => {
    const found = members.find((m) => m.userId === userId || m.id === userId || m.handle === handle);
    if (found && (found.rawRole === 'admin' || found.rawRole === 'moderator' || /fondateur|guide|encadrant/i.test(found.role))) {
      onInspectMember(found);
      return;
    }
    if (handle) onOpenMemberProfile(handle);
  };

  const handleOpenOutingById = (outingId: string) => {
    const found = outings.find((o) => o.id === outingId);
    if (found) onInspectOuting(found);
    else onSwitchTabAndLens(2, 0);
  };

  const handleToggleStoryPerm = async (row: ClubMemberEffortStat, nextVal: boolean) => {
    setSavingStoryPermId(row.userId);
    try {
      let ok = false;
      if (onToggleMemberStoryPermission) {
        const res = await onToggleMemberStoryPermission(row.userId, nextVal);
        ok = res !== false;
      } else if (isRealUuid && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'story_permission',
            userId: row.userId,
            canManageStories: nextVal,
          }),
        });
        ok = res.ok;
      }
      if (!ok) {
        onToast?.({ title: 'Autorisation refusée', subtitle: 'Action réservée aux administrateurs du club.' });
        return;
      }
      setRemoteStats((prev) => {
        if (!prev?.memberView) return prev;
        const updated: ClubStatsPayload = {
          ...prev,
          memberView: {
            ...prev.memberView,
            memberRankings: prev.memberView.memberRankings.map((m) =>
              m.userId === row.userId ? { ...m, canManageStories: nextVal } : m,
            ),
          },
          managementView: prev.managementView
            ? {
                ...prev.managementView,
                storiesAuthorizedCount: Math.max(
                  1,
                  prev.managementView.storiesAuthorizedCount + (nextVal ? 1 : -1),
                ),
              }
            : null,
        };
        statsCache.set(cacheKey, { data: updated, ts: Date.now() });
        return updated;
      });
      onToast?.({
        title: nextVal ? 'Habilitation Stories accordée ✓' : 'Habilitation Stories retirée',
        subtitle: row.displayName,
      });
    } finally {
      setSavingStoryPermId(null);
    }
  };

  // Shared compact header (period filter is anchored bottom-right next to lenses)
  const activeWindowLabel = WINDOW_OPTIONS.find((w) => w.id === windowKey)?.label ?? 'Tout';
  const renderTopControls = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#56665d',
          letterSpacing: '0.02em',
        }}
      >
        Période : <b style={{ color: '#172b24' }}>{activeWindowLabel}</b>
      </span>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 999,
            background: tierBadge.bg,
            color: tierBadge.color,
            whiteSpace: 'nowrap',
          }}
        >
          {tierBadge.label}
        </span>
        {isRealUuid ? (
          <button
            type="button"
            className="reseau-btn club-icon-pill"
            aria-label="Actualiser les statistiques du club"
            onClick={() => void fetchStats(true)}
            style={{ width: 28, minWidth: 28, height: 28 }}
          >
            <RefreshCw
              size={12}
              aria-hidden="true"
              style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined}
            />
          </button>
        ) : null}
      </div>
    </div>
  );

  // ============================================================================
  // 0.1 — SORTIES, TERRAINS & ÉVÉNEMENTS (KOMOOT-STYLE)
  // ============================================================================
  if (activeSubTab === 1) {
    const eb = stats.eventsBreakdown;
    return (
      <div className="club-drawer-pane-content" data-testid="club-stats-events-pane">
        {renderTopControls()}

        {/* Bilan Événements */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>Événements organisés</span>
            <b style={{ fontSize: 18, color: '#172b24' }}>
              <StatsAnimatedNumber value={eb.organized} />
            </b>
            <span style={{ fontSize: 10.5, color: '#56665d' }}>
              {eb.completed} réalisés · {eb.upcoming} à venir
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>Remplissage moyen</span>
            <b style={{ fontSize: 18, color: '#17402c' }}>
              <StatsAnimatedNumber value={eb.avgFillRatePct} suffix=" %" />
            </b>
            <span style={{ fontSize: 10.5, color: '#56665d' }}>
              {eb.totalRegistrations} inscriptions cumulées
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>Moyenne par sortie</span>
            <b style={{ fontSize: 16, color: '#172b24' }}>
              <StatsAnimatedNumber value={stats.summary.avgOutingKm} decimals={1} suffix=" km" />
            </b>
            <span style={{ fontSize: 10.5, color: '#56665d' }}>
              +{stats.summary.avgOutingDplusM.toLocaleString('fr-FR')} m D+ moyen
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>Activités GPS membres</span>
            <b style={{ fontSize: 18, color: '#172b24' }}>
              <StatsAnimatedNumber value={stats.summary.recordedActivitiesCount} />
            </b>
            <span style={{ fontSize: 10.5, color: '#56665d' }}>Traces synchronisées</span>
          </div>
        </div>

        {/* Profil d'exploration Komoot — Terrains & Massifs */}
        {stats.terrains.length > 0 ? (
          <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Compass size={15} color="#17402c" aria-hidden="true" />
                <b style={{ fontSize: 13, color: '#172b24' }}>Empreinte & Massifs parcourus</b>
              </div>
              <span style={{ fontSize: 11, color: '#56665d' }}>{stats.terrains.length} secteurs</span>
            </div>
            {stats.terrains.map((t, idx) => (
              <div key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5 }}>
                  <b style={{ color: '#172b24' }}>{t.name}</b>
                  <span style={{ color: '#56665d', fontVariantNumeric: 'tabular-nums' }}>
                    {t.outingsCount} sortie{t.outingsCount > 1 ? 's' : ''} · {t.distanceKm} km · +{t.dplusM.toLocaleString('fr-FR')} m
                  </span>
                </div>
                <div className="club-progress-track" style={{ height: 6 }}>
                  <div
                    className="club-progress-fill"
                    style={{
                      width: `${t.sharePct}%`,
                      background: CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Disciplines pratiquées */}
        {stats.disciplines.length > 0 ? (
          <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mountain size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Disciplines du club</b>
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
              {stats.disciplines.map((d, i) => (
                <div
                  key={d.name}
                  title={`${d.name} (${d.sharePct}%)`}
                  style={{
                    width: `${d.sharePct}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stats.disciplines.map((d, i) => (
                <span
                  key={d.name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(23, 64, 44, 0.06)',
                    color: '#172b24',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span>{d.name}</span>
                  <span style={{ color: '#56665d' }}>{d.sharePct}%</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Records du club (Strava Hall of Fame) */}
        {(eb.records.longestOuting || eb.records.biggestDplus || eb.records.mostPopularEvent) ? (
          <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Records du club</b>
            </div>
            {[
              { tag: 'Plus longue sortie', rec: eb.records.longestOuting, icon: <Route size={13} color="#17402c" /> },
              { tag: 'Plus gros D+', rec: eb.records.biggestDplus, icon: <Mountain size={13} color="#17402c" /> },
              { tag: 'Plus grosse affluence', rec: eb.records.mostPopularEvent, icon: <Users size={13} color="#17402c" /> },
            ]
              .filter((item) => Boolean(item.rec))
              .map(({ tag, rec, icon }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleOpenOutingById(rec!.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 14,
                    border: 0,
                    background: 'rgba(255, 255, 255, 0.72)',
                    boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.1)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: '#56665d', textTransform: 'uppercase' }}>
                      {icon}
                      <span>{tag}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec!.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#56665d' }}>
                      {rec!.massif} · {rec!.dateLabel}
                    </div>
                  </div>
                  <span className="club-badge-sage" style={{ flex: 'none', fontWeight: 800 }}>
                    {rec!.valueLabel}
                  </span>
                </button>
              ))}
          </div>
        ) : null}

        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{ width: '100%', justifyContent: 'center', height: 36 }}
          onClick={() => onSwitchTabAndLens(2, 0)}
        >
          <Calendar size={14} aria-hidden="true" />
          <span>Ouvrir l’agenda des sorties ({eb.organized})</span>
        </button>
      </div>
    );
  }

  // ============================================================================
  // 0.2 — KITS FAITS & PROPOSÉS + COFFRE & DÉFIS
  // ============================================================================
  if (activeSubTab === 2) {
    const kv = stats.kitsAndVault;
    return (
      <div ref={kitsPaneRef} className="club-drawer-pane-content" data-testid="club-stats-kits-pane">
        {renderTopControls()}

        {/* Catégories du coffre — barre segmentée + lignes lisibles (se réduit au scroll) */}
        {kv.categories.length > 0 ? (() => {
          const totalItems = Math.max(1, kv.categories.reduce((acc, c) => acc + c.count, 0));
          const maxCount = Math.max(1, ...kv.categories.map((c) => c.count));
          return (
            <div
              className="club-glass-card"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 4,
                padding: kitsCompact ? '8px 12px' : 12,
                display: 'flex',
                flexDirection: 'column',
                gap: kitsCompact ? 6 : 10,
                transition: 'padding 0.18s ease, gap 0.18s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={15} color="#17402c" aria-hidden="true" />
                  <b style={{ fontSize: 13, color: '#172b24' }}>Répartition du coffre matériel</b>
                </div>
                <span style={{ fontSize: 11, color: '#56665d', fontWeight: 600 }}>{kv.vaultItemsCount} pièces</span>
              </div>

              {/* Barre segmentée proportionnelle */}
              <div
                style={{
                  display: 'flex',
                  height: kitsCompact ? 6 : 10,
                  borderRadius: 999,
                  overflow: 'hidden',
                  gap: 2,
                  background: 'rgba(23, 64, 44, 0.06)',
                  transition: 'height 0.18s ease',
                }}
                aria-hidden="true"
              >
                {kv.categories.map((cat, idx) => {
                  const segPct = Math.max(4, Math.round((cat.count / totalItems) * 100));
                  return (
                    <div
                      key={cat.category}
                      style={{
                        width: `${segPct}%`,
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                        borderRadius: 999,
                      }}
                    />
                  );
                })}
              </div>

              {!kitsCompact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {kv.categories.map((cat, idx) => {
                    const pct = Math.round((cat.count / totalItems) * 100);
                    const barPct = Math.max(8, Math.round((cat.count / maxCount) * 100));
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, gap: 8 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }} />
                            <b style={{ color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cat.category}
                            </b>
                          </div>
                          <span style={{ color: '#56665d', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flex: 'none' }}>
                            <b style={{ color: '#17402c' }}>{cat.count}</b> ({pct}%) · {cat.totalWeightKg} kg
                          </span>
                        </div>
                        <div className="club-progress-track" style={{ height: 5 }}>
                          <div className="club-progress-fill" style={{ width: `${barPct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })() : null}

        {/* Kits officiels proposés par le club (KitCard canonique Profil/Carnet) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Backpack size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Kits proposés par le club</b>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTabAndLens(3, 1)}
              style={{
                border: 0,
                background: 'none',
                color: '#17402c',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>Voir dans le coffre</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          </div>
          {kv.officialKits.length === 0 ? (
            <ClubEmptyCard
              icon={<Backpack size={20} />}
              title="Aucun kit type publié"
              description="Les kits officiels du club apparaîtront ici dès leur création."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kv.officialKits.map((k) => {
                const matchedLocalKit = props.standardKits.find((sk) => sk.id === k.id || sk.title === k.title);
                const entry = mapClubStandardKitToKitEntry({
                  id: k.id,
                  title: k.title,
                  season: k.season,
                  totalWeightG: k.totalWeightG,
                  itemsCount: k.itemsCount,
                  items: matchedLocalKit?.items ?? [],
                });
                return (
                  <KitCard
                    key={k.id}
                    kit={entry}
                    viewer="visitor"
                    renderProductPane={({ product: p, products: list, index: idx, totalWeightG, onPrev, onNext, onBack }) => {
                      const pickerProduct: PickerProduct = {
                        key: p.id,
                        source: 'inventory',
                        id: p.id,
                        name: p.name,
                        brand: p.brand || null,
                        category: p.category || null,
                        weightG: p.weightG || null,
                        image: p.image || null,
                        wear: null,
                        conditionLabel: p.condition || 'Équipement club',
                        description: p.description || `Inclus dans ${k.title}.`,
                        priceLabel: null,
                        owner: null,
                        cartable: null,
                        ownershipId: null,
                        productId: null,
                      };
                      return (
                        <KitProductSheetV2
                          embedded
                          product={pickerProduct}
                          initialCategory={p.category || undefined}
                          currentKitWeightG={totalWeightG || k.totalWeightG}
                          alreadyInKit
                          positionLabel={`${idx + 1} / ${list.length}`}
                          hasPrev={idx > 0}
                          hasNext={idx < list.length - 1}
                          onPrev={onPrev}
                          onNext={onNext}
                          onAdd={() => onBack()}
                          onClose={onBack}
                        />
                      );
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Défis collectifs en cours */}
        {stats.challengesSummary.length > 0 ? (
          <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={15} color="#17402c" aria-hidden="true" />
                <b style={{ fontSize: 13, color: '#172b24' }}>Défis collectifs ({stats.challengesSummary.length})</b>
              </div>
              <button
                type="button"
                onClick={() => onSwitchTabAndLens(3, 3)}
                style={{ border: 0, background: 'none', color: '#17402c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Voir tout →
              </button>
            </div>
            {stats.challengesSummary.map((c) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <b style={{ color: '#172b24' }}>
                    {c.badgeIcon} {c.title}
                  </b>
                  <span style={{ color: '#17402c', fontWeight: 700 }}>{c.pct}%</span>
                </div>
                <div className="club-progress-track" style={{ height: 5 }}>
                  <div className="club-progress-fill" style={{ width: `${c.pct}%` }} />
                </div>
                <span style={{ fontSize: 10.5, color: '#56665d' }}>
                  {c.participantsCount} participant{c.participantsCount > 1 ? 's' : ''} · Badge {c.badgeTitle}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {selectedKitProductState &&
        selectedKitProductState.products[selectedKitProductState.index] &&
        typeof document !== 'undefined'
          ? createPortal(
              (() => {
                const p = selectedKitProductState.products[selectedKitProductState.index];
                const product: PickerProduct = {
                  key: p.id,
                  source: 'inventory',
                  id: p.id,
                  name: p.name,
                  brand: p.brand || null,
                  category: p.category || null,
                  weightG: p.weightG || null,
                  image: p.image || null,
                  wear: null,
                  conditionLabel: p.condition || 'Équipement club',
                  description: p.description || `Inclus dans ${selectedKitProductState.kitTitle}.`,
                  priceLabel: null,
                  owner: null,
                  cartable: null,
                  ownershipId: null,
                  productId: null,
                };
                return (
                  <KitProductSheetV2
                    product={product}
                    initialCategory={p.category || undefined}
                    currentKitWeightG={selectedKitProductState.totalWeightG}
                    alreadyInKit
                    positionLabel={`${selectedKitProductState.index + 1} / ${selectedKitProductState.products.length}`}
                    hasPrev={selectedKitProductState.index > 0}
                    hasNext={selectedKitProductState.index < selectedKitProductState.products.length - 1}
                    onPrev={() =>
                      setSelectedKitProductState((s) =>
                        s && s.index > 0 ? { ...s, index: s.index - 1 } : s,
                      )
                    }
                    onNext={() =>
                      setSelectedKitProductState((s) =>
                        s && s.index < s.products.length - 1 ? { ...s, index: s.index + 1 } : s,
                      )
                    }
                    onAdd={() => setSelectedKitProductState(null)}
                    onClose={() => setSelectedKitProductState(null)}
                  />
                );
              })(),
              document.body,
            )
          : null}
      </div>
    );
  }

  // ============================================================================
  // 0.3 — EFFORTS MEMBRES & PILOTAGE (HIÉRARCHIE VISITEUR / MEMBRE / STAFF-ADMIN)
  // ============================================================================
  if (activeSubTab === 3) {
    const mv = stats.memberView;
    const mgmt = stats.managementView;

    if (!mv) {
      return (
        <div className="club-drawer-pane-content" data-testid="club-stats-members-pane">
          {renderTopControls()}

          <div className="club-glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Users size={16} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13.5, color: '#172b24' }}>Composition publique de la cordée</b>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ padding: '8px', borderRadius: 14, background: 'rgba(23, 64, 44, 0.06)' }}>
                <div style={{ fontSize: 10.5, color: '#56665d' }}>Membres</div>
                <b style={{ fontSize: 16, color: '#172b24' }}>{stats.summary.membersCount}</b>
              </div>
              <div style={{ padding: '8px', borderRadius: 14, background: 'rgba(23, 64, 44, 0.06)' }}>
                <div style={{ fontSize: 10.5, color: '#56665d' }}>Encadrants</div>
                <b style={{ fontSize: 16, color: '#17402c' }}>{stats.roleDistribution.leadersCount}</b>
              </div>
              <div style={{ padding: '8px', borderRadius: 14, background: 'rgba(23, 64, 44, 0.06)' }}>
                <div style={{ fontSize: 10.5, color: '#56665d' }}>Actifs</div>
                <b style={{ fontSize: 16, color: '#172b24' }}>{stats.summary.activeMembersWindowCount}</b>
              </div>
            </div>
          </div>

          <div className="club-glass-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#17402c', fontWeight: 700, fontSize: 13 }}>
              <Lock size={14} aria-hidden="true" />
              <span>Classements individuels réservés aux membres</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: '#56665d' }}>
              Rejoins {activeClub.name} pour comparer tes efforts à la cordée, suivre ton rang et accéder aux classements détaillés.
            </p>
            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              style={{ height: 34, padding: '0 14px', fontSize: 12 }}
              onClick={() => void onToggleJoinClub(activeClub.id)}
            >
              <UserPlus size={14} aria-hidden="true" />
              <span>Rejoindre {activeClub.name}</span>
            </button>
          </div>
        </div>
      );
    }

    const q = normalizeSearchText(memberSearch);
    const sortedMembers = [...mv.memberRankings]
      .filter((r) => {
        if (memberRoleFilter === 'leaders' && r.role === 'member') return false;
        if (memberRoleFilter === 'members' && r.role !== 'member') return false;
        if (!q) return true;
        return normalizeSearchText(`${r.displayName} ${r.handle} ${r.roleLabel}`).includes(q);
      })
      .sort((a, b) => {
        if (memberSort === 'dplus') return b.dplusM - a.dplusM;
        if (memberSort === 'outings') return b.outingsCount - a.outingsCount;
        if (memberSort === 'hours') return b.hours - a.hours;
        if (memberSort === 'contributions') return b.contributions - a.contributions;
        return b.distanceKm - a.distanceKm;
      });

    const metricVal = (r: ClubMemberEffortStat): number => {
      if (memberSort === 'dplus') return r.dplusM;
      if (memberSort === 'outings') return r.outingsCount;
      if (memberSort === 'hours') return r.hours;
      if (memberSort === 'contributions') return r.contributions;
      return r.distanceKm;
    };
    const metricLabel = (r: ClubMemberEffortStat): string => {
      if (memberSort === 'dplus') return `+${r.dplusM.toLocaleString('fr-FR')} m`;
      if (memberSort === 'outings') return `${r.outingsCount} sorties`;
      if (memberSort === 'hours') return `${r.hours} h`;
      if (memberSort === 'contributions') return `${r.contributions} contrib.`;
      return `${r.distanceKm} km`;
    };

    const topMetric = Math.max(1, sortedMembers[0] ? metricVal(sortedMembers[0]) : 1);
    const visible = sortedMembers.slice(0, visibleMembersCount);
    const remaining = Math.max(0, sortedMembers.length - visible.length);

    return (
      <div className="club-drawer-pane-content" data-testid="club-stats-members-pane">
        {renderTopControls()}

        {/* COUCHE PILOTAGE STAFF / ADMIN */}
        {mgmt ? (
          <div
            className="club-glass-card"
            data-testid="club-stats-management-panel"
            style={{
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'linear-gradient(145deg, rgba(23, 64, 44, 0.08), rgba(255, 255, 255, 0.88))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crown size={15} color="#17402c" aria-hidden="true" />
                <b style={{ fontSize: 13, color: '#172b24' }}>Pilotage & Santé du club (30 j)</b>
              </div>
              {mgmt.pendingJoinRequestsCount > 0 ? (
                <button
                  type="button"
                  className="club-badge-forest"
                  style={{ border: 0, cursor: 'pointer', fontSize: 10 }}
                  onClick={() => onSwitchTabAndLens(1, 1)}
                >
                  {mgmt.pendingJoinRequestsCount} demande{mgmt.pendingJoinRequestsCount > 1 ? 's' : ''}
                </button>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Actifs 30j</div>
                <b style={{ fontSize: 14, color: '#17402c' }}>{mgmt.activeRate30dPct}%</b>
              </div>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Nouveaux 30j</div>
                <b style={{ fontSize: 14, color: '#172b24' }}>+{mgmt.newMembers30d}</b>
              </div>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Présence</div>
                <b style={{ fontSize: 14, color: '#172b24' }}>{mgmt.attendanceRatePct}%</b>
              </div>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Remplissage</div>
                <b style={{ fontSize: 14, color: '#172b24' }}>{mgmt.avgFillRatePct}%</b>
              </div>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Rotation kits</div>
                <b style={{ fontSize: 14, color: '#172b24' }}>{mgmt.vaultRotationPct}%</b>
              </div>
              <div style={{ padding: '7px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.82)' }}>
                <div style={{ fontSize: 10, color: '#56665d' }}>Habilités Stories</div>
                <b style={{ fontSize: 14, color: '#17402c' }}>{mgmt.storiesAuthorizedCount}</b>
              </div>
            </div>

            {mgmt.topOrganizers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#56665d' }}>
                  Top encadrants / organisateurs
                </span>
                {mgmt.topOrganizers.slice(0, 3).map((org) => (
                  <div
                    key={org.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      padding: '5px 8px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.72)',
                    }}
                  >
                    <b style={{ color: '#172b24' }}>{org.displayName}</b>
                    <span style={{ color: '#56665d', fontSize: 11 }}>
                      {org.eventsOrganized} sorties · {org.totalParticipants} inscrits
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Recherche & Tri classement membres */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
            <input
              type="text"
              className="club-glass-input"
              style={{ paddingLeft: 30, paddingRight: memberSearch ? 28 : 10, width: '100%' }}
              placeholder="Rechercher un membre dans le classement…"
              aria-label="Rechercher un membre dans les statistiques"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
            {memberSearch ? (
              <button
                type="button"
                onClick={() => setMemberSearch('')}
                aria-label="Effacer la recherche"
                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {mv.excludedOptOutCount > 0 ? (
          <div style={{ fontSize: 11, color: '#56665d', padding: '0 4px' }}>
            {mv.excludedOptOutCount} membre{mv.excludedOptOutCount > 1 ? 's' : ''} masqué
            {mv.excludedOptOutCount > 1 ? 's' : ''} selon leurs préférences de confidentialité.
          </div>
        ) : null}

        {visible.length === 0 ? (
          <ClubEmptyCard
            icon={<Users size={20} />}
            title="Aucun membre pour ce filtre"
            description="Modifiez la recherche ou le rôle pour afficher le classement."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {visible.map((row, idx) => {
              const rank = idx + 1;
              const pct = Math.max(5, Math.min(100, Math.round((metricVal(row) / topMetric) * 100)));
              const expanded = expandedUserId === row.userId;
              return (
                <div
                  key={row.userId}
                  className="club-glass-card"
                  style={{
                    padding: '9px 11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    boxShadow: row.isMe
                      ? 'inset 0 0 0 1.5px rgba(23, 64, 44, 0.34), 0 4px 12px rgba(16, 32, 25, 0.06)'
                      : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedUserId((cur) => (cur === row.userId ? null : row.userId))}
                    aria-expanded={expanded}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        ...rankBadgeStyle(rank),
                        minWidth: 26,
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 999,
                        fontSize: 10.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      #{rank}
                    </span>

                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'rgba(23, 64, 44, 0.12)',
                          color: '#17402c',
                          fontSize: 12,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                          flex: 'none',
                        }}
                      >
                        {row.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <b style={{ fontSize: 12.5, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.displayName}
                        </b>
                        {row.isMe ? <span className="club-badge-forest" style={{ fontSize: 9 }}>Vous</span> : null}
                        {row.verifiedActivities ? <span className="club-badge-sage" style={{ fontSize: 9 }}>GPS ✓</span> : null}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#56665d' }}>
                        {row.roleLabel} · {row.outingsCount} sortie{row.outingsCount > 1 ? 's' : ''} · +{row.dplusM.toLocaleString('fr-FR')} m
                      </div>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                      <b style={{ fontSize: 12.5, color: '#17402c', fontVariantNumeric: 'tabular-nums' }}>
                        {metricLabel(row)}
                      </b>
                      {expanded ? <ChevronUp size={13} color="#56665d" /> : <ChevronDown size={13} color="#56665d" />}
                    </div>
                  </button>

                  <div className="club-progress-track" style={{ height: 4 }}>
                    <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                  </div>

                  {expanded ? (
                    <div style={{ paddingTop: 7, borderTop: '1px solid rgba(23, 64, 44, 0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        <div style={{ padding: '5px 8px', borderRadius: 10, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Distance</div>
                          <b style={{ fontSize: 12 }}>{row.distanceKm} km</b>
                        </div>
                        <div style={{ padding: '5px 8px', borderRadius: 10, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Dénivelé D+</div>
                          <b style={{ fontSize: 12 }}>+{row.dplusM.toLocaleString('fr-FR')} m</b>
                        </div>
                        <div style={{ padding: '5px 8px', borderRadius: 10, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Effort</div>
                          <b style={{ fontSize: 12 }}>{row.hours} h</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#56665d' }}>
                        <span>{row.postsCount} pub. · {row.gearCount} matériel prêté</span>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                          onClick={() => handleOpenMemberById(row.userId, row.handle)}
                        >
                          <span>Profil</span>
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {remaining > 0 ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ width: '100%', justifyContent: 'center', height: 34 }}
                onClick={() => setVisibleMembersCount((n) => n + 25)}
              >
                Afficher 25 membres de plus ({remaining} restants)
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 0.0 — PERFORMANCE DU CLUB (STRAVA + KOMOOT SCORE & COURBE D'EFFORT)
  // ============================================================================
  const score = stats.performanceScore;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(100, Math.max(0, score.total)) / 100) * circumference;

  const chartMeta: Record<ChartMetricId, { label: string; unit: string }> = {
    distanceKm: { label: 'Distance', unit: 'km' },
    dplusM: { label: 'Dénivelé D+', unit: 'm' },
    outingsCount: { label: 'Sorties', unit: '' },
  };

  return (
    <div className="club-drawer-pane-content" data-testid="club-stats-perf-pane">
      {renderTopControls()}

      {error ? (
        <div
          className="club-glass-card"
          role="alert"
          style={{ padding: '8px 10px', fontSize: 11.5, color: '#926614', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Aperçu local ({error})</span>
          <button type="button" className="lkdv-carnet-btn-soft" style={{ height: 26, fontSize: 11 }} onClick={() => void fetchStats(true)}>
            Réessayer
          </button>
        </div>
      ) : null}

      {/* 1. SCORE DE PERFORMANCE DU CLUB (ANNEAU STRAVA / KOMOOT) */}
      <div
        className="club-glass-card"
        data-testid="club-performance-score-card"
        style={{
          padding: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
          background: 'linear-gradient(145deg, rgba(23, 64, 44, 0.09) 0%, rgba(255, 255, 255, 0.9) 65%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ position: 'relative', width: 78, height: 78, flex: 'none' }}>
            <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="39" cy="39" r={radius} fill="none" stroke="rgba(23, 64, 44, 0.12)" strokeWidth="7" />
              <circle
                cx="39"
                cy="39"
                r={radius}
                fill="none"
                stroke="#17402c"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.55s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <b style={{ fontSize: 21, lineHeight: 1, color: '#17402c' }}>
                <StatsAnimatedNumber value={score.total} />
              </b>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#56665d' }}>/ 100</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#56665d' }}>
              Score de performance
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#172b24', marginTop: 1 }}>
              {score.grade}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span className="club-badge-sage" style={{ fontSize: 10.5 }}>
                <TrendingUp size={11} aria-hidden="true" style={{ marginRight: 3 }} />
                {score.deltaPct >= 0 ? `+${score.deltaPct}%` : `${score.deltaPct}%`}
              </span>
              <span style={{ fontSize: 11, color: '#56665d' }}>
                {stats.summary.membersCount} membres · {stats.summary.activeMembersWindowCount} actifs
              </span>
            </div>
          </div>
        </div>

        {/* 4 Piliers /25 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {score.pillars.map((p) => {
            const pct = Math.round((p.score / Math.max(1, p.max)) * 100);
            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                  <span style={{ fontWeight: 700, color: '#172b24' }}>{p.label}</span>
                  <b style={{ color: '#17402c', fontVariantNumeric: 'tabular-nums' }}>
                    {p.score}/{p.max}
                  </b>
                </div>
                <div className="club-progress-track" style={{ height: 4 }}>
                  <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 9.5, color: '#56665d' }}>{p.detail}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. KPI PRINCIPAUX 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Route size={13} color="#17402c" aria-hidden="true" />
            <span>Distance cumulée</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24' }}>
            <StatsAnimatedNumber value={Math.round(stats.summary.totalDistanceKm)} suffix=" km" />
          </b>
        </div>

        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Mountain size={13} color="#17402c" aria-hidden="true" />
            <span>Dénivelé D+</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24' }}>
            <StatsAnimatedNumber value={stats.summary.totalDplusM} prefix="+" suffix=" m" />
          </b>
        </div>

        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Activity size={13} color="#17402c" aria-hidden="true" />
            <span>Sorties & activités</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24' }}>
            <StatsAnimatedNumber value={stats.summary.completedOutingsCount + stats.summary.recordedActivitiesCount} />
          </b>
        </div>

        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Clock size={13} color="#17402c" aria-hidden="true" />
            <span>Temps d’effort</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24' }}>
            <StatsAnimatedNumber value={Math.round(stats.summary.totalDurationH)} suffix=" h" />
          </b>
        </div>
      </div>

      {/* 3. COURBE D'EFFORT INTERACTIVE RECHARTS (STRAVA STYLE) */}
      {stats.timeSeries.length > 0 ? (
        <div className="club-glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Courbe d’effort</b>
            </div>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {(
                [
                  { id: 'distanceKm', label: 'km' },
                  { id: 'dplusM', label: 'D+' },
                  { id: 'outingsCount', label: 'Sorties' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setChartMetric(m.id)}
                  style={{
                    height: 24,
                    padding: '0 8px',
                    borderRadius: 999,
                    border: 0,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: chartMetric === m.id ? '#17402c' : 'rgba(23, 64, 44, 0.08)',
                    color: chartMetric === m.id ? '#ffffff' : '#17402c',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {hasRechartsEnv ? (
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timeSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lkdvClubStatsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#17402c" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#5b7f55" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 64, 44, 0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#56665d' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(23, 64, 44, 0.14)',
                      background: 'rgba(255, 255, 255, 0.96)',
                      fontSize: 11.5,
                    }}
                    formatter={(value: number | string) => [
                      `${Number(value).toLocaleString('fr-FR')}${chartMeta[chartMetric].unit ? ` ${chartMeta[chartMetric].unit}` : ''}`,
                      chartMeta[chartMetric].label,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMetric}
                    stroke="#17402c"
                    strokeWidth={2.2}
                    fill="url(#lkdvClubStatsGrad)"
                    dot={{ r: 3, fill: '#17402c', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: '#17402c' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 64 }}>
              {stats.timeSeries.map((pt) => (
                <div key={pt.key} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
                  <b>{pt[chartMetric]}</b>
                  <div style={{ color: '#56665d' }}>{pt.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 4. BLOC ADAPTÉ À LA HIÉRARCHIE (MA PLACE POUR MEMBRES / VITRINE POUR VISITEURS) */}
      {stats.memberView ? (
        <div
          className="club-glass-card"
          data-testid="club-stats-my-contribution"
          style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Flame size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Ma contribution dans le club</b>
            </div>
            {stats.memberView.myStats.rank ? (
              <span className="club-badge-forest" style={{ fontSize: 10.5 }}>
                Rang #{stats.memberView.myStats.rank} / {stats.memberView.myStats.rankedTotal}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
              <div style={{ fontSize: 10, color: '#56665d' }}>Mes km</div>
              <b style={{ fontSize: 13, color: '#172b24' }}>{stats.memberView.myStats.distanceKm} km</b>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
              <div style={{ fontSize: 10, color: '#56665d' }}>Mon D+</div>
              <b style={{ fontSize: 13, color: '#172b24' }}>+{stats.memberView.myStats.dplusM.toLocaleString('fr-FR')} m</b>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
              <div style={{ fontSize: 10, color: '#56665d' }}>Part club</div>
              <b style={{ fontSize: 13, color: '#17402c' }}>{stats.memberView.myStats.shareOfClubPct}%</b>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#56665d', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <span>
              Moy. club : {stats.memberView.myStats.clubAvgKm} km · +{stats.memberView.myStats.clubAvgDplusM.toLocaleString('fr-FR')} m
            </span>
            <span>
              {stats.memberView.myStats.eventsJoined} sorties · {stats.memberView.myStats.gearLentCount} prêtés
            </span>
          </div>
        </div>
      ) : (
        <div
          className="club-glass-card"
          data-testid="club-stats-visitor-cta"
          style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 12.5, color: '#172b24', display: 'block' }}>
              Compare tes efforts à la cordée
            </b>
            <span style={{ fontSize: 11, color: '#56665d' }}>
              Rejoins le club pour débloquer ton rang, le classement membres et les kits.
            </span>
          </div>
          <button
            type="button"
            className="lkdv-carnet-btn-primary"
            style={{ height: 32, padding: '0 12px', fontSize: 11.5, flex: 'none' }}
            onClick={() => void onToggleJoinClub(activeClub.id)}
          >
            Rejoindre
          </button>
        </div>
      )}

      {/* 5. ACCÈS RAPIDE AUX SOUS-ANALYSES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button
          type="button"
          className="club-glass-card"
          style={{ border: 0, cursor: 'pointer', padding: '9px 8px', textAlign: 'left' }}
          onClick={() => onSwitchTabAndLens(0, 1)}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#172b24' }}>Événements</div>
          <div style={{ fontSize: 10.5, color: '#56665d', marginTop: 2 }}>{stats.summary.totalEventsOrganized} sorties</div>
        </button>
        <button
          type="button"
          className="club-glass-card"
          style={{ border: 0, cursor: 'pointer', padding: '9px 8px', textAlign: 'left' }}
          onClick={() => onSwitchTabAndLens(0, 2)}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#172b24' }}>Kits & Coffre</div>
          <div style={{ fontSize: 10.5, color: '#56665d', marginTop: 2 }}>{stats.summary.standardKitsCount} kits</div>
        </button>
        <button
          type="button"
          className="club-glass-card"
          style={{ border: 0, cursor: 'pointer', padding: '9px 8px', textAlign: 'left' }}
          onClick={() => onSwitchTabAndLens(0, 3)}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#172b24' }}>
            {stats.managementView ? 'Pilotage' : 'Membres'}
          </div>
          <div style={{ fontSize: 10.5, color: '#56665d', marginTop: 2 }}>
            {stats.managementView ? `${stats.managementView.activeRate30dPct}% actifs` : `${stats.summary.membersCount} pers.`}
          </div>
        </button>
      </div>
    </div>
  );
}

export default ClubStatsHubDrawerBody;
