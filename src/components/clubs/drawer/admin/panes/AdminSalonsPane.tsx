'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Calendar,
  Hash,
  Lock,
  Megaphone,
  Plus,
  RotateCcw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import {
  CLUB_ROLE_LABELS,
  type ClubChannel,
  type ClubChannelKind,
  type ClubRole,
} from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminGlassSelect } from '../AdminGlassSelect';
import { AdminCollapsibleCreate } from '../AdminPrimitives';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminSalonsPaneProps {
  activeClub: ClubItemData;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const MIN_ROLE_OPTIONS: ClubRole[] = ['member', 'volunteer', 'moderator', 'admin', 'founder'];

export function AdminSalonsPane({ activeClub, caps, onToast }: AdminSalonsPaneProps) {
  const [channels, setChannels] = useState<ClubChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ClubChannelKind>('custom');
  const [minRole, setMinRole] = useState<ClubRole>('member');
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  const canCreate = caps.has('salons.create');
  const canEdit = caps.has('salons.edit_settings');
  const canArchive = caps.has('salons.archive_or_delete');

  const loadSalons = useCallback(async () => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(activeClub.id)}/salons?includeArchived=1`,
        { credentials: 'include' },
      );
      const payload = (await res.json().catch(() => null)) as {
        data?: { channels?: ClubChannel[] };
      } | null;
      if (res.ok && payload?.data?.channels) {
        setChannels(payload.data.channels);
      }
    } finally {
      setLoading(false);
    }
  }, [activeClub.id]);

  useEffect(() => {
    void loadSalons();
  }, [loadSalons]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!canCreate || clean.length < 2 || creating) return;
    setCreating(true);
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_channel',
            name: clean,
            kind,
            description: description.trim() || null,
            minRole,
            readOnlyForMembers: readOnly,
            position: channels.length,
          }),
        });
        const payload = (await res.json().catch(() => null)) as { data?: ClubChannel } | null;
        if (!res.ok || !payload?.data) throw new Error('Création refusée');
        setChannels((prev) => [...prev, payload.data!]);
      } else {
        setChannels((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            clubId: activeClub.id,
            name: clean,
            kind,
            description: description.trim() || null,
            minRole,
            readOnlyForMembers: readOnly,
            notificationsEnabledByDefault: true,
            position: prev.length,
            archivedAt: null,
            createdBy: 'me',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setName('');
      setDescription('');
      setReadOnly(false);
      setMinRole('member');
      setCreateOpen(false);
      onToast?.({ title: 'Salon créé ✓', subtitle: `#${clean}` });
    } catch {
      onToast?.({ title: 'Impossible de créer le salon' });
    } finally {
      setCreating(false);
    }
  };

  const patchChannel = async (
    channelId: string,
    patch: {
      readOnlyForMembers?: boolean;
      minRole?: ClubRole;
      position?: number;
      archived?: boolean;
    },
  ) => {
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(channelId) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, ...patch }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Modification refusée' });
        return;
      }
    }
    setChannels((prev) =>
      prev
        .map((c) => {
          if (c.id !== channelId) return c;
          return {
            ...c,
            ...(patch.readOnlyForMembers !== undefined
              ? { readOnlyForMembers: patch.readOnlyForMembers }
              : {}),
            ...(patch.minRole !== undefined ? { minRole: patch.minRole } : {}),
            ...(patch.position !== undefined ? { position: patch.position } : {}),
            ...(patch.archived !== undefined
              ? { archivedAt: patch.archived ? new Date().toISOString() : null }
              : {}),
          };
        })
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    );
  };

  const moveChannel = async (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= activeChannels.length) return;
    const current = activeChannels[idx];
    const neighbor = activeChannels[targetIdx];
    const nextPosCurrent = targetIdx;
    const nextPosNeighbor = idx;

    setChannels((prev) =>
      prev
        .map((c) => {
          if (c.id === current.id) return { ...c, position: nextPosCurrent };
          if (c.id === neighbor.id) return { ...c, position: nextPosNeighbor };
          return c;
        })
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    );

    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const updates: Promise<Response>[] = [];
      if (UUID_RE.test(current.id)) {
        updates.push(
          fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: current.id, position: nextPosCurrent }),
          }),
        );
      }
      if (UUID_RE.test(neighbor.id)) {
        updates.push(
          fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: neighbor.id, position: nextPosNeighbor }),
          }),
        );
      }
      if (updates.length > 0) {
        const results = await Promise.all(updates);
        if (results.some((r) => !r.ok)) {
          onToast?.({ title: 'Réorganisation refusée' });
        }
      }
    }
  };

  const deleteChannel = async (channelId: string) => {
    if (!canArchive) return;
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(channelId) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Suppression refusée' });
        return;
      }
    }
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    onToast?.({ title: 'Salon supprimé' });
  };

  const activeChannels = channels.filter((c) => !c.archivedAt);
  const archivedChannels = channels.filter((c) => Boolean(c.archivedAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canCreate ? (
        <AdminCollapsibleCreate
          label="Nouveau salon"
          open={createOpen}
          onToggle={setCreateOpen}
        >
          <form onSubmit={handleCreate} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Nom (ex : bureau-admin, covoit-alpes…)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={60}
              required
            />
            <input
              type="text"
              className="club-glass-input"
              placeholder="Description courte (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <AdminGlassSelect
                ariaLabel="Type de salon"
                value={kind}
                onChange={(v) => setKind(v as ClubChannelKind)}
                options={[
                  { value: 'custom', label: 'Thématique' },
                  { value: 'general', label: 'Général' },
                  { value: 'announcements', label: 'Annonces' },
                  { value: 'events', label: 'Sorties' },
                ]}
              />
              <AdminGlassSelect
                ariaLabel="Rôle minimum requis"
                value={minRole}
                onChange={(v) => setMinRole(v as ClubRole)}
                options={MIN_ROLE_OPTIONS.map((r) => ({
                  value: r,
                  label: `${CLUB_ROLE_LABELS[r]}+`,
                }))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--label2)' }}>Lecture seule membres</span>
              <Switch checked={readOnly} onCheckedChange={setReadOnly} aria-label="Lecture seule pour les membres" />
            </div>
            <button
              type="submit"
              disabled={creating || name.trim().length < 2}
              className="lkdv-carnet-btn-soft"
              style={{
                justifyContent: 'center',
                height: 34,
                background: 'var(--club-soft-bg, #d3ebd9)',
                color: 'var(--tint, #17402c)',
                fontWeight: 700,
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{creating ? 'Création…' : 'Créer le salon'}</span>
            </button>
          </form>
        </AdminCollapsibleCreate>
      ) : null}

      <SegmentedControl
        size="sm"
        showLabels
        ariaLabel="Filtrer les salons"
        value={tab}
        onChange={(id) => setTab(id as 'active' | 'archived')}
        items={[
          { id: 'active', label: `Actifs (${activeChannels.length})` },
          { id: 'archived', label: `Archivés (${archivedChannels.length})` },
        ]}
      />

      {tab === 'active' ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
          ) : activeChannels.length === 0 ? (
            <ClubEmptyCard
              icon={<Hash size={17} />}
              title="Aucun salon actif"
              description="Créez votre premier salon pour organiser les discussions."
            />
          ) : (
            activeChannels.map((ch, idx) => (
              <div
                key={ch.id}
                style={{
                  padding: '7px 9px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.62)',
                  border: '0.5px solid rgba(23, 43, 36, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span style={{ color: 'var(--tint, #17402c)', flex: 'none', display: 'inline-flex' }}>
                    {ch.kind === 'announcements' ? (
                      <Megaphone size={13} aria-hidden="true" />
                    ) : ch.kind === 'events' ? (
                      <Calendar size={13} aria-hidden="true" />
                    ) : (
                      <Hash size={13} aria-hidden="true" />
                    )}
                  </span>
                  <b style={{ fontSize: 12.5, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.name}
                  </b>
                  {ch.readOnlyForMembers ? (
                    <Lock size={11} color="#92400e" aria-label="Lecture seule" style={{ flex: 'none' }} />
                  ) : null}
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                  {canEdit ? (
                    <>
                      <AdminGlassSelect
                        compact
                        ariaLabel={`Rôle minimum pour ${ch.name}`}
                        value={ch.minRole ?? 'member'}
                        onChange={(v) => void patchChannel(ch.id, { minRole: v as ClubRole })}
                        options={MIN_ROLE_OPTIONS.map((r) => ({
                          value: r,
                          label: `${CLUB_ROLE_LABELS[r]}+`,
                        }))}
                        style={{ width: 'auto', minWidth: 94 }}
                      />
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{
                          height: 28,
                          width: 28,
                          padding: 0,
                          justifyContent: 'center',
                          background: ch.readOnlyForMembers ? 'var(--club-warn-bg, #fbf1dc)' : undefined,
                          color: ch.readOnlyForMembers ? '#92400e' : 'var(--label2)',
                        }}
                        aria-label={ch.readOnlyForMembers ? `Ouvrir écriture ${ch.name}` : `Verrouiller ${ch.name}`}
                        title={ch.readOnlyForMembers ? 'Ouvrir écriture' : 'Lecture seule'}
                        onClick={() => void patchChannel(ch.id, { readOnlyForMembers: !ch.readOnlyForMembers })}
                      >
                        {ch.readOnlyForMembers ? <Unlock size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                      </button>
                      {idx > 0 ? (
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, width: 26, padding: 0, justifyContent: 'center' }}
                          aria-label={`Monter ${ch.name}`}
                          title="Monter"
                          onClick={() => void moveChannel(idx, -1)}
                        >
                          <ArrowUp size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                      {idx < activeChannels.length - 1 ? (
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, width: 26, padding: 0, justifyContent: 'center' }}
                          aria-label={`Descendre ${ch.name}`}
                          title="Descendre"
                          onClick={() => void moveChannel(idx, 1)}
                        >
                          <ArrowDown size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {canArchive ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, width: 28, padding: 0, justifyContent: 'center', color: 'var(--label2)' }}
                      aria-label={`Archiver ${ch.name}`}
                      title="Archiver"
                      onClick={() => void patchChannel(ch.id, { archived: true })}
                    >
                      <Archive size={12} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
          {archivedChannels.length === 0 ? (
            <ClubEmptyCard
              icon={<Archive size={17} />}
              title="Aucun salon archivé"
              description="Les salons archivés restent consultables ici."
            />
          ) : (
            archivedChannels.map((ch) => (
              <div
                key={ch.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.52)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--label2)' }}>#{ch.name}</span>
                {canArchive ? (
                  <div style={{ display: 'inline-flex', gap: 5 }}>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--tint, #17402c)' }}
                      onClick={() => void patchChannel(ch.id, { archived: false })}
                    >
                      <RotateCcw size={11} aria-hidden="true" />
                      <span>Restaurer</span>
                    </button>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 26, width: 26, padding: 0, justifyContent: 'center', color: '#991b1b', background: 'var(--club-danger-bg, #f5ddd9)' }}
                      aria-label={`Supprimer ${ch.name}`}
                      title="Supprimer"
                      onClick={() => void deleteChannel(ch.id)}
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
