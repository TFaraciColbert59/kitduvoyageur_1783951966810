'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, EyeOff, Flag, Trash2, Volume2, VolumeX } from 'lucide-react';
import type { ClubContentReport, ClubMember } from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminModerationPaneProps {
  activeClub: ClubItemData;
  caps: UseClubCapabilitiesResult;
  statusFilter?: 'open' | 'resolved' | 'all';
  onToast?: (toast: ClubToastPayload) => void;
}

export function AdminModerationPane({
  activeClub,
  caps,
  statusFilter = 'open',
  onToast,
}: AdminModerationPaneProps) {
  const [reports, setReports] = useState<ClubContentReport[]>([]);
  const [mutedMembers, setMutedMembers] = useState<ClubMember[]>([]);
  const [bannedMembers, setBannedMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(false);

  const canResolve = caps.has('moderation.resolve_reports');
  const canMute = caps.has('members.mute');
  const canBan = caps.has('members.ban_or_kick');

  const loadModeration = useCallback(async () => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/moderation${qs}`, {
        credentials: 'include',
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: {
          reports?: ClubContentReport[];
          mutedMembers?: ClubMember[];
          bannedMembers?: ClubMember[];
        };
      } | null;
      if (res.ok && payload?.data) {
        setReports(payload.data.reports ?? []);
        setMutedMembers(payload.data.mutedMembers ?? []);
        setBannedMembers(payload.data.bannedMembers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeClub.id, statusFilter]);

  useEffect(() => {
    void loadModeration();
  }, [loadModeration]);

  const resolveReport = async (
    reportId: string,
    resolution: 'hide_message' | 'delete_message' | 'dismiss' | 'mute_author',
  ) => {
    if (!canResolve) return;
    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/moderation`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_report', reportId, resolution }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Action refusée' });
        return;
      }
    }
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    onToast?.({ title: 'Signalement traité ✓' });
  };

  const unmute = async (userId: string) => {
    if (!canMute) return;
    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/moderation`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmute_member', userId }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Action refusée' });
        return;
      }
    }
    setMutedMembers((prev) => prev.filter((m) => m.userId !== userId));
    onToast?.({ title: 'Sourdine levée ✓' });
  };

  const unban = async (userId: string) => {
    if (!canBan) return;
    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/moderation`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban_member', userId }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Action refusée' });
        return;
      }
    }
    setBannedMembers((prev) => prev.filter((m) => m.userId !== userId));
    onToast?.({ title: 'Membre réintégré ✓' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Flag size={14} aria-hidden="true" />
            <span>File des signalements</span>
          </span>
          <span className="club-badge-sage">{reports.length}</span>
        </div>

        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
        ) : reports.length === 0 ? (
          <ClubEmptyCard
            icon={<Flag size={18} />}
            title="Aucun signalement ouvert"
            description="La communauté est calme — rien à modérer pour le moment."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reports.map((rep) => (
              <div
                key={rep.id}
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
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{rep.reason}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {canResolve ? (
                    <>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                        onClick={() => void resolveReport(rep.id, 'hide_message')}
                      >
                        <EyeOff size={11} aria-hidden="true" />
                        <span>Masquer</span>
                      </button>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#b91c1c' }}
                        onClick={() => void resolveReport(rep.id, 'delete_message')}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                        <span>Supprimer</span>
                      </button>
                      {canMute ? (
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                          onClick={() => void resolveReport(rep.id, 'mute_author')}
                        >
                          <VolumeX size={11} aria-hidden="true" />
                          <span>Muter 24h</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                        onClick={() => void resolveReport(rep.id, 'dismiss')}
                      >
                        <Check size={11} aria-hidden="true" />
                        <span>Ignorer</span>
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canMute ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 12.5, color: '#17402c' }}>Membres en sourdine ({mutedMembers.length})</b>
          {mutedMembers.length === 0 ? (
            <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>Aucun membre muté.</span>
          ) : (
            mutedMembers.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.displayName}</span>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                  onClick={() => void unmute(m.userId)}
                >
                  <Volume2 size={12} aria-hidden="true" />
                  <span>Lever</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {canBan ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 12.5, color: '#17402c' }}>Membres bannis ({bannedMembers.length})</b>
          {bannedMembers.length === 0 ? (
            <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>Aucun membre banni.</span>
          ) : (
            bannedMembers.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.displayName}</span>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                  onClick={() => void unban(m.userId)}
                >
                  <Ban size={12} aria-hidden="true" />
                  <span>Réintégrer</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
