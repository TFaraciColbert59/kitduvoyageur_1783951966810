'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Crown,
  History,
  RotateCcw,
  Shield,
  Sliders,
  Trash2,
  UserCog,
  VolumeX,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ClubAuditEntry } from '@/features/clubs/types';
import type { ClubItemData, ClubMemberData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminGlassSelect } from '../AdminGlassSelect';
import { AdminAccordionCard, AdminStatusPill } from '../AdminPrimitives';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminSecurityAuditPaneProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  currentUserId?: string | null;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const ACTION_META: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; color: string }
> = {
  role_change: {
    label: 'Changement de grade',
    icon: <UserCog size={13} aria-hidden="true" />,
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
  },
  status_change: {
    label: 'Changement de statut',
    icon: <Shield size={13} aria-hidden="true" />,
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
  },
  mute_change: {
    label: 'Mise en sourdine',
    icon: <VolumeX size={13} aria-hidden="true" />,
    bg: 'var(--club-warn-bg, #fbf1dc)',
    color: '#92400e',
  },
  pole_change: {
    label: 'Permission pôle',
    icon: <Sliders size={13} aria-hidden="true" />,
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
  },
  member_override_change: {
    label: 'Surcharge individuelle',
    icon: <UserCog size={13} aria-hidden="true" />,
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
  },
  member_override_reset: {
    label: 'Réinitialisation membre',
    icon: <RotateCcw size={13} aria-hidden="true" />,
    bg: 'rgba(23, 43, 36, 0.08)',
    color: 'var(--label2, #56665d)',
  },
  role_policy_change: {
    label: 'Matrice de rôle',
    icon: <Sliders size={13} aria-hidden="true" />,
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
  },
  role_policy_reset: {
    label: 'Réinitialisation rôle',
    icon: <RotateCcw size={13} aria-hidden="true" />,
    bg: 'rgba(23, 43, 36, 0.08)',
    color: 'var(--label2, #56665d)',
  },
  transfer_ownership: {
    label: 'Transfert de propriété',
    icon: <Crown size={13} aria-hidden="true" />,
    bg: 'var(--club-danger-bg, #f5ddd9)',
    color: '#991b1b',
  },
};

