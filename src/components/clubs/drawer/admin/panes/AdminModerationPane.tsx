'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, EyeOff, Flag, Trash2, Volume2, VolumeX } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
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

  const segments = [
    { id: 'reports', label: `Signalements (${reports.length})`, visible: true },
    { id: 'muted', label: `Sourdines (${mutedMembers.length})`, visible: canMute },
    { id: 'banned', label: `Bannis (${bannedMembers.length})`, visible: canBan },
  ].filter((s) => s.visible);

  const [activeTab, setActiveTab] = useState<string>('reports');

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.length > 1 ? (
        <SegmentedControl
          size="sm"
          showLabels
          ariaLabel="Catégories de modération"
          value={activeTab}
          onChange={setActiveTab}
          items={segments.map((s) => ({ id: s.id, label: s.label }))}
        />
      ) : null}

      {activeTab === 'reports' ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
          ) : reports.length === 0 ? (
            <ClubEmptyCard
              icon={<Flag size={17} />}
              title="Aucun signalement ouvert"
              description="La communauté est calme — rien à modérer."
            />
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                style={{
                  padding: '8px 10px',
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
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--label)' }}>
                    {rep.reason}
                  </div>
                </div>
                {canResolve ? (
                  <div style={{ display: 'inline-flex', gap: 4, flex: 'none' }}>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}
                      aria-label="Masquer le message"
                      title="Masquer"
                      onClick={() => void resolveReport(rep.id, 'hide_message')}
                    >
                      <EyeOff size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, width: 28, padding: 0, justifyContent: 'center', color: '#991b1b', background: 'var(--club-danger-bg, #f5ddd9)' }}
                      aria-label="Supprimer le message"
                      title="Supprimer"
                      onClick={() => void resolveReport(rep.id, 'delete_message')}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                    {canMute ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, width: 28, padding: 0, justifyContent: 'center', color: '#92400e', background: 'var(--club-warn-bg, #fbf1dc)' }}
                        aria-label="Muter l’auteur 24h"
                        title="Muter 24h"
                        onClick={() => void resolveReport(rep.id, 'mute_author')}
                      >
                        <VolumeX size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, width: 28, padding: 0, justifyContent: 'center', color: 'var(--tint, #17402c)', background: 'var(--club-soft-bg, #d3ebd9)' }}
                      aria-label="Ignorer le signalement"
                      title="Ignorer"
                      onClick={() => void resolveReport(rep.id, 'dismiss')}
                    >
                      <Check size={12} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'muted' && canMute ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
          {mutedMembers.length === 0 ? (
            <ClubEmptyCard
              icon={<Volume2 size={17} />}
              title="Aucun membre en sourdine"
              description="Les membres mis en sourdine temporaire apparaîtront ici."
            />
          ) : (
            mutedMembers.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 9px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.58)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.displayName}</span>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 26, padding: '0 9px', fontSize: 11, color: 'var(--tint, #17402c)' }}
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

      {activeTab === 'banned' && canBan ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
          {bannedMembers.length === 0 ? (
            <ClubEmptyCard
              icon={<Ban size={17} />}
              title="Aucun membre banni"
              description="Les membres exclus du club apparaîtront ici."
            />
          ) : (
            bannedMembers.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 9px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.58)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.displayName}</span>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 26, padding: '0 9px', fontSize: 11, color: 'var(--tint, #17402c)' }}
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
