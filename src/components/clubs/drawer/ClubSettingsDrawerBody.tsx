'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Lock,
  Package,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { ClubEmptyCard, normalizeSearchText } from './ClubSharedUi';
import type { ClubGearVaultItem, ClubItemData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
import type { ClubJoinRequest, ClubRole } from '@/features/clubs/types';

export interface ClubSettingsDrawerBodyProps {
  activeSubTab: number;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  vaultGear?: ClubGearVaultItem[];
  currentUserId?: string | null;
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
  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeTarget, setChallengeTarget] = useState('50');

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

  // 1 — Accès, Prêts & Défis
  if (activeSubTab === 1) {
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

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-access-pane">
        {canManageClubGear ? (
          <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={16} color="#17402c" aria-hidden="true" />
                <b style={{ fontSize: 13.5, color: 'var(--label)' }}>À valider & Suivi des prêts</b>
              </div>
              <span className="club-badge-sage">{actionableLoans.length}</span>
            </div>
            {actionableLoans.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--label2)' }}>
                Aucun prêt en attente ou en cours de suivi.
              </div>
            ) : (
              actionableLoans.slice(0, 12).map((g) => {
                const isOverdue =
                  g.loanStatus === 'overdue' ||
                  (g.loanStatus === 'checked_out' && g.neededUntil && Date.parse(g.neededUntil) < Date.now());
                const statusLabel = isOverdue
                  ? 'En retard'
                  : g.loanStatus === 'requested'
                    ? 'Demandé'
                    : g.loanStatus === 'approved'
                      ? 'Validé'
                      : 'Remis';
                const condVal = loanConditionPick[g.loanId!] ?? 'good';
                return (
                  <div
                    key={g.loanId}
                    style={{ paddingTop: 6, borderTop: '1px solid rgba(23, 64, 44, 0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 12.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</b>
                        <span style={{ fontSize: 11, color: 'var(--label2)' }}>
                          {g.borrowerName || 'Membre'}{g.neededUntil ? ` · retour ${g.neededUntil}` : ''}
                        </span>
                      </div>
                      <span
                        className="club-badge-soft"
                        style={isOverdue ? { color: '#b91c1c', background: 'rgba(185, 28, 28, 0.10)' } : undefined}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {g.loanStatus === 'requested' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                          onClick={() => onTransitionGearLoan?.({ loanId: g.loanId!, gearItemId: g.id, status: 'approved' })}
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                          onClick={() => onTransitionGearLoan?.({ loanId: g.loanId!, gearItemId: g.id, status: 'declined' })}
                        >
                          Refuser
                        </button>
                      </div>
                    ) : null}

                    {g.loanStatus === 'approved' ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          aria-label={`État au départ pour ${g.name}`}
                          className="club-glass-input"
                          style={{ flex: 1, fontSize: 11.5, padding: '4px 8px' }}
                          value={condVal}
                          onChange={(e) =>
                            setLoanConditionPick((prev) => ({
                              ...prev,
                              [g.loanId!]: e.target.value as 'new' | 'good' | 'worn' | 'repair',
                            }))
                          }
                        >
                          <option value="new">État départ : Neuf</option>
                          <option value="good">État départ : Bon</option>
                          <option value="worn">État départ : Usé</option>
                        </select>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ fontSize: 11.5 }}
                          onClick={() =>
                            onTransitionGearLoan?.({
                              loanId: g.loanId!,
                              gearItemId: g.id,
                              status: 'checked_out',
                              checkoutCondition: condVal,
                            })
                          }
                        >
                          Remis
                        </button>
                      </div>
                    ) : null}

                    {g.loanStatus === 'checked_out' || g.loanStatus === 'overdue' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <select
                            aria-label={`État au retour pour ${g.name}`}
                            className="club-glass-input"
                            style={{ flex: 1, fontSize: 11.5, padding: '4px 8px' }}
                            value={condVal}
                            onChange={(e) =>
                              setLoanConditionPick((prev) => ({
                                ...prev,
                                [g.loanId!]: e.target.value as 'new' | 'good' | 'worn' | 'repair',
                              }))
                            }
                          >
                            <option value="new">Retour : Neuf</option>
                            <option value="good">Retour : Bon</option>
                            <option value="worn">Retour : Usé</option>
                            <option value="repair">Retour : À réparer</option>
                          </select>
                          <input
                            type="text"
                            className="club-glass-input"
                            style={{ flex: 1, fontSize: 11.5, padding: '4px 8px' }}
                            placeholder="Note retour…"
                            value={loanReturnNote[g.loanId!] ?? ''}
                            onChange={(e) =>
                              setLoanReturnNote((prev) => ({ ...prev, [g.loanId!]: e.target.value }))
                            }
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="lkdv-carnet-btn-soft"
                            style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
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
                            Rendu
                          </button>
                          <button
                            type="button"
                            className="lkdv-carnet-btn-soft"
                            style={{ fontSize: 11.5, color: '#b91c1c' }}
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
              })
            )}
          </div>
        ) : null}

        {canEditGovernance ? (
          <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={16} color="#17402c" aria-hidden="true" />
                <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Défis du club</b>
              </div>
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ fontSize: 11.5, height: 28, padding: '0 10px' }}
                onClick={() => setChallengeFormOpen((v) => !v)}
              >
                {challengeFormOpen ? 'Fermer' : 'Créer un défi'}
              </button>
            </div>
            {challengeFormOpen ? (
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!challengeTitle.trim() || !UUID_RE.test(activeClub.id)) return;
                  const now = new Date();
                  const end = new Date(now.getTime() + 30 * 86_400_000);
                  await runAction('create-challenge', async () => {
                    const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/challenges`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'create',
                        title: challengeTitle.trim(),
                        description: `Défi collectif ${activeClub.name}`,
                        sport: activeClub.category || null,
                        metric: 'distance_m',
                        targetValue: Math.max(1000, (Number(challengeTarget) || 50) * 1000),
                        startsAt: now.toISOString(),
                        endsAt: end.toISOString(),
                        badgeTitle: challengeTitle.trim(),
                        badgeIcon: 'trophy',
                      }),
                    });
                    if (res.ok) {
                      onToast?.({ title: 'Défi créé ✓', subtitle: challengeTitle.trim() });
                      setChallengeTitle('');
                      setChallengeFormOpen(false);
                    } else {
                      onToast?.({ title: 'Création refusée', subtitle: `Erreur ${res.status}` });
                    }
                  });
                }}
              >
                <input
                  type="text"
                  className="club-glass-input"
                  placeholder="Titre du défi (ex : 100 km en Vanoise)"
                  value={challengeTitle}
                  onChange={(e) => setChallengeTitle(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={1}
                    className="club-glass-input"
                    style={{ width: 100 }}
                    value={challengeTarget}
                    onChange={(e) => setChallengeTarget(e.target.value)}
                    aria-label="Objectif en km"
                  />
                  <span style={{ fontSize: 12, color: 'var(--label2)' }}>km sur 30 jours</span>
                  <button
                    type="submit"
                    className="lkdv-carnet-btn-soft"
                    style={{ marginLeft: 'auto', fontSize: 11.5 }}
                    disabled={busyKey === 'create-challenge'}
                  >
                    Publier
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}

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

  // 2 — Équipe, Rôles & Pôles (Permissions)
  if (activeSubTab === 2) {
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
                        disabled={busyKey === `role:${targetUid}`}
                        className={`reseau-btn ${active ? 'active' : ''}`}
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => void runAction(`role:${targetUid}`, () => onChangeMemberRole(targetUid, r.id))}
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
                disabled={!canEditGovernance || busyKey === `leader:${targetUid}`}
                onCheckedChange={(checked) => {
                  if (onToggleMemberLeaderBadge) {
                    void runAction(`leader:${targetUid}`, () => onToggleMemberLeaderBadge(targetUid, checked));
                  }
                }}
                label="Encadrant / Guide sorties"
                aria-label={`Nommer ${selectedMember.name} Encadrant sorties`}
              />
              <Switch
                className="w-full justify-between"
                checked={Boolean(selectedMember.canManageGear || rawRole === 'founder' || rawRole === 'admin')}
                disabled={!canEditGovernance || rawRole === 'founder' || rawRole === 'admin' || busyKey === `gear:${targetUid}`}
                onCheckedChange={(checked) => {
                  if (onToggleMemberGearPermission) {
                    void runAction(`gear:${targetUid}`, () => onToggleMemberGearPermission(targetUid, checked));
                  }
                }}
                label="Référent Matériel & Prêts"
                aria-label={`Autoriser ${selectedMember.name} à gérer l’inventaire matériel`}
              />
              <Switch
                className="w-full justify-between"
                checked={Boolean(selectedMember.canManageStories || rawRole === 'founder' || rawRole === 'admin')}
                disabled={!canEditGovernance || rawRole === 'founder' || rawRole === 'admin' || busyKey === `stories:${targetUid}`}
                onCheckedChange={(checked) => {
                  if (onToggleMemberStoryPermission) {
                    void runAction(`stories:${targetUid}`, () => onToggleMemberStoryPermission(targetUid, checked));
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

  // 3 — Modération & Sécurité
  return (
    <div className="club-drawer-pane-content" data-testid="club-settings-moderation-pane">
      <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} color="#17402c" aria-hidden="true" />
          <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Règles de sécurité & hiérarchie</b>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', lineHeight: 1.45 }}>
          Le rôle <b>Fondateur</b> est protégé contre toute rétrogradation. Seul le fondateur peut nommer ou rétrograder des administrateurs, et les modérateurs ne peuvent pas modifier les grades.
        </p>
      </div>

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
