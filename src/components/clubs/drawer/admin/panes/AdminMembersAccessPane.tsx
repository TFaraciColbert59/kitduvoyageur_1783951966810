'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, QrCode, UserCheck, X } from 'lucide-react';
import type { ClubJoinRequest } from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminStatusPill } from '../AdminPrimitives';
import { AdminQrCodeSvg } from '../AdminQrCodeSvg';
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
  const [showQr, setShowQr] = useState(true);

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
          setShowQr(true);
          onToast?.({ title: 'Lien d’invitation généré ✓' });
          return;
        }
      }
      setInviteUrl(fallbackUrl);
      setShowQr(true);
      onToast?.({ title: 'Lien d’invitation prêt ✓' });
    } finally {
      setCreatingInvite(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canReview ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
              <UserCheck size={14} aria-hidden="true" />
              <span>Demandes d’adhésion</span>
            </span>
            <AdminStatusPill tone={requests.length > 0 ? 'warn' : 'neutral'}>
              {requests.length}
            </AdminStatusPill>
          </div>

          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
          ) : requests.length === 0 ? (
            <ClubEmptyCard
              icon={<UserCheck size={17} />}
              title="Aucune demande en attente"
              description="Les nouvelles candidatures apparaîtront ici."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: '7px 9px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.62)',
                    border: '0.5px solid rgba(23, 43, 36, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.displayName}
                    </div>
                    {req.message ? (
                      <div style={{ fontSize: 11, color: 'var(--label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.message}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'inline-flex', gap: 5, flex: 'none' }}>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleReview(req.id, true)}
                      className="lkdv-carnet-btn-soft"
                      aria-label={`Accepter ${req.displayName}`}
                      title="Accepter"
                      style={{
                        height: 28,
                        width: 28,
                        padding: 0,
                        justifyContent: 'center',
                        color: 'var(--tint, #17402c)',
                        background: 'var(--club-soft-bg, #d3ebd9)',
                      }}
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleReview(req.id, false)}
                      className="lkdv-carnet-btn-soft"
                      aria-label={`Refuser ${req.displayName}`}
                      title="Refuser"
                      style={{
                        height: 28,
                        width: 28,
                        padding: 0,
                        justifyContent: 'center',
                        color: '#991b1b',
                        background: 'var(--club-danger-bg, #f5ddd9)',
                      }}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {canInvites ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
              <Link2 size={14} aria-hidden="true" />
              <span>Lien & QR d’invitation</span>
            </span>
            {inviteUrl ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--tint, #17402c)' }}
                onClick={() => setShowQr((v) => !v)}
                aria-expanded={showQr}
              >
                <QrCode size={12} aria-hidden="true" />
                <span>{showQr ? 'Masquer QR' : 'Afficher QR'}</span>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={creatingInvite}
            onClick={() => void handleGenerateInvite()}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 34,
              background: 'var(--club-soft-bg, #d3ebd9)',
              color: 'var(--tint, #17402c)',
              fontWeight: 700,
            }}
          >
            <Link2 size={14} aria-hidden="true" />
            <span>{creatingInvite ? 'Génération…' : inviteUrl ? 'Nouveau lien révocable' : 'Générer un lien d’invitation'}</span>
          </button>

          {inviteUrl ? (
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  className="club-glass-input"
                  value={inviteUrl}
                  aria-label="Lien d’invitation généré"
                  style={{ flex: 1, fontSize: 11.5 }}
                />
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 34, width: 34, padding: 0, justifyContent: 'center', flex: 'none' }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(inviteUrl).catch(() => {});
                    onToast?.({ title: 'Lien copié ✓' });
                  }}
                  aria-label="Copier le lien d’invitation"
                  title="Copier le lien"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </div>

              {showQr ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.72)',
                    border: '0.5px solid rgba(23, 64, 44, 0.12)',
                  }}
                >
                  <AdminQrCodeSvg value={inviteUrl} size={108} />
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <b style={{ fontSize: 12.5, color: 'var(--tint, #17402c)' }}>{activeClub.name}</b>
                    <span style={{ fontSize: 11, color: 'var(--label2)' }}>
                      Scannez ce QR code en sortie ou au refuge pour rejoindre le club instantanément.
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
