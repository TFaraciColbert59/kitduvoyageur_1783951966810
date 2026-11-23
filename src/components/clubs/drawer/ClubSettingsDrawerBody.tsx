'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Flame,
  Lock,
  Mountain,
  Package,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import { ClubEmptyCard, normalizeSearchText } from './ClubSharedUi';
import type { ClubGearVaultItem, ClubItemData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
import type { ClubJoinRequest, ClubRole } from '@/features/clubs/types';

export interface ClubSettingsDrawerBodyProps {
  activeSubTab: number;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  vaultGear?: ClubGearVaultItem[];
  currentUserId?: string | null;
  loanFilter?: 'all' | 'requested' | 'approved' | 'active';
  challengeFilter?: 'all' | 'active' | 'ended';
  onToggleClubVisibility: () => void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onChangeMemberRole?: (userId: string, role: ClubRole) => Promise<boolean> | void;
  onToggleMemberStoryPermission?: (
    userId: string,
    canManageStories: boolean,
  ) => Promise<boolean> | void;
  onToggleMemberGearPermission?: (
    userId: string,
    canManageGear: boolean,
  ) => Promise<boolean> | void;
  onToggleMemberLeaderBadge?: (
    userId: string,
    isCertifiedLeader: boolean,
  ) => Promise<boolean> | void;
  onToast?: (toast: ClubToastPayload) => void;
}

interface AuditLogEntry {
  id: string;
  action: string;
  target_user_id: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_at: string;
}

type ChallengeMetricId = 'distance_m' | 'elevation_gain_m' | 'duration_s' | 'activities_count';

interface AdminChallengeRow {
  id: string;
  title: string;
  description?: string | null;
  scope: 'club' | 'individual';
  sport?: string | null;
  metric: ChallengeMetricId;
  targetValue: number;
  startsAt: string;
  endsAt: string;
  badgeTitle?: string | null;
  badgeIcon?: string | null;
  participantsCount?: number;
  totalValue?: number;
  completionPct?: number;
}

const CHALLENGE_METRIC_META: Record<
  ChallengeMetricId,
  { label: string; unit: string; multiplier: number; defaultTarget: string; placeholder: string }
> = {
  distance_m: { label: 'Distance', unit: 'km', multiplier: 1000, defaultTarget: '150', placeholder: '150' },
  elevation_gain_m: { label: 'Dénivelé D+', unit: 'm D+', multiplier: 1, defaultTarget: '5000', placeholder: '5000' },
  duration_s: { label: 'Durée', unit: 'h', multiplier: 3600, defaultTarget: '40', placeholder: '40' },
  activities_count: { label: 'Sorties', unit: 'sorties', multiplier: 1, defaultTarget: '12', placeholder: '12' },
};

const CHALLENGE_SPORTS = [
  'Toutes disciplines',
  'Alpinisme',
  'Randonnée',
  'Trail',
  'Ski de rando',
  'Escalade',
  'VTT',
] as const;

function formatChallengeTarget(metric: ChallengeMetricId, rawValue: number): string {
  if (metric === 'distance_m') return `${Math.round(rawValue / 1000)} km`;
  if (metric === 'duration_s') return `${Math.round(rawValue / 3600)} h`;
  if (metric === 'elevation_gain_m') return `${Math.round(rawValue).toLocaleString('fr-FR')} m D+`;
  return `${Math.round(rawValue)} sorties`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roleLabel(raw?: ClubRole | null): string {
  switch (raw) {
    case 'founder':
      return 'Fondateur';
    case 'admin':
      return 'Admin · Bureau';
    case 'moderator':
      return 'Modérateur';
    default:
      return 'Membre';
  }
}

export function ClubSettingsDrawerBody({
  activeSubTab,
  activeClub,
  members,
  vaultGear = [],
  currentUserId,
  loanFilter = 'all',
  challengeFilter = 'all',
  onToggleClubVisibility,
  onTransitionGearLoan,
  onChangeMemberRole,
  onToggleMemberStoryPermission,
  onToggleMemberGearPermission,
  onToggleMemberLeaderBadge,
  onToast,
}: ClubSettingsDrawerBodyProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);
  const [loanConditionPick, setLoanConditionPick] = useState<Record<string, 'new' | 'good' | 'worn' | 'repair'>>({});
  const [loanReturnNote, setLoanReturnNote] = useState<Record<string, string>>({});
  const [challenges, setChallenges] = useState<AdminChallengeRow[]>([]);
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [challengeScope, setChallengeScope] = useState<'club' | 'individual'>('club');
  const [challengeMetric, setChallengeMetric] = useState<ChallengeMetricId>('elevation_gain_m');
  const [challengeTarget, setChallengeTarget] = useState('5000');
  const [challengeSport, setChallengeSport] = useState<string>(activeClub.category || 'Toutes disciplines');
  const [challengeDurationDays, setChallengeDurationDays] = useState<number>(30);
  const [challengeBadgeTitle, setChallengeBadgeTitle] = useState('');
  const [challengeBadgeIcon, setChallengeBadgeIcon] = useState<'trophy' | 'mountain' | 'flame' | 'compass'>('trophy');
  const [cfgName, setCfgName] = useState(activeClub.name || '');
  const [cfgZone, setCfgZone] = useState(activeClub.massif || '');
  const [cfgDesc, setCfgDesc] = useState(activeClub.bio || '');
  const [cfgPrivacy, setCfgPrivacy] = useState<'open' | 'closed' | 'secret'>(
    activeClub.visibility === 'secret' ? 'secret' : activeClub.visibility === 'prive' ? 'closed' : 'open',
  );
  const [cfgRules, setCfgRules] = useState('');
  const [cfgJoinQ1, setCfgJoinQ1] = useState('');
  const [cfgJoinQ2, setCfgJoinQ2] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);

  const canManageClubGear = Boolean(
    activeClub.viewerCanManageGear ||
      activeClub.viewerRole === 'founder' ||
      activeClub.viewerRole === 'admin' ||
      (currentUserId && activeClub.createdBy === currentUserId),
  );

  const isFounder = Boolean(
    currentUserId && (activeClub.createdBy === currentUserId || activeClub.viewerRole === 'founder'),
  );
  const canEditGovernance = Boolean(isFounder || activeClub.viewerRole === 'admin');
  const canReviewAccess = Boolean(
    canEditGovernance || activeClub.viewerRole === 'moderator',
  );

  useEffect(() => {
    if (!UUID_RE.test(activeClub.id) || !canReviewAccess || typeof fetch !== 'function') return;
    let cancelled = false;
    fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: { joinRequests?: ClubJoinRequest[]; auditLogs?: AuditLogEntry[] } } | null) => {
        if (cancelled || !json?.data) return;
        if (Array.isArray(json.data.joinRequests)) {
          setJoinRequests(json.data.joinRequests.filter((r) => r.status === 'pending'));
        }
        if (Array.isArray(json.data.auditLogs)) {
          setAuditLogs(json.data.auditLogs);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeClub.id, canReviewAccess]);

  useEffect(() => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let cancelled = false;
    fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/challenges`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          json: {
            data?: {
              challenges?: Array<Record<string, unknown>>;
              summaries?: Record<string, { participantsCount?: number; totalValue?: number; completionPct?: number }>;
            };
          } | null,
        ) => {
          if (cancelled) return;
          setChallengesLoaded(true);
          const rows = Array.isArray(json?.data?.challenges) ? json.data.challenges : [];
          const summaries = json?.data?.summaries ?? {};
          setChallenges(
            rows.map((r) => {
              const id = String(r.id ?? '');
              const sum = summaries[id];
              return {
                id,
                title: String(r.title ?? 'Défi'),
                description: typeof r.description === 'string' ? r.description : null,
                scope: r.scope === 'individual' ? 'individual' : 'club',
                sport: typeof r.sport === 'string' ? r.sport : null,
                metric:
                  r.metric === 'distance_m' ||
                  r.metric === 'duration_s' ||
                  r.metric === 'elevation_gain_m' ||
                  r.metric === 'activities_count'
                    ? r.metric
                    : 'distance_m',
                targetValue: Number(r.targetValue ?? r.target_value ?? 1000),
                startsAt: String(r.startsAt ?? r.starts_at ?? new Date().toISOString()),
                endsAt: String(r.endsAt ?? r.ends_at ?? new Date().toISOString()),
                badgeTitle: typeof r.badgeTitle === 'string' ? r.badgeTitle : null,
                badgeIcon: typeof r.badgeIcon === 'string' ? r.badgeIcon : 'trophy',
                participantsCount: sum?.participantsCount ?? 0,
                totalValue: sum?.totalValue ?? 0,
                completionPct: sum?.completionPct ?? 0,
              };
            }),
          );
        },
      )
      .catch(() => {
        if (!cancelled) setChallengesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClub.id]);

  const filteredMembers = useMemo(() => {
    const q = normalizeSearchText(memberSearch.trim());
    return members.filter((m) => {
      if (!q) return true;
      return normalizeSearchText(`${m.name} ${m.handle} ${m.role}`).includes(q);
    });
  }, [members, memberSearch]);

  const mutedMembers = useMemo(
    () => members.filter((m) => Boolean(m.mutedUntil)),
    [members],
  );

  const runAction = async (key: string, fn: () => Promise<boolean | void> | void) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  const handleReviewRequest = async (requestId: string, approve: boolean) => {
    if (!UUID_RE.test(activeClub.id)) return;
    await runAction(`req:${requestId}`, async () => {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', requestId, approve }),
      });
      if (res.ok) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        onToast?.({
          title: approve ? 'Demande acceptée ✓' : 'Demande refusée',
          subtitle: activeClub.name,
        });
      }
    });
  };

  const handleUnmute = async (userId: string, name: string) => {
    if (!UUID_RE.test(activeClub.id)) return;
    await runAction(`unmute:${userId}`, async () => {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mute', userId, mutedUntil: null }),
      });
      if (res.ok) {
        onToast?.({ title: 'Sourdine levée ✓', subtitle: name });
      }
    });
  };

  const handleTransferOwnership = async (userId: string, name: string) => {
    if (!UUID_RE.test(activeClub.id)) return;
    await runAction(`transfer:${userId}`, async () => {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer_ownership', userId }),
      });
      if (res.ok) {
        setConfirmTransferId(null);
        onToast?.({
          title: 'Propriété transférée ✓',
          subtitle: `${name} est désormais Fondateur`,
        });
      }
    });
  };

  const canAccessAdminDrawer = Boolean(
    canReviewAccess || canManageClubGear || activeClub.viewerCanManageStories,
  );

  if (!canAccessAdminDrawer) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-forbidden-pane">
        <ClubEmptyCard
          icon={<Lock size={22} />}
          title="Espace réservé à l’administration"
          description="Seuls les membres autorisés (fondateur, bureau, modérateurs et référents) peuvent accéder à la plateforme d’administration du club."
        />
      </div>
    );
  }

  // 0 — Général & Visibilité
  if (activeSubTab === 0) {
    const visLabel =
      activeClub.visibility === 'secret'
        ? 'Club secret (sur invitation)'
        : activeClub.visibility === 'prive'
          ? 'Club fermé (validation requise)'
          : 'Club ouvert (accès libre)';

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-general-pane">
        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Visibilité & Accès</b>
            </div>
            <span className="club-badge-sage">{visLabel}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', lineHeight: 1.45 }}>
            Contrôle qui peut découvrir {activeClub.name}, consulter ses sorties et demander à rejoindre la cordée.
          </p>
          {canEditGovernance ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ alignSelf: 'flex-start' }}
              onClick={onToggleClubVisibility}
            >
              Basculer Ouvert / Fermé
            </button>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              Réservé au fondateur ou aux administrateurs du club.
            </span>
          )}
        </div>

        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={16} color="#17402c" aria-hidden="true" />
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Identité du club</b>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--label)' }}>
            <b>{activeClub.name}</b> · {activeClub.massif}
          </div>
          <div style={{ fontSize: 12, color: 'var(--label2)' }}>
            {activeClub.category} · {activeClub.membersCount} membres · {activeClub.outingsCount} sorties
          </div>
        </div>
      </div>
    );
  }

  // 1 — Accès & Adhésions (uniquement demandes d'adhésion)
  if (activeSubTab === 1) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-access-pane">
        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={16} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Demandes d’adhésion</b>
            </div>
            <span className="club-badge-soft">{joinRequests.length} en attente</span>
          </div>

          {joinRequests.length === 0 ? (
            <ClubEmptyCard
              icon={<Check size={20} />}
              title="Aucune demande en attente"
              description="Toutes les demandes d’adhésion ont été traitées."
            />
          ) : (
            joinRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  paddingTop: 8,
                  borderTop: '1px solid rgba(23, 64, 44, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  <b style={{ fontSize: 12.5 }}>{req.displayName}</b>
                  {req.message ? (
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--label2)' }}>
                      « {req.message} »
                    </p>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    disabled={busyKey === `req:${req.id}`}
                    className="lkdv-carnet-btn-soft"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                    onClick={() => void handleReviewRequest(req.id, true)}
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `req:${req.id}`}
                    className="lkdv-carnet-btn-soft"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                    onClick={() => void handleReviewRequest(req.id, false)}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 2 — Prêts & Matériel (sous-volet dédié)
  if (activeSubTab === 2) {
    const actionableLoans = canManageClubGear
      ? vaultGear.filter(
          (g) =>
            g.loanId &&
            (g.loanStatus === 'requested' ||
              g.loanStatus === 'approved' ||
              g.loanStatus === 'checked_out' ||
              g.loanStatus === 'overdue'),
        )
      : [];

    const filteredLoans = actionableLoans.filter((g) => {
      if (loanFilter === 'requested') return g.loanStatus === 'requested';
      if (loanFilter === 'approved') return g.loanStatus === 'approved';
      if (loanFilter === 'active') return g.loanStatus === 'checked_out' || g.loanStatus === 'overdue';
      return true;
    });

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-loans-pane">
        {!canManageClubGear ? (
          <ClubEmptyCard
            icon={<Lock size={22} />}
            title="Gestion du matériel réservée"
            description="Seuls les administrateurs et référents matériel peuvent valider et suivre les prêts."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Cartes individuelles modernes (filtres en bas à droite) */}
            {filteredLoans.length === 0 ? (
              <ClubEmptyCard
                icon={<Check size={20} />}
                title="Aucun prêt dans cette file"
                description="Les demandes de prêt et retours matériel apparaîtront ici."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredLoans.map((g) => {
                  const isOverdue =
                    g.loanStatus === 'overdue' ||
                    (g.loanStatus === 'checked_out' && g.neededUntil && Date.parse(g.neededUntil) < Date.now());
                  const statusLabel = isOverdue
                    ? 'En retard'
                    : g.loanStatus === 'requested'
                      ? 'À valider'
                      : g.loanStatus === 'approved'
                        ? 'Validé'
                        : 'Remis';
                  const statusTone = isOverdue
                    ? { bg: 'rgba(185, 28, 28, 0.10)', color: '#b91c1c' }
                    : g.loanStatus === 'requested'
                      ? { bg: 'rgba(217, 119, 6, 0.12)', color: '#b45309' }
                      : g.loanStatus === 'approved'
                        ? { bg: 'rgba(23, 64, 44, 0.09)', color: '#17402c' }
                        : { bg: 'rgba(21, 128, 61, 0.12)', color: '#15803d' };
                  const condVal = loanConditionPick[g.loanId!] ?? 'good';
                  return (
                    <div
                      key={g.loanId}
                      style={{
                        padding: '11px 12px',
                        borderRadius: 18,
                        background: 'rgba(255, 255, 255, 0.82)',
                        border: '0.5px solid rgba(23, 43, 36, 0.08)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 10px rgba(23, 43, 36, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {/* En-tête produit + emprunteur + statut */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.imageUrl || generatedProductImage(g.name, 80)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 11,
                            objectFit: 'cover',
                            flex: 'none',
                            background: 'rgba(23, 64, 44, 0.05)',
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <b
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#172b24',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {g.name}
                          </b>
                          <span style={{ fontSize: 11.5, color: '#56665d' }}>
                            {g.borrowerName || 'Membre'}
                            {g.neededUntil ? ` · retour ${g.neededUntil}` : ''}
                          </span>
                        </div>
                        <span
                          style={{
                            flex: 'none',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: statusTone.bg,
                            color: statusTone.color,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Actions selon l'étape */}
                      {g.loanStatus === 'requested' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="lkdv-carnet-btn-soft"
                            style={{
                              flex: 1,
                              height: 32,
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.24), rgba(150, 186, 142, 0.12))',
                              color: '#17402c',
                            }}
                            onClick={() => onTransitionGearLoan?.({ loanId: g.loanId!, gearItemId: g.id, status: 'approved' })}
                          >
                            <Check size={13} aria-hidden="true" />
                            <span>Valider</span>
                          </button>
                          <button
                            type="button"
                            className="lkdv-carnet-btn-soft"
                            style={{ flex: 1, height: 32, justifyContent: 'center', fontSize: 12, color: '#b91c1c' }}
                            onClick={() => onTransitionGearLoan?.({ loanId: g.loanId!, gearItemId: g.id, status: 'declined' })}
                          >
                            <X size={13} aria-hidden="true" />
                            <span>Refuser</span>
                          </button>
                        </div>
                      ) : null}

                      {g.loanStatus === 'approved' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            role="group"
                            aria-label={`État au départ pour ${g.name}`}
                            style={{
                              flex: 1,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                              gap: 2,
                              padding: 2,
                              borderRadius: 999,
                              background: 'rgba(23, 43, 36, 0.05)',
                            }}
                          >
                            {(
                              [
                                { id: 'new', label: 'Neuf' },
                                { id: 'good', label: 'Bon' },
                                { id: 'worn', label: 'Usé' },
                              ] as const
                            ).map((opt) => {
                              const active = condVal === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setLoanConditionPick((prev) => ({
                                      ...prev,
                                      [g.loanId!]: opt.id,
                                    }))
                                  }
                                  style={{
                                    height: 28,
                                    borderRadius: 999,
                                    border: 0,
                                    background: active ? '#ffffff' : 'transparent',
                                    boxShadow: active ? '0 1px 4px rgba(23, 43, 36, 0.10)' : 'none',
                                    color: active ? '#17402c' : '#56665d',
                                    fontSize: 11,
                                    fontWeight: active ? 700 : 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="lkdv-carnet-btn-soft"
                            style={{
                              flex: 'none',
                              height: 32,
                              padding: '0 12px',
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.24), rgba(150, 186, 142, 0.12))',
                              color: '#17402c',
                            }}
                            onClick={() =>
                              onTransitionGearLoan?.({
                                loanId: g.loanId!,
                                gearItemId: g.id,
                                status: 'checked_out',
                                checkoutCondition: condVal,
                              })
                            }
                          >
                            <Check size={13} aria-hidden="true" />
                            <span>Remis</span>
                          </button>
                        </div>
                      ) : null}

                      {g.loanStatus === 'checked_out' || g.loanStatus === 'overdue' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div
                            role="group"
                            aria-label={`État au retour pour ${g.name}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                              gap: 2,
                              padding: 2,
                              borderRadius: 999,
                              background: 'rgba(23, 43, 36, 0.05)',
                            }}
                          >
                            {(
                              [
                                { id: 'new', label: 'Neuf' },
                                { id: 'good', label: 'Bon' },
                                { id: 'worn', label: 'Usé' },
                                { id: 'repair', label: 'Réparer' },
                              ] as const
                            ).map((opt) => {
                              const active = condVal === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setLoanConditionPick((prev) => ({
                                      ...prev,
                                      [g.loanId!]: opt.id,
                                    }))
                                  }
                                  style={{
                                    height: 26,
                                    borderRadius: 999,
                                    border: 0,
                                    background: active ? '#ffffff' : 'transparent',
                                    boxShadow: active ? '0 1px 4px rgba(23, 43, 36, 0.10)' : 'none',
                                    color: active ? (opt.id === 'repair' ? '#b91c1c' : '#17402c') : '#56665d',
                                    fontSize: 10.5,
                                    fontWeight: active ? 700 : 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            type="text"
                            className="club-glass-input"
                            style={{ fontSize: 11.5, padding: '6px 10px' }}
                            placeholder="Note au retour (optionnel)…"
                            value={loanReturnNote[g.loanId!] ?? ''}
                            onChange={(e) =>
                              setLoanReturnNote((prev) => ({ ...prev, [g.loanId!]: e.target.value }))
                            }
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="lkdv-carnet-btn-soft"
                              style={{
                                flex: 1,
                                height: 32,
                                justifyContent: 'center',
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.24), rgba(150, 186, 142, 0.12))',
                                color: '#17402c',
                              }}
                              onClick={() =>
                                onTransitionGearLoan?.({
                                  loanId: g.loanId!,
                                  gearItemId: g.id,
                                  status: 'returned',
                                  returnCondition: condVal,
                                  conditionNote: loanReturnNote[g.loanId!] || undefined,
                                })
                              }
                            >
                              <Check size={13} aria-hidden="true" />
                              <span>Rendu</span>
                            </button>
                            <button
                              type="button"
                              className="lkdv-carnet-btn-soft"
                              style={{ height: 32, padding: '0 12px', fontSize: 11.5, color: '#b91c1c' }}
                              onClick={() =>
                                onTransitionGearLoan?.({
                                  loanId: g.loanId!,
                                  gearItemId: g.id,
                                  status: 'issue',
                                  returnCondition: condVal,
                                  conditionNote: loanReturnNote[g.loanId!] || undefined,
                                })
                              }
                            >
                              Incident
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3 — Défis du club (sous-volet dédié & module complet)
  if (activeSubTab === 3) {
    const nowMs = Date.now();
    const activeChallenges = challenges.filter((c) => Date.parse(c.endsAt) >= nowMs);
    const endedChallenges = challenges.filter((c) => Date.parse(c.endsAt) < nowMs);
    const totalParticipants = challenges.reduce((acc, c) => acc + (c.participantsCount ?? 0), 0);
    const visibleChallenges =
      challengeFilter === 'active'
        ? activeChallenges
        : challengeFilter === 'ended'
          ? endedChallenges
          : challenges;

    const metricMeta = CHALLENGE_METRIC_META[challengeMetric];
    const numericTarget = Math.max(1, Number(challengeTarget) || Number(metricMeta.defaultTarget));
    const rawTargetValue = numericTarget * metricMeta.multiplier;

    const renderBadgeIcon = (icon?: string | null, size = 14) => {
      if (icon === 'mountain') return <Mountain size={size} aria-hidden="true" />;
      if (icon === 'flame') return <Flame size={size} aria-hidden="true" />;
      if (icon === 'compass') return <Compass size={size} aria-hidden="true" />;
      return <Trophy size={size} aria-hidden="true" />;
    };

    const handleCreateChallenge = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!challengeTitle.trim()) return;
      const now = new Date();
      const end = new Date(now.getTime() + challengeDurationDays * 86_400_000);
      const sportVal = challengeSport === 'Toutes disciplines' ? null : challengeSport;
      const badgeLabel = challengeBadgeTitle.trim() || challengeTitle.trim();

      // Optimistic add for instant feedback
      const tempId = `temp-${Date.now()}`;
      const optimisticRow: AdminChallengeRow = {
        id: tempId,
        title: challengeTitle.trim(),
        description: challengeDesc.trim() || `Défi ${challengeScope === 'club' ? 'collectif' : 'individuel'} ${activeClub.name}`,
        scope: challengeScope,
        sport: sportVal,
        metric: challengeMetric,
        targetValue: rawTargetValue,
        startsAt: now.toISOString(),
        endsAt: end.toISOString(),
        badgeTitle: badgeLabel,
        badgeIcon: challengeBadgeIcon,
        participantsCount: 1,
        totalValue: 0,
        completionPct: 0,
      };
      setChallenges((prev) => [optimisticRow, ...prev]);
      setChallengeTitle('');
      setChallengeDesc('');
      setChallengeBadgeTitle('');
      setChallengeFormOpen(false);
      onToast?.({ title: 'Défi publié ✓', subtitle: optimisticRow.title });

      if (!UUID_RE.test(activeClub.id)) return;
      try {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/challenges`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            scope: optimisticRow.scope,
            title: optimisticRow.title,
            description: optimisticRow.description,
            sport: optimisticRow.sport,
            metric: optimisticRow.metric,
            targetValue: optimisticRow.targetValue,
            startsAt: optimisticRow.startsAt,
            endsAt: optimisticRow.endsAt,
            badgeTitle: optimisticRow.badgeTitle,
            badgeIcon: optimisticRow.badgeIcon,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { data?: { challenge?: Record<string, unknown> } };
          const realId = json?.data?.challenge?.id;
          if (typeof realId === 'string') {
            setChallenges((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: realId } : c)));
          }
        } else {
          setChallenges((prev) => prev.filter((c) => c.id !== tempId));
          onToast?.({ title: 'Création refusée', subtitle: `Erreur ${res.status}` });
        }
      } catch {
        setChallenges((prev) => prev.filter((c) => c.id !== tempId));
        onToast?.({ title: 'Erreur réseau', subtitle: 'Impossible de publier le défi' });
      }
    };

    const fieldStyle: React.CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      borderRadius: 12,
      border: '1px solid rgba(23, 43, 36, 0.11)',
      background: 'rgba(23, 43, 36, 0.035)',
      fontSize: 13,
      color: '#172b24',
      outline: 'none',
      boxSizing: 'border-box',
    };

    const segmentedTrackStyle: React.CSSProperties = {
      display: 'grid',
      gap: 3,
      padding: 3,
      borderRadius: 12,
      background: 'rgba(23, 43, 36, 0.06)',
    };

    const segBtnStyle = (active: boolean): React.CSSProperties => ({
      height: 30,
      borderRadius: 9,
      border: 0,
      background: active ? '#ffffff' : 'transparent',
      boxShadow: active ? '0 1px 4px rgba(23, 43, 36, 0.10)' : 'none',
      color: active ? '#17402c' : '#56665d',
      fontSize: 11.5,
      fontWeight: active ? 700 : 500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
    });

    const targetPresets: Record<ChallengeMetricId, number[]> = {
      elevation_gain_m: [2500, 5000, 10000],
      distance_m: [50, 150, 300],
      duration_s: [20, 40, 100],
      activities_count: [5, 12, 25],
    };

    // Vue dédiée création de défi (propre, aérée, zéro surcharge)
    if (challengeFormOpen && canEditGovernance) {
      return (
        <div className="club-drawer-pane-content" data-testid="club-settings-challenge-creator-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 32, padding: '0 12px', fontSize: 12 }}
              onClick={() => setChallengeFormOpen(false)}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              <span>Retour aux défis</span>
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#17402c' }}>Nouveau défi</span>
          </div>

          <form
            onSubmit={handleCreateChallenge}
            style={{
              padding: 14,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.88)',
              border: '0.5px solid rgba(23, 43, 36, 0.08)',
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(23, 43, 36, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Format
              </span>
              <div style={{ ...segmentedTrackStyle, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <button type="button" style={segBtnStyle(challengeScope === 'club')} onClick={() => setChallengeScope('club')}>
                  Collectif
                </button>
                <button type="button" style={segBtnStyle(challengeScope === 'individual')} onClick={() => setChallengeScope('individual')}>
                  Individuel
                </button>
              </div>
            </div>

            {/* Identité */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Titre & Règles
              </span>
              <input
                type="text"
                style={fieldStyle}
                placeholder="Ex : 10 000 m D+ en Vanoise"
                value={challengeTitle}
                onChange={(e) => setChallengeTitle(e.target.value)}
                maxLength={120}
                required
              />
              <textarea
                rows={2}
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 60 }}
                placeholder="Description, règles ou récompense (optionnel)…"
                value={challengeDesc}
                onChange={(e) => setChallengeDesc(e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Métrique & Objectif */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Objectif à atteindre
              </span>
              <div style={{ ...segmentedTrackStyle, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                {(Object.keys(CHALLENGE_METRIC_META) as ChallengeMetricId[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    style={segBtnStyle(challengeMetric === m)}
                    onClick={() => {
                      setChallengeMetric(m);
                      setChallengeTarget(CHALLENGE_METRIC_META[m].defaultTarget);
                    }}
                  >
                    {m === 'elevation_gain_m' ? 'D+' : CHALLENGE_METRIC_META[m].label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  style={{ ...fieldStyle, flex: 1, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  value={challengeTarget}
                  placeholder={metricMeta.placeholder}
                  onChange={(e) => setChallengeTarget(e.target.value)}
                  aria-label={`Objectif en ${metricMeta.unit}`}
                  required
                />
                <span className="club-badge-sage" style={{ flex: 'none', padding: '6px 10px', fontSize: 12 }}>
                  {metricMeta.unit}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {targetPresets[challengeMetric].map((preset) => {
                  const isSel = Number(challengeTarget) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setChallengeTarget(String(preset))}
                      style={{
                        flex: 1,
                        height: 28,
                        borderRadius: 999,
                        border: isSel ? '1px solid rgba(23, 64, 44, 0.3)' : '1px solid rgba(23, 43, 36, 0.08)',
                        background: isSel ? 'rgba(150, 186, 142, 0.22)' : 'rgba(23, 43, 36, 0.03)',
                        color: isSel ? '#17402c' : '#56665d',
                        fontSize: 11,
                        fontWeight: isSel ? 700 : 600,
                        cursor: 'pointer',
                      }}
                    >
                      {preset.toLocaleString('fr-FR')} {metricMeta.unit}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Durée */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Durée
              </span>
              <div style={{ ...segmentedTrackStyle, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                {[
                  { d: 7, label: '7 jours' },
                  { d: 30, label: '30 jours' },
                  { d: 90, label: 'Saison · 90 j' },
                ].map((opt) => (
                  <button
                    key={opt.d}
                    type="button"
                    style={segBtnStyle(challengeDurationDays === opt.d)}
                    onClick={() => setChallengeDurationDays(opt.d)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Discipline (pilules propres, aucun select natif) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Discipline
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CHALLENGE_SPORTS.map((sp) => {
                  const active = challengeSport === sp;
                  return (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setChallengeSport(sp)}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: active ? '1px solid rgba(23, 64, 44, 0.28)' : '1px solid rgba(23, 43, 36, 0.09)',
                        background: active ? 'rgba(150, 186, 142, 0.22)' : 'rgba(255, 255, 255, 0.9)',
                        color: active ? '#17402c' : '#56665d',
                        fontSize: 11.5,
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {sp}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Badge récompense */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#56665d', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Badge récompense
              </span>
              <div style={{ ...segmentedTrackStyle, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                {(['trophy', 'mountain', 'flame', 'compass'] as const).map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    aria-label={`Icône ${ic}`}
                    style={segBtnStyle(challengeBadgeIcon === ic)}
                    onClick={() => setChallengeBadgeIcon(ic)}
                  >
                    {renderBadgeIcon(ic, 15)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                style={fieldStyle}
                placeholder="Nom du badge (optionnel)"
                value={challengeBadgeTitle}
                onChange={(e) => setChallengeBadgeTitle(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Aperçu en direct */}
            {challengeTitle.trim() ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.20), rgba(150, 186, 142, 0.10))',
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
                    {renderBadgeIcon(challengeBadgeIcon, 14)}
                    <span>{challengeTitle.trim()}</span>
                  </span>
                  <span className="club-badge-sage">
                    {formatChallengeTarget(challengeMetric, rawTargetValue)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#4a5c53' }}>
                  {challengeScope === 'club' ? 'Collectif' : 'Individuel'} · {challengeSport} · {challengeDurationDays} jours
                </span>
              </div>
            ) : null}

            <button
              type="submit"
              className="lkdv-carnet-btn-soft"
              style={{
                width: '100%',
                justifyContent: 'center',
                height: 40,
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.30), rgba(150, 186, 142, 0.16))',
                color: '#17402c',
              }}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Publier le défi</span>
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-challenges-pane">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Barre KPI + bouton Nouveau défi (filtres en bas à droite) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="club-badge-sage">{activeChallenges.length} actifs</span>
              <span className="club-badge-soft">{totalParticipants} participants</span>
            </div>
            {canEditGovernance ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{
                  height: 32,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'linear-gradient(180deg, rgba(150, 186, 142, 0.24), rgba(150, 186, 142, 0.12))',
                  color: '#17402c',
                }}
                onClick={() => setChallengeFormOpen(true)}
              >
                <Plus size={14} aria-hidden="true" />
                <span>Nouveau défi</span>
              </button>
            ) : null}
          </div>

          {!challengesLoaded && UUID_RE.test(activeClub.id) ? (
            <div style={{ fontSize: 12, color: 'var(--label2)', textAlign: 'center', padding: 16 }}>
              Chargement des défis du club…
            </div>
          ) : visibleChallenges.length === 0 ? (
            <ClubEmptyCard
              icon={<Award size={22} />}
              title="Aucun défi dans cette catégorie"
              description="Créez un défi collectif ou individuel pour fédérer la cordée autour d’un objectif."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleChallenges.map((c) => {
                const daysLeft = Math.max(0, Math.ceil((Date.parse(c.endsAt) - nowMs) / 86_400_000));
                const isEnded = Date.parse(c.endsAt) < nowMs;
                const pct = Math.min(100, Math.max(0, Math.round(c.completionPct ?? 0)));
                return (
                  <div
                    key={c.id}
                    className="club-glass-card"
                    style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#17402c', display: 'inline-flex' }}>
                            {renderBadgeIcon(c.badgeIcon, 14)}
                          </span>
                          <b style={{ fontSize: 13, color: 'var(--label)' }}>{c.title}</b>
                        </div>
                        {c.description ? (
                          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--label2)' }}>
                            {c.description}
                          </p>
                        ) : null}
                      </div>
                      <span className={isEnded ? 'club-badge-soft' : 'club-badge-sage'} style={{ flex: 'none' }}>
                        {isEnded ? 'Terminé' : `${daysLeft} j restants`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: 'var(--label2)' }}>
                      <span className="club-badge-soft">{c.scope === 'club' ? 'Collectif' : 'Individuel'}</span>
                      {c.sport ? <span className="club-badge-soft">{c.sport}</span> : null}
                      <span className="club-badge-soft">
                        Objectif : {formatChallengeTarget(c.metric, c.targetValue)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                        <Users size={11} aria-hidden="true" />
                        <span>{c.participantsCount ?? 0}</span>
                      </span>
                    </div>

                    {/* Barre de progression */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--label2)' }}>
                        <span>Progression collective</span>
                        <b style={{ color: '#17402c' }}>{pct} %</b>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: 'rgba(23, 64, 44, 0.09)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #275d3f, #4c8c64)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--label2)' }}>
                      <Calendar size={11} aria-hidden="true" />
                      <span>
                        Du {new Date(c.startsAt).toLocaleDateString('fr-FR')} au {new Date(c.endsAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4 — Équipe, Rôles & Pôles (Permissions — instantané optimiste)
  if (activeSubTab === 4) {
    const selectedMember = selectedMemberId
      ? members.find((m) => (m.userId || m.id) === selectedMemberId) ?? null
      : null;

    if (selectedMember) {
      const targetUid = selectedMember.userId || selectedMember.id;
      const rawRole: ClubRole = selectedMember.rawRole ?? 'member';
      const isTargetFounder = rawRole === 'founder';
      const isSelf = Boolean(currentUserId && targetUid === currentUserId);
      const canEditThisRole =
        canEditGovernance && !isTargetFounder && !isSelf && (rawRole !== 'admin' || isFounder);

      const assignableRoles: Array<{ id: ClubRole; label: string }> = [
        ...(isFounder ? [{ id: 'admin' as ClubRole, label: 'Admin' }] : []),
        { id: 'moderator', label: 'Modérateur' },
        { id: 'member', label: 'Membre' },
      ];

      return (
        <div className="club-drawer-pane-content" data-testid="club-settings-member-detail-pane">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 32, padding: '0 10px' }}
              onClick={() => {
                setSelectedMemberId(null);
                setConfirmTransferId(null);
              }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              <span>Retour à l’équipe</span>
            </button>
          </div>

          <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14, color: 'var(--label)', display: 'block' }}>{selectedMember.name}</b>
                <span style={{ fontSize: 12, color: 'var(--label2)' }}>
                  @{selectedMember.handle} · {roleLabel(rawRole)}
                </span>
              </div>
              <span className={isTargetFounder ? 'club-badge-sage' : 'club-badge-soft'}>
                {isTargetFounder ? 'Fondateur (protégé)' : roleLabel(rawRole)}
              </span>
            </div>

            {canEditThisRole && onChangeMemberRole ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid rgba(23, 64, 44, 0.08)' }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label2)' }}>Grade dans le club</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={`Grade de ${selectedMember.name}`}>
                  {assignableRoles.map((r) => {
                    const active = rawRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`reseau-btn ${active ? 'active' : ''}`}
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => void onChangeMemberRole(targetUid, r.id)}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid rgba(23, 64, 44, 0.08)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label2)', marginBottom: 2 }}>Pôles & Responsabilités</span>
              <Switch
                className="w-full justify-between"
                checked={Boolean(selectedMember.isCertifiedLeader)}
                disabled={!canEditGovernance}
                onCheckedChange={(checked) => {
                  if (onToggleMemberLeaderBadge) {
                    void onToggleMemberLeaderBadge(targetUid, checked);
                  }
                }}
                label="Encadrant / Guide sorties"
                aria-label={`Nommer ${selectedMember.name} Encadrant sorties`}
              />
              <Switch
                className="w-full justify-between"
                checked={Boolean(selectedMember.canManageGear || rawRole === 'founder' || rawRole === 'admin')}
                disabled={!canEditGovernance || rawRole === 'founder' || rawRole === 'admin'}
                onCheckedChange={(checked) => {
                  if (onToggleMemberGearPermission) {
                    void onToggleMemberGearPermission(targetUid, checked);
                  }
                }}
                label="Référent Matériel & Prêts"
                aria-label={`Autoriser ${selectedMember.name} à gérer l’inventaire matériel`}
              />
              <Switch
                className="w-full justify-between"
                checked={Boolean(selectedMember.canManageStories || rawRole === 'founder' || rawRole === 'admin')}
                disabled={!canEditGovernance || rawRole === 'founder' || rawRole === 'admin'}
                onCheckedChange={(checked) => {
                  if (onToggleMemberStoryPermission) {
                    void onToggleMemberStoryPermission(targetUid, checked);
                  }
                }}
                label="Référent Com & Stories à la une"
                aria-label={`Autoriser ${selectedMember.name} à gérer les stories`}
              />
            </div>

            {isFounder && !isTargetFounder && !isSelf ? (
              <div style={{ paddingTop: 8, borderTop: '1px solid rgba(23, 64, 44, 0.08)' }}>
                {confirmTransferId === targetUid ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ flex: 1, justifyContent: 'center', fontSize: 11.5, color: '#b91c1c' }}
                      disabled={busyKey === `transfer:${targetUid}`}
                      onClick={() => void handleTransferOwnership(targetUid, selectedMember.name)}
                    >
                      Confirmer le transfert
                    </button>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ fontSize: 11.5 }}
                      onClick={() => setConfirmTransferId(null)}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="lkdv-carnet-btn-soft"
                    style={{ fontSize: 11.5 }}
                    onClick={() => setConfirmTransferId(targetUid)}
                  >
                    Transférer la propriété du club…
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-team-pane">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: memberSearch ? 28 : 10, width: '100%' }}
            placeholder="Rechercher un membre, rôle ou pôle…"
            aria-label="Rechercher un membre pour gérer ses permissions"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredMembers.slice(0, 50).map((m) => {
            const targetUid = m.userId || m.id;
            const rawRole: ClubRole = m.rawRole ?? 'member';
            const isTargetFounder = rawRole === 'founder';
            return (
              <button
                key={m.id}
                type="button"
                className="club-glass-card"
                onClick={() => setSelectedMemberId(targetUid)}
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 13.5, color: 'var(--label)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </b>
                  <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
                    @{m.handle} · {roleLabel(rawRole)}
                  </span>
                  {(m.isCertifiedLeader || m.canManageGear || m.canManageStories) ? (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {m.isCertifiedLeader ? (
                        <span className="club-badge-sage" style={{ fontSize: 10 }}>
                          <Award size={10} style={{ marginRight: 2 }} aria-hidden="true" />
                          Encadrant
                        </span>
                      ) : null}
                      {m.canManageGear ? (
                        <span className="club-badge-soft" style={{ fontSize: 10 }}>
                          <Package size={10} style={{ marginRight: 2 }} aria-hidden="true" />
                          Matériel
                        </span>
                      ) : null}
                      {m.canManageStories ? (
                        <span className="club-badge-soft" style={{ fontSize: 10 }}>
                          <Sparkles size={10} style={{ marginRight: 2 }} aria-hidden="true" />
                          Stories
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                  <span className={isTargetFounder ? 'club-badge-sage' : 'club-badge-soft'}>
                    {roleLabel(rawRole)}
                  </span>
                  <ChevronRight size={15} style={{ opacity: 0.55 }} aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 5 — Paramétrage & Sécurité du club
  const handleSaveClubSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditGovernance) return;
    setCfgSaving(true);
    const joinQuestions = [cfgJoinQ1.trim(), cfgJoinQ2.trim()].filter(Boolean);
    try {
      if (UUID_RE.test(activeClub.id)) {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cfgName.trim() || activeClub.name,
            zoneLabel: cfgZone.trim() || null,
            description: cfgDesc.trim(),
            privacy: cfgPrivacy,
            rules: cfgRules.trim() || null,
            joinQuestions,
          }),
        });
        if (!res.ok) {
          onToast?.({ title: 'Enregistrement refusé', subtitle: `Erreur ${res.status}` });
          return;
        }
      }
      onToast?.({ title: 'Paramètres du club enregistrés ✓', subtitle: cfgName.trim() || activeClub.name });
    } catch {
      onToast?.({ title: 'Erreur réseau', subtitle: 'Impossible de sauvegarder les paramètres' });
    } finally {
      setCfgSaving(false);
    }
  };

  return (
    <div className="club-drawer-pane-content" data-testid="club-settings-moderation-pane">
      {/* Paramétrage complet du club */}
      <form
        onSubmit={handleSaveClubSettings}
        className="club-glass-card"
        style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={16} color="#17402c" aria-hidden="true" />
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Paramétrage du club</b>
          </div>
          <span className="club-badge-sage">
            {cfgPrivacy === 'open' ? 'Ouvert' : cfgPrivacy === 'closed' ? 'Sur validation' : 'Secret'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>
            Nom du club
            <input
              type="text"
              className="club-glass-input"
              style={{ width: '100%', marginTop: 3 }}
              value={cfgName}
              onChange={(e) => setCfgName(e.target.value)}
              disabled={!canEditGovernance}
              minLength={2}
              maxLength={80}
              required
            />
          </label>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>
            Massif / Territoire
            <input
              type="text"
              className="club-glass-input"
              style={{ width: '100%', marginTop: 3 }}
              placeholder="Ex : Chamonix · Mont-Blanc"
              value={cfgZone}
              onChange={(e) => setCfgZone(e.target.value)}
              disabled={!canEditGovernance}
              maxLength={120}
            />
          </label>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>
            Présentation du club
            <textarea
              className="club-glass-input"
              rows={2}
              style={{ width: '100%', marginTop: 3, resize: 'vertical', minHeight: 54 }}
              placeholder="Esprit de la cordée, disciplines, niveau habituel…"
              value={cfgDesc}
              onChange={(e) => setCfgDesc(e.target.value)}
              disabled={!canEditGovernance}
              maxLength={1000}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Politique d’accès & visibilité</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                { id: 'open', label: 'Ouvert' },
                { id: 'closed', label: 'Validation' },
                { id: 'secret', label: 'Secret' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!canEditGovernance}
                className={`reseau-btn ${cfgPrivacy === opt.id ? 'active' : ''}`}
                style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                onClick={() => setCfgPrivacy(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>
          Charte & règlement intérieur
          <textarea
            className="club-glass-input"
            rows={2}
            style={{ width: '100%', marginTop: 3, resize: 'vertical', minHeight: 52 }}
            placeholder="Ex : Respect de la sécurité, matériel DVA obligatoire en hiver…"
            value={cfgRules}
            onChange={(e) => setCfgRules(e.target.value)}
            disabled={!canEditGovernance}
            maxLength={1000}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>
            Questions d’adhésion (optionnel)
          </span>
          <input
            type="text"
            className="club-glass-input"
            placeholder="Question 1 (ex : Quelle est ton expérience en alpinisme ?)"
            value={cfgJoinQ1}
            onChange={(e) => setCfgJoinQ1(e.target.value)}
            disabled={!canEditGovernance}
            maxLength={160}
          />
          <input
            type="text"
            className="club-glass-input"
            placeholder="Question 2 (ex : Es-tu autonome sur glacier ?)"
            value={cfgJoinQ2}
            onChange={(e) => setCfgJoinQ2(e.target.value)}
            disabled={!canEditGovernance}
            maxLength={160}
          />
        </div>

        {canEditGovernance ? (
          <button
            type="submit"
            className="lkdv-carnet-btn-soft"
            disabled={cfgSaving}
            style={{ width: '100%', justifyContent: 'center', height: 36, fontWeight: 700 }}
          >
            <Check size={14} aria-hidden="true" />
            <span>{cfgSaving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</span>
          </button>
        ) : null}
      </form>

      <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color="#17402c" aria-hidden="true" />
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Membres en sourdine</b>
          </div>
          <span className="club-badge-soft">{mutedMembers.length}</span>
        </div>
        {mutedMembers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--label2)' }}>
            Aucun membre actuellement restreint dans les salons.
          </div>
        ) : (
          mutedMembers.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
              <span>{m.name} (@{m.handle})</span>
              {canReviewAccess ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ fontSize: 11, height: 26, padding: '0 8px' }}
                  disabled={busyKey === `unmute:${m.userId || m.id}`}
                  onClick={() => void handleUnmute(m.userId || m.id, m.name)}
                >
                  Lever la sourdine
                </button>
              ) : (
                <span className="club-badge-soft">Muté</span>
              )}
            </div>
          ))
        )}
      </div>

      {auditLogs.length > 0 ? (
        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 13, color: 'var(--label)' }}>Journal des permissions</b>
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} style={{ fontSize: 11.5, color: 'var(--label2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{log.action}</span>
              <span>{new Date(log.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
