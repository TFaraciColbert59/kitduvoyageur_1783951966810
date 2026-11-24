'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Crown, History, Trash2 } from 'lucide-react';
import type { ClubAuditEntry } from '@/features/clubs/types';
import type { ClubItemData, ClubMemberData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminGlassSelect } from '../AdminGlassSelect';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminSecurityAuditPaneProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  currentUserId?: string | null;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const ACTION_LABELS: Record<string, string> = {
  role_change: 'Changement de grade',
  status_change: 'Changement de statut',
  mute_change: 'Mise en sourdine',
  pole_change: 'Permission pôle',
  member_override_change: 'Surcharge individuelle',
  member_override_reset: 'Réinitialisation membre',
  role_policy_change: 'Matrice de rôle',
  role_policy_reset: 'Réinitialisation rôle',
  transfer_ownership: 'Transfert de propriété',
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
  const [transferring, setTransferring] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
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
    } catch (err) {
      onToast?.({
        title: 'Échec du transfert',
        subtitle: err instanceof Error ? err.message : 'Vérifiez le membre cible.',
      });
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteClub = async () => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canViewAudit ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <History size={14} aria-hidden="true" />
            <span>Journal d’audit sécurité</span>
          </div>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement du journal…</span>
          ) : auditEntries.length === 0 ? (
            <ClubEmptyCard
              icon={<History size={18} />}
              title="Aucun événement récent"
              description="Les mutations de rôles, policies et modérations apparaîtront ici."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {auditEntries.slice(0, 25).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.55)',
                    border: '0.5px solid rgba(23, 43, 36, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600 }}>
                    <span>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--label2)' }}>
                      {entry.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  {entry.targetRole ? (
                    <span style={{ fontSize: 11, color: 'var(--label2)' }}>
                      Rôle cible : {entry.targetRole}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {canTransfer ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Crown size={14} aria-hidden="true" />
            <span>Souveraineté — Transférer la propriété</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>
            Désigne un nouveau Fondateur de manière atomique. Vous passerez automatiquement Administrateur.
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
            onClick={() => void handleTransfer()}
            className="lkdv-carnet-btn-soft"
            style={{ justifyContent: 'center', height: 36, color: '#17402c', fontWeight: 700 }}
          >
            <Crown size={14} aria-hidden="true" />
            <span>{transferring ? 'Transfert…' : 'Transférer le statut Fondateur'}</span>
          </button>
        </div>
      ) : null}

      {canDelete ? (
        <div
          className="club-glass-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '0.5px solid rgba(185, 28, 28, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#b91c1c' }}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Zone critique — Supprimer le club</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>
            Action irréversible. Tapez <b>{activeClub.slug}</b> pour confirmer la suppression définitive.
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
            onClick={() => void handleDeleteClub()}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 36,
              background: 'rgba(185, 28, 28, 0.1)',
              color: '#b91c1c',
              fontWeight: 700,
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>{deleting ? 'Suppression…' : 'Supprimer définitivement le club'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
