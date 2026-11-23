'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, UserCheck, X } from 'lucide-react';
import type { ClubJoinRequest } from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminMembersAccessPaneProps {
  activeClub: ClubItemData;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

export function AdminMembersAccessPane({
  activeClub,
  caps,
  onToast,
}: AdminMembersAccessPaneProps) {
  const [requests, setRequests] = useState<ClubJoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const canReview = caps.has('members.review_requests');
  const canInvites = caps.has('members.manage_invites');

  useEffect(() => {
    if (!canReview || !UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let active = true;
    setLoading(true);
    void fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { data?: { joinRequests?: ClubJoinRequest[] } } | null) => {
        if (active && payload?.data?.joinRequests) {
          setRequests(payload.data.joinRequests.filter((r) => r.status === 'pending'));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeClub.id, canReview]);

  const handleReview = async (requestId: string, approve: boolean) => {
    if (!canReview || busyId) return;
    setBusyId(requestId);
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', requestId, approve }),
        });
        if (!res.ok) throw new Error('Action refusée');
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onToast?.({
        title: approve ? 'Membre accepté ✓' : 'Demande refusée',
      });
    } catch {
      onToast?.({ title: 'Impossible de traiter cette demande' });
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateInvite = async () => {
    if (!canInvites || creatingInvite) return;
    setCreatingInvite(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lkdv.app';
      const fallbackUrl = `${origin}/clubs/${encodeURIComponent(activeClub.slug)}?invite=${Date.now().toString(36)}`;
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch('/api/clubs/invites', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'club',
            targetId: activeClub.id,
            clubId: activeClub.id,
          }),
        });
        const payload = (await res.json().catch(() => null)) as {
          data?: { shareUrl?: string; token?: string };
        } | null;
        if (res.ok && payload?.data) {
          setInviteUrl(
            payload.data.shareUrl ||
              `${origin}/clubs/${encodeURIComponent(activeClub.slug)}?invite=${payload.data.token}`,
          );
          onToast?.({ title: 'Lien d’invitation généré ✓' });
          return;
        }
      }
      setInviteUrl(fallbackUrl);
      onToast?.({ title: 'Lien d’invitation prêt ✓' });
    } finally {
      setCreatingInvite(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canReview ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
              <UserCheck size={14} aria-hidden="true" />
              <span>Demandes d’adhésion</span>
            </span>
            <span className="club-badge-sage">{requests.length}</span>
          </div>

          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
          ) : requests.length === 0 ? (
            <ClubEmptyCard
              icon={<UserCheck size={18} />}
              title="Aucune demande en attente"
              description="Les nouvelles candidatures au club apparaîtront ici."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.6)',
                    border: '0.5px solid rgba(23, 43, 36, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13 }}>{req.displayName}</b>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void handleReview(req.id, true)}
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 10px', color: '#17402c', background: 'rgba(23, 64, 44, 0.1)' }}
                      >
                        <Check size={13} aria-hidden="true" />
                        <span>Accepter</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void handleReview(req.id, false)}
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 10px', color: '#b91c1c' }}
                      >
                        <X size={13} aria-hidden="true" />
                        <span>Refuser</span>
                      </button>
                    </div>
                  </div>
                  {req.message ? (
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>{req.message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {canInvites ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Link2 size={14} aria-hidden="true" />
            <span>Liens & QR d’invitation</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label2)' }}>
            Créez un lien d’invitation révocable pour intégrer des membres directement.
          </p>
          <button
            type="button"
            disabled={creatingInvite}
            onClick={() => void handleGenerateInvite()}
            className="lkdv-carnet-btn-soft"
            style={{ justifyContent: 'center', height: 36, color: '#17402c', fontWeight: 700 }}
          >
            <Link2 size={14} aria-hidden="true" />
            <span>{creatingInvite ? 'Génération…' : 'Générer un lien d’invitation'}</span>
          </button>
          {inviteUrl ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                className="club-glass-input"
                value={inviteUrl}
                style={{ flex: 1, fontSize: 11.5 }}
              />
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 34, padding: '0 10px', flex: 'none' }}
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteUrl).catch(() => {});
                  onToast?.({ title: 'Lien copié ✓' });
                }}
                aria-label="Copier le lien d’invitation"
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
