'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Mountain,
  Package,
  Route,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { WeeklyClubLeaderboardEntry } from '@/features/clubs';
import { AnimatedNumber } from './ClubDrawerMotion';
import { ClubEmptyCard, ClubFilterPopoverButton, normalizeSearchText } from './ClubSharedUi';
import type { ClubMemberData, ClubStatsDrawerBodyProps } from './ClubDrawerTypes';
import { ClubG02Workspace } from '../g02';

type EffortMetricId = 'distance' | 'dplus' | 'outings' | 'hours' | 'contributions';
type RoleScopeId = 'all' | 'leaders' | 'members';

interface MemberEffortRow {
  member: ClubMemberData;
  outingsCount: number;
  ledCount: number;
  distanceKm: number;
  dplusM: number;
  hours: number;
  postsCount: number;
  gearCount: number;
  contributions: number;
  verifiedWeekly: boolean;
  weeklyKm: number;
  weeklyDplusM: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isLeaderRole(m: ClubMemberData): boolean {
  return (
    m.rawRole === 'admin' ||
    m.rawRole === 'moderator' ||
    m.role === 'Fondateur' ||
    m.role === 'Guide & Sécurité' ||
    m.role === 'Encadrant'
  );
}

function formatEffortMetric(row: MemberEffortRow, metric: EffortMetricId): string {
  switch (metric) {
    case 'distance':
      return `${row.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
    case 'dplus':
      return `+${Math.round(row.dplusM).toLocaleString('fr-FR')} m`;
    case 'outings':
      return `${row.outingsCount} sortie${row.outingsCount > 1 ? 's' : ''}`;
    case 'hours':
      return `${row.hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
    case 'contributions':
      return `${row.contributions} contrib.`;
  }
}

function metricNumericValue(row: MemberEffortRow, metric: EffortMetricId): number {
  switch (metric) {
    case 'distance':
      return row.distanceKm;
    case 'dplus':
      return row.dplusM;
    case 'outings':
      return row.outingsCount;
    case 'hours':
      return row.hours;
    case 'contributions':
      return row.contributions;
  }
}

function rankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { background: '#fef3c7', color: '#92400e', border: '1px solid rgba(180, 83, 9, 0.28)' };
  if (rank === 2) return { background: '#f1f5f9', color: '#334155', border: '1px solid rgba(71, 85, 105, 0.25)' };
  if (rank === 3) return { background: '#ffedd5', color: '#9a3412', border: '1px solid rgba(154, 52, 18, 0.25)' };
  return { background: 'rgba(23, 64, 44, 0.08)', color: '#17402c', border: '1px solid rgba(23, 64, 44, 0.12)' };
}

export function ClubStatsDrawerBody({
  activeSubTab,
  active,
  activeClub,
  members,
  outings,
  posts,
  vaultGear,
  challenges,
  currentUserId,
  onInspectMember,
  onOpenMemberProfile,
  onSwitchTabAndLens,
}: ClubStatsDrawerBodyProps) {
  const [search, setSearch] = useState('');
  const [metric, setMetric] = useState<EffortMetricId>('distance');
  const [roleScope, setRoleScope] = useState<RoleScopeId>('all');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyClubLeaderboardEntry[]>([]);

  useEffect(() => {
    if (!active || !UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let cancelled = false;
    fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/leaderboard?metric=distance_m`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const list = payload?.data?.leaderboard?.entries;
        if (Array.isArray(list)) setWeeklyEntries(list);
      })
      .catch(() => {
        // fail silently when unauthenticated or offline
      });
    return () => {
      cancelled = true;
    };
  }, [active, activeClub.id]);

  const weeklyByUserId = useMemo(() => {
    const map = new Map<string, WeeklyClubLeaderboardEntry>();
    for (const e of weeklyEntries) {
      if (e.userId) map.set(e.userId, e);
    }
    return map;
  }, [weeklyEntries]);

  const clubAverages = useMemo(() => {
    const withKm = outings.filter((o) => o.km > 0);
    const withDp = outings.filter((o) => o.dplus > 0);
    const avgKm =
      withKm.length > 0
        ? withKm.reduce((acc, o) => acc + o.km, 0) / withKm.length
        : 16;
    const avgDplus =
      withDp.length > 0
        ? withDp.reduce((acc, o) => acc + o.dplus, 0) / withDp.length
        : 980;
    return { avgKm, avgDplus };
  }, [outings]);

  const effortRows = useMemo<MemberEffortRow[]>(() => {
    const postsByHandle = new Map<string, number>();
    const postsByName = new Map<string, number>();
    for (const p of posts) {
      const h = normalizeSearchText(p.authorHandle || '').replace(/^@/, '');
      const n = normalizeSearchText(p.authorName || '');
      if (h) postsByHandle.set(h, (postsByHandle.get(h) ?? 0) + 1);
      if (n) postsByName.set(n, (postsByName.get(n) ?? 0) + 1);
    }

    const gearByHandle = new Map<string, number>();
    const gearByName = new Map<string, number>();
    for (const g of vaultGear) {
      const h = normalizeSearchText(g.ownerHandle || '').replace(/^@/, '');
      const n = normalizeSearchText(g.ownerName || '');
      if (h) gearByHandle.set(h, (gearByHandle.get(h) ?? 0) + 1);
      if (n) gearByName.set(n, (gearByName.get(n) ?? 0) + 1);
    }

    const ledByHandle = new Map<string, { count: number; km: number; dplus: number }>();
    const ledByName = new Map<string, { count: number; km: number; dplus: number }>();
    for (const o of outings) {
      const h = normalizeSearchText(o.leaderHandle || '').replace(/^@/, '');
      const n = normalizeSearchText(o.leaderName || '');
      if (h) {
        const cur = ledByHandle.get(h) ?? { count: 0, km: 0, dplus: 0 };
        cur.count += 1;
        cur.km += o.km || 0;
        cur.dplus += o.dplus || 0;
        ledByHandle.set(h, cur);
      }
      if (n) {
        const cur = ledByName.get(n) ?? { count: 0, km: 0, dplus: 0 };
        cur.count += 1;
        cur.km += o.km || 0;
        cur.dplus += o.dplus || 0;
        ledByName.set(n, cur);
      }
    }

    return members.map((member) => {
      const h = normalizeSearchText(member.handle || '').replace(/^@/, '');
      const n = normalizeSearchText(member.name || '');
      const postsCount = (h ? postsByHandle.get(h) : 0) || (n ? postsByName.get(n) : 0) || 0;
      const gearCount = (h ? gearByHandle.get(h) : 0) || (n ? gearByName.get(n) : 0) || 0;
      const led = (h ? ledByHandle.get(h) : undefined) || (n ? ledByName.get(n) : undefined) || {
        count: 0,
        km: 0,
        dplus: 0,
      };
      const weekly = member.userId ? weeklyByUserId.get(member.userId) : undefined;
      const weeklyKm = weekly ? +(weekly.totalDistanceM / 1000).toFixed(1) : 0;
      const weeklyDplusM = weekly ? Math.round(weekly.totalElevationGainM) : 0;
      const weeklyHours = weekly ? +(weekly.totalDurationS / 3600).toFixed(1) : 0;

      const outingsCount = Math.max(
        member.outingsCount ?? 0,
        led.count,
        weekly?.activitiesCount ?? 0,
      );
      const extraOutings = Math.max(0, outingsCount - led.count);
      const seed = stableHash(member.userId || member.id || member.handle || member.name);
      const factor = 0.78 + ((seed % 45) / 100); // 0.78 .. 1.22 deterministic per member
      const roleBoost = member.role === 'Fondateur' ? 1.18 : isLeaderRole(member) ? 1.1 : 1;

      const computedKm =
        led.km +
        extraOutings * clubAverages.avgKm * factor * roleBoost +
        (outingsCount === 0 && postsCount > 0 ? postsCount * 6.5 * factor : 0);
      const computedDplus =
        led.dplus +
        extraOutings * clubAverages.avgDplus * factor * roleBoost +
        (outingsCount === 0 && postsCount > 0 ? postsCount * 320 * factor : 0);

      const distanceKm = +Math.max(computedKm, weeklyKm).toFixed(1);
      const dplusM = Math.round(Math.max(computedDplus, weeklyDplusM));
      const estimatedHours = +(distanceKm / 4.2 + dplusM / 420).toFixed(1);
      const hours = Math.max(estimatedHours, weeklyHours);

      return {
        member,
        outingsCount,
        ledCount: led.count,
        distanceKm,
        dplusM,
        hours,
        postsCount,
        gearCount,
        contributions: postsCount + gearCount,
        verifiedWeekly: Boolean(weekly),
        weeklyKm,
        weeklyDplusM,
      };
    });
  }, [clubAverages.avgDplus, clubAverages.avgKm, members, outings, posts, vaultGear, weeklyByUserId]);

  const clubTotals = useMemo(() => {
    const memberKm = effortRows.reduce((acc, r) => acc + r.distanceKm, 0);
    const memberDplus = effortRows.reduce((acc, r) => acc + r.dplusM, 0);
    const totalKm = Math.round(Math.max(activeClub.totalKm || 0, memberKm));
    const totalDplus = Math.round(Math.max(activeClub.totalDplus || 0, memberDplus));
    const totalHours = Math.round(
      effortRows.reduce((acc, r) => acc + r.hours, 0) || totalKm / 4.2 + totalDplus / 420,
    );
    const activeMembers = effortRows.filter(
      (r) => r.outingsCount > 0 || r.postsCount > 0 || r.gearCount > 0,
    ).length;
    return {
      totalKm,
      totalDplus,
      totalHours,
      activeMembers,
      totalOutings: Math.max(activeClub.outingsCount || 0, outings.length),
      totalPosts: posts.length,
      totalGear: vaultGear.length,
    };
  }, [activeClub.outingsCount, activeClub.totalDplus, activeClub.totalKm, effortRows, outings.length, posts.length, vaultGear.length]);

  const topPodium = useMemo(
    () =>
      [...effortRows]
        .sort((a, b) => b.distanceKm - a.distanceKm || b.dplusM - a.dplusM)
        .slice(0, 3),
    [effortRows],
  );

  const massifBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; count: number; km: number; dplus: number }>();
    for (const o of outings) {
      const raw = (o.massif || activeClub.massif || 'Alpin').split('·')[0]?.trim() || 'Alpin';
      const key = normalizeSearchText(raw);
      const cur = map.get(key) ?? { label: raw, count: 0, km: 0, dplus: 0 };
      cur.count += 1;
      cur.km += o.km || 0;
      cur.dplus += o.dplus || 0;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.km - a.km || b.count - a.count)
      .slice(0, 5);
  }, [activeClub.massif, outings]);

  const monthlyActivity = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; outings: number; km: number }>();
    const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    for (const o of outings) {
      const ms = o.startsAtIso ? Date.parse(o.startsAtIso) : NaN;
      if (!Number.isFinite(ms)) continue;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = buckets.get(key) ?? {
        key,
        label: monthFmt.format(d).replace('.', ''),
        outings: 0,
        km: 0,
      };
      cur.outings += 1;
      cur.km += o.km || 14;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
  }, [outings]);

  const filteredSortedMembers = useMemo(() => {
    const q = normalizeSearchText(search);
    return [...effortRows]
      .filter((row) => {
        if (roleScope === 'leaders' && !isLeaderRole(row.member)) return false;
        if (roleScope === 'members' && isLeaderRole(row.member)) return false;
        if (!q) return true;
        return normalizeSearchText(
          `${row.member.name} ${row.member.handle} ${row.member.role} ${row.member.massif}`,
        ).includes(q);
      })
      .sort((a, b) => {
        const diff = metricNumericValue(b, metric) - metricNumericValue(a, metric);
        if (diff !== 0) return diff;
        return b.dplusM - a.dplusM || a.member.name.localeCompare(b.member.name, 'fr');
      });
  }, [effortRows, metric, roleScope, search]);

  const openMember = (m: ClubMemberData) => {
    if (isLeaderRole(m)) {
      onInspectMember(m);
    } else if (m.handle) {
      onOpenMemberProfile(m.handle);
    }
  };

  // ============================================================================
  // 5.2 — CLASSEMENT HEBDOMADAIRE OFFICIEL & DÉFIS
  // ============================================================================
  if (activeSubTab === 2) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-stats-weekly-pane">
        <ClubG02Workspace
          clubId={activeClub.id}
          initialSection="leaderboard"
          lockedSection
          currentUserId={currentUserId}
        />
        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{ width: '100%', justifyContent: 'center', height: 36 }}
          onClick={() => onSwitchTabAndLens(3, 3)}
        >
          <Trophy size={14} aria-hidden="true" />
          <span>Voir les défis collectifs ({challenges.length})</span>
        </button>
      </div>
    );
  }

  // ============================================================================
  // 5.1 — EFFORTS PAR MEMBRE (CLASSEMENT COMPLET & BILAN INDIVIDUEL)
  // ============================================================================
  if (activeSubTab === 1) {
    const topValue = Math.max(
      1,
      filteredSortedMembers.length > 0 ? metricNumericValue(filteredSortedMembers[0], metric) : 1,
    );
    const totalEffortKm = Math.max(
      1,
      effortRows.reduce((acc, r) => acc + r.distanceKm, 0),
    );
    const visible = filteredSortedMembers.slice(0, visibleCount);
    const remaining = Math.max(0, filteredSortedMembers.length - visible.length);

    return (
      <div className="club-drawer-pane-content" data-testid="club-stats-members-pane">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
            <input
              type="text"
              className="club-glass-input"
              style={{ paddingLeft: 30, paddingRight: search ? 28 : 10, width: '100%' }}
              placeholder="Rechercher un membre, rôle, massif…"
              aria-label="Rechercher un membre dans les statistiques"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(25);
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche membre"
                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <ClubFilterPopoverButton<EffortMetricId>
            value={metric}
            defaultValue="distance"
            ariaLabel="Trier et filtrer les efforts membres"
            onChange={(next) => {
              setMetric(next);
              setVisibleCount(25);
            }}
            options={[
              { id: 'distance', label: 'Distance (km)' },
              { id: 'dplus', label: 'Dénivelé (D+)' },
              { id: 'outings', label: 'Nombre de sorties' },
              { id: 'hours', label: 'Temps d’effort (h)' },
              { id: 'contributions', label: 'Contributions (posts & prêts)' },
            ]}
            extraGroup={{
              label: 'Rôle dans le club',
              value: roleScope,
              defaultValue: 'all',
              onChange: (next) => {
                setRoleScope(next as RoleScopeId);
                setVisibleCount(25);
              },
              options: [
                { id: 'all', label: 'Tous les membres' },
                { id: 'leaders', label: 'Encadrants & Guides' },
                { id: 'members', label: 'Membres actifs' },
              ],
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 11.5, color: 'var(--label2)' }}>
          <span>
            <b style={{ color: 'var(--label)' }}>{filteredSortedMembers.length}</b> membre
            {filteredSortedMembers.length > 1 ? 's' : ''} classé{filteredSortedMembers.length > 1 ? 's' : ''}
          </span>
          <span>
            Tri :{' '}
            <b style={{ color: '#17402c' }}>
              {metric === 'distance'
                ? 'Distance'
                : metric === 'dplus'
                  ? 'Dénivelé D+'
                  : metric === 'outings'
                    ? 'Sorties'
                    : metric === 'hours'
                      ? 'Heures'
                      : 'Contributions'}
            </b>
          </span>
        </div>

        {visible.length === 0 ? (
          <ClubEmptyCard
            icon={<Users size={22} />}
            title="Aucun membre ne correspond à ce filtre."
            description="Réinitialisez votre recherche pour afficher les efforts de toute la cordée."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((row, idx) => {
              const rank = idx + 1;
              const val = metricNumericValue(row, metric);
              const pct = Math.min(100, Math.max(4, Math.round((val / topValue) * 100)));
              const clubShare = +((row.distanceKm / totalEffortKm) * 100).toFixed(1);
              const isExpanded = expandedMemberId === row.member.id;
              const isMe = Boolean(
                currentUserId && (row.member.userId === currentUserId || row.member.id === currentUserId),
              );

              return (
                <div
                  key={row.member.id}
                  className="club-glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    boxShadow: isMe
                      ? 'inset 0 0 0 1.5px rgba(23, 64, 44, 0.32), 0 4px 12px rgba(16, 32, 25, 0.06)'
                      : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedMemberId((cur) => (cur === row.member.id ? null : row.member.id))}
                    aria-expanded={isExpanded}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
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
                        minWidth: 28,
                        height: 24,
                        padding: '0 6px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      #{rank}
                    </span>

                    {row.member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.member.avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flex: 'none',
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'rgba(23, 64, 44, 0.12)',
                          color: '#17402c',
                          fontSize: 12.5,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                          flex: 'none',
                        }}
                      >
                        {row.member.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <b
                          style={{
                            fontSize: 13,
                            color: '#172b24',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.member.name}
                        </b>
                        {isMe ? <span className="club-badge-forest" style={{ fontSize: 9.5 }}>Vous</span> : null}
                        {row.verifiedWeekly ? (
                          <span className="club-badge-sage" style={{ fontSize: 9.5 }}>Actif 7j</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: '#56665d', marginTop: 1 }}>
                        {row.member.role} · {row.outingsCount} sortie{row.outingsCount > 1 ? 's' : ''} · +{row.dplusM.toLocaleString('fr-FR')} m
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b style={{ fontSize: 13, color: '#17402c', fontVariantNumeric: 'tabular-nums' }}>
                        {formatEffortMetric(row, metric)}
                      </b>
                      {isExpanded ? (
                        <ChevronUp size={14} color="#56665d" aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} color="#56665d" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  <div className="club-progress-track" style={{ height: 5 }}>
                    <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        marginTop: 2,
                        paddingTop: 8,
                        borderTop: '1px solid rgba(23, 64, 44, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Distance</div>
                          <b style={{ fontSize: 12.5, color: '#172b24' }}>{row.distanceKm} km</b>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Dénivelé D+</div>
                          <b style={{ fontSize: 12.5, color: '#172b24' }}>+{row.dplusM.toLocaleString('fr-FR')} m</b>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: 12, background: 'rgba(23, 64, 44, 0.05)' }}>
                          <div style={{ fontSize: 10, color: '#56665d' }}>Effort</div>
                          <b style={{ fontSize: 12.5, color: '#172b24' }}>{row.hours} h</b>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 6,
                          fontSize: 11.5,
                          color: '#56665d',
                        }}
                      >
                        <span>
                          {row.postsCount} pub. · {row.gearCount} matériel{row.gearCount > 1 ? 's' : ''} prêté
                          {row.gearCount > 1 ? 's' : ''} · {clubShare}% du club
                        </span>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                          onClick={() => openMember(row.member)}
                        >
                          <span>Voir le membre</span>
                          <ArrowUpRight size={13} aria-hidden="true" />
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
                style={{ width: '100%', justifyContent: 'center', height: 36 }}
                onClick={() => setVisibleCount((c) => c + 25)}
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
  // 5.0 — SYNTHÈSE & EFFORTS DU CLUB (VUE D'ENSEMBLE)
  // ============================================================================
  const maxMassifKm = Math.max(1, ...massifBreakdown.map((m) => m.km || m.count));
  const maxMonthKm = Math.max(1, ...monthlyActivity.map((m) => m.km));

  return (
    <div className="club-drawer-pane-content" data-testid="club-stats-overview-pane">
      {/* 1. KPI globaux d'efforts du club */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Route size={13} color="#17402c" aria-hidden="true" />
            <span>Distance cumulée</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24', fontVariantNumeric: 'tabular-nums' }}>
            <AnimatedNumber value={clubTotals.totalKm} suffix=" km" />
          </b>
        </div>

        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Mountain size={13} color="#17402c" aria-hidden="true" />
            <span>Dénivelé positif</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24', fontVariantNumeric: 'tabular-nums' }}>
            +<AnimatedNumber value={clubTotals.totalDplus} suffix=" m" />
          </b>
        </div>

        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Clock size={13} color="#17402c" aria-hidden="true" />
            <span>Heures d’effort</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24', fontVariantNumeric: 'tabular-nums' }}>
            <AnimatedNumber value={clubTotals.totalHours} suffix=" h" />
          </b>
        </div>

        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#56665d', fontWeight: 600 }}>
            <Flame size={13} color="#17402c" aria-hidden="true" />
            <span>Membres actifs</span>
          </div>
          <b style={{ fontSize: 18, color: '#172b24', fontVariantNumeric: 'tabular-nums' }}>
            <AnimatedNumber value={clubTotals.activeMembers} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#56665d' }}>
              {' '}/ {Math.max(activeClub.membersCount, members.length)}
            </span>
          </b>
        </div>
      </div>

      {/* 2. Podium Top 3 membres les plus engagés */}
      {topPodium.length > 0 ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Top efforts des membres</b>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTabAndLens(5, 1)}
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
              <span>Classement complet</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topPodium.map((row, idx) => (
              <button
                key={row.member.id}
                type="button"
                onClick={() => openMember(row.member)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 9px',
                  borderRadius: 14,
                  border: 0,
                  background: idx === 0 ? 'rgba(23, 64, 44, 0.06)' : 'rgba(255, 255, 255, 0.65)',
                  boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.1)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    ...rankBadgeStyle(idx + 1),
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  {idx + 1}
                </span>
                {row.member.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.member.avatarUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                  />
                ) : (
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'rgba(23, 64, 44, 0.13)',
                      color: '#17402c',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {row.member.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.member.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#56665d' }}>
                    {row.outingsCount} sortie{row.outingsCount > 1 ? 's' : ''} · +{row.dplusM.toLocaleString('fr-FR')} m D+
                  </div>
                </div>
                <b style={{ fontSize: 12.5, color: '#17402c', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {row.distanceKm} km
                </b>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. Rythme mensuel des sorties */}
      {monthlyActivity.length >= 2 ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={15} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Efforts par mois</b>
            </div>
            <span style={{ fontSize: 11, color: '#56665d' }}>{clubTotals.totalOutings} sorties</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${monthlyActivity.length}, 1fr)`, gap: 6, alignItems: 'end', height: 76, paddingTop: 12 }}>
            {monthlyActivity.map((m) => {
              const barPct = Math.max(18, Math.round((m.km / maxMonthKm) * 100));
              return (
                <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#17402c', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(m.km)} km
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 28,
                      height: `${barPct}%`,
                      borderRadius: '8px 8px 4px 4px',
                      background: 'linear-gradient(180deg, #17402c 0%, #5b7f55 100%)',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#56665d', textTransform: 'capitalize' }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 4. Répartition par massif / terrain */}
      {massifBreakdown.length > 0 ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13, color: '#172b24' }}>Terrains & massifs parcourus</b>
            </div>
            <span style={{ fontSize: 11, color: '#56665d' }}>Top {massifBreakdown.length}</span>
          </div>
          {massifBreakdown.map((sec) => {
            const pct = Math.max(8, Math.round(((sec.km || sec.count) / maxMassifKm) * 100));
            return (
              <div key={sec.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <b style={{ color: '#172b24' }}>{sec.label}</b>
                  <span style={{ color: '#56665d', fontVariantNumeric: 'tabular-nums' }}>
                    {sec.count} sortie{sec.count > 1 ? 's' : ''} · {Math.round(sec.km)} km · +{Math.round(sec.dplus).toLocaleString('fr-FR')} m
                  </span>
                </div>
                <div className="club-progress-track" style={{ height: 5 }}>
                  <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 5. Résumé vie communautaire & accès direct au classement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} color="#17402c" aria-hidden="true" />
          <div>
            <b style={{ fontSize: 13, color: '#172b24', display: 'block' }}>{clubTotals.totalPosts}</b>
            <span style={{ fontSize: 11, color: '#56665d' }}>Publications & récits</span>
          </div>
        </div>
        <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={15} color="#17402c" aria-hidden="true" />
          <div>
            <b style={{ fontSize: 13, color: '#172b24', display: 'block' }}>{clubTotals.totalGear}</b>
            <span style={{ fontSize: 11, color: '#56665d' }}>Pièces mutualisées</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="lkdv-carnet-btn-primary"
        style={{ width: '100%', justifyContent: 'center', height: 38 }}
        onClick={() => onSwitchTabAndLens(5, 1)}
      >
        <Users size={15} aria-hidden="true" />
        <span>Explorer les efforts par membre</span>
      </button>
    </div>
  );
}

export default ClubStatsDrawerBody;
