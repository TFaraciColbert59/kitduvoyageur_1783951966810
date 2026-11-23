'use client';

import React, { useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import type { ClubChallengeItem, ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminChallengesPaneProps {
  activeClub: ClubItemData;
  challenges: ClubChallengeItem[];
  challengeFilter: 'all' | 'active' | 'ended';
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

export function AdminChallengesPane({
  activeClub,
  challenges,
  challengeFilter,
  caps,
  onToast,
}: AdminChallengesPaneProps) {
  const [items, setItems] = useState<ClubChallengeItem[]>(challenges);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('150');
  const [unit, setUnit] = useState('km');
  const [creating, setCreating] = useState(false);

  const canManage = caps.has('challenges.manage');

  const visible = items.filter((c) => {
    const ended = c.current >= c.target;
    if (challengeFilter === 'active') return !ended;
    if (challengeFilter === 'ended') return ended;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    const numTarget = Math.max(1, Number(target) || 100);
    if (!canManage || clean.length < 2 || creating) return;
    setCreating(true);
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const now = new Date();
        const end = new Date(now.getTime() + 30 * 86400_000);
        await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/challenges`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            scope: 'club',
            title: clean,
            description: `Objectif collectif ${numTarget} ${unit}`,
            metric: unit === 'm D+' ? 'elevation_gain_m' : unit === 'sorties' ? 'activities_count' : 'distance_m',
            targetValue: unit === 'km' ? numTarget * 1000 : numTarget,
            startsAt: now.toISOString(),
            endsAt: end.toISOString(),
            badgeTitle: clean,
            badgeIcon: '🏔️',
          }),
        });
      }
      setItems((prev) => [
        {
          id: `ch-${Date.now()}`,
          title: clean,
          subtitle: `Objectif collectif ${numTarget} ${unit}`,
          current: 0,
          target: numTarget,
          unit,
          rewardBadge: '🏔️',
        },
        ...prev,
      ]);
      setTitle('');
      onToast?.({ title: 'Défi créé ✓', subtitle: clean });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canManage ? (
        <form onSubmit={handleCreate} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            Lancer un défi club
          </div>
          <input
            type="text"
            className="club-glass-input"
            placeholder="Ex : Défi Automne 10 000 m D+"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={2}
            maxLength={100}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
            <input
              type="number"
              min={1}
              className="club-glass-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Objectif du défi"
            />
            <select
              className="club-glass-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Unité du défi"
            >
              <option value="km">km</option>
              <option value="m D+">m D+</option>
              <option value="sorties">sorties</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || title.trim().length < 2}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 36,
              background: 'rgba(23, 64, 44, 0.12)',
              color: '#17402c',
              fontWeight: 700,
            }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>{creating ? 'Création…' : 'Créer le défi'}</span>
          </button>
        </form>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Trophy size={14} aria-hidden="true" />
            <span>Défis du club ({visible.length})</span>
          </span>
        </div>
        {visible.length === 0 ? (
          <ClubEmptyCard
            icon={<Trophy size={18} />}
            title="Aucun défi dans ce filtre"
            description="Créez un défi collectif pour fédérer la cordée."
          />
        ) : (
          visible.map((ch) => {
            const pct = Math.min(100, Math.round((ch.current / Math.max(1, ch.target)) * 100));
            return (
              <div
                key={ch.id}
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
                  <b style={{ fontSize: 13 }}>{ch.title}</b>
                  <span className="club-badge-sage" style={{ fontSize: 10.5 }}>{pct}%</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--label2)' }}>
                  {ch.current} / {ch.target} {ch.unit}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