export function AdminSecurityAuditPane({
  activeClub,
  members,
  currentUserId,
  caps,
  onToast,
}: AdminSecurityAuditPaneProps) {
  const [auditEntries, setAuditEntries] = useState<ClubAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canViewAudit = caps.has('members.view_audit_log');
  const canTransfer = caps.has('club.transfer_ownership');
  const canDelete = caps.has('club.delete');

  useEffect(() => {
    if (!canViewAudit || !UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let active = true;
    setLoading(true);
    void fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { data?: { auditEntries?: ClubAuditEntry[] } } | null) => {
        if (active && payload?.data?.auditEntries) {
          setAuditEntries(payload.data.auditEntries);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeClub.id, canViewAudit]);

  const eligibleSuccessors = members.filter(
    (m) => (m.userId || m.id) !== currentUserId && m.rawRole !== 'founder',
  );
  const selectedSuccessor = eligibleSuccessors.find(
    (m) => (m.userId || m.id) === transferTargetId,
  );

  const handleTransfer = async () => {
    if (!canTransfer || !transferTargetId || transferring) return;
    setTransferring(true);
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'transfer_ownership',
            userId: transferTargetId,
          }),
        });
        if (!res.ok) throw new Error('Transfert refusé');
      }
      onToast?.({
        title: 'Propriété transférée ✓',
        subtitle: 'Vous êtes désormais Administrateur.',
      });
      setTransferTargetId('');
      setConfirmTransferOpen(false);
    } catch (err) {
      onToast?.({
        title: 'Échec du transfert',
        subtitle: err instanceof Error ? err.message : 'Vérifiez le membre cible.',
      });
    } finally {
      setTransferring(false);
    }
  };

  const requestDeleteClub = () => {
    if (!canDelete || deleting) return;
    const needle = deleteConfirm.trim().toLowerCase();
    if (
      needle !== activeClub.slug.toLowerCase() &&
      needle !== activeClub.name.toLowerCase()
    ) {
      onToast?.({
        title: 'Confirmation invalide',
        subtitle: `Saisissez « ${activeClub.slug} » pour confirmer.`,
      });
      return;
    }
    setConfirmDeleteOpen(true);
  };

  const handleDeleteClub = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmSlug: deleteConfirm.trim() }),
        });
        if (!res.ok) throw new Error('Suppression refusée');
      }
      onToast?.({ title: 'Club supprimé', subtitle: activeClub.name });
      setDeleteConfirm('');
      setConfirmDeleteOpen(false);
    } catch (err) {
      onToast?.({
        title: 'Suppression impossible',
        subtitle: err instanceof Error ? err.message : 'Réservé au fondateur.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canViewAudit ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
              <History size={14} aria-hidden="true" />
              <span>Journal d’audit</span>
            </span>
            <AdminStatusPill tone="neutral">{auditEntries.length}</AdminStatusPill>
          </div>

          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
          ) : auditEntries.length === 0 ? (
            <ClubEmptyCard
              icon={<History size={18} />}
              title="Aucun événement récent"
              description="Les mutations de rôles, policies et modérations apparaîtront ici."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {auditEntries.slice(0, 25).map((entry) => {
                const meta = ACTION_META[entry.action] ?? {
                  label: entry.action,
                  icon: <History size={13} aria-hidden="true" />,
                  bg: 'rgba(23, 43, 36, 0.08)',
                  color: 'var(--label2, #56665d)',
                };
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: '7px 9px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.62)',
                      border: '0.5px solid rgba(23, 43, 36, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: meta.bg,
                        color: meta.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      {meta.icon}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--label2)' }}>
                        {entry.createdAt.slice(0, 16).replace('T', ' ')}
                        {entry.targetRole ? ` · ${entry.targetRole}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {canTransfer ? (
        <AdminAccordionCard
          title="Transférer la propriété"
          icon={<Crown size={14} aria-hidden="true" />}
          badge={<AdminStatusPill tone="warn">Souveraineté</AdminStatusPill>}
          tone="warn"
          defaultOpen={false}
        >
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>
            Désigne un nouveau Fondateur. Vous passerez automatiquement Administrateur.
          </p>
          <AdminGlassSelect
            ariaLabel="Choisir le successeur fondateur"
            value={transferTargetId}
            onChange={setTransferTargetId}
            placeholder="Sélectionner un membre actif…"
            options={eligibleSuccessors.map((m) => ({
              value: m.userId || m.id,
              label: `${m.name} (${m.role})`,
            }))}
          />
          <button
            type="button"
            disabled={!transferTargetId || transferring}
            onClick={() => setConfirmTransferOpen(true)}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 34,
              background: 'var(--club-warn-bg, #fbf1dc)',
              color: '#92400e',
              fontWeight: 700,
            }}
          >
            <Crown size={14} aria-hidden="true" />
            <span>Transférer le statut Fondateur</span>
          </button>
        </AdminAccordionCard>
      ) : null}

      {canDelete ? (
        <AdminAccordionCard
          title="Supprimer le club"
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          badge={<AdminStatusPill tone="danger">Critique</AdminStatusPill>}
          tone="danger"
          defaultOpen={false}
        >
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>
            Action irréversible. Tapez <b>{activeClub.slug}</b> pour confirmer.
          </p>
          <input
            type="text"
            className="club-glass-input"
            placeholder={activeClub.slug}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            aria-label="Confirmer le slug du club à supprimer"
          />
          <button
            type="button"
            disabled={deleting || !deleteConfirm.trim()}
            onClick={requestDeleteClub}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 34,
              background: 'var(--club-danger-bg, #f5ddd9)',
              color: '#991b1b',
              fontWeight: 700,
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Supprimer définitivement le club</span>
          </button>
        </AdminAccordionCard>
      ) : null}

      <ConfirmDialog
        open={confirmTransferOpen}
        title="Transférer la propriété ?"
        description={
          selectedSuccessor
            ? `${selectedSuccessor.name} deviendra Fondateur de ${activeClub.name}. Vous passerez Administrateur.`
            : undefined
        }
        confirmLabel="Transférer"
        loading={transferring}
        onConfirm={() => void handleTransfer()}
        onCancel={() => setConfirmTransferOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Supprimer ${activeClub.name} ?`}
        description="Cette suppression est définitive et effacera les salons, sorties et historiques associés."
        confirmLabel="Supprimer définitivement"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDeleteClub()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
