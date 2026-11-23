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
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import {
  CLUB_ROLE_LABELS,
  type ClubChannel,
  type ClubChannelKind,
  type ClubRole,
} from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canCreate ? (
        <form onSubmit={handleCreate} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            Créer un salon (public ou restreint par rôle)
          </div>
          <input
            type="text"
            className="club-glass-input"
            placeholder="Ex : bureau-admin, orga-benevoles, covoit-alpes…"
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
            <select
              className="club-glass-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as ClubChannelKind)}
              aria-label="Type de salon"
            >
              <option value="custom">Thématique</option>
              <option value="general">Général</option>
              <option value="announcements">Annonces</option>
              <option value="events">Sorties</option>
            </select>
            <select
              className="club-glass-input"
              value={minRole}
              onChange={(e) => setMinRole(e.target.value as ClubRole)}
              aria-label="Rôle minimum requis"
            >
              {MIN_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Accès : {CLUB_ROLE_LABELS[r]}+
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>Lecture seule pour les membres</span>
            <Switch checked={readOnly} onCheckedChange={setReadOnly} aria-label="Lecture seule pour les membres" />
          </div>
          <button
            type="submit"
            disabled={creating || name.trim().length < 2}
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
            <span>{creating ? 'Création…' : 'Créer le salon'}</span>
          </button>
        </form>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 12.5, color: '#17402c' }}>Salons actifs ({activeChannels.length})</b>
        </div>
        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
        ) : activeChannels.length === 0 ? (
          <ClubEmptyCard
            icon={<Hash size={18} />}
            title="Aucun salon"
            description="Créez votre premier salon pour organiser les discussions du club."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeChannels.map((ch, idx) => (
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {ch.kind === 'announcements' ? (
                      <Megaphone size={14} aria-hidden="true" />
                    ) : ch.kind === 'events' ? (
                      <Calendar size={14} aria-hidden="true" />
                    ) : (
                      <Hash size={14} aria-hidden="true" />
                    )}
                    <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.name}
                    </b>
                    {ch.readOnlyForMembers ? <Lock size={12} aria-hidden="true" /> : null}
                  </div>
                  <span className="club-badge-sage" style={{ fontSize: 10.5 }}>
                    {CLUB_ROLE_LABELS[ch.minRole ?? 'member']}+
                  </span>
                </div>

                {ch.description ? (
                  <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>{ch.description}</span>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {canEdit ? (
                    <>
                      <select
                        className="club-glass-input"
                        style={{ height: 28, fontSize: 11, padding: '0 8px', width: 'auto' }}
                        value={ch.minRole ?? 'member'}
                        onChange={(e) => void patchChannel(ch.id, { minRole: e.target.value as ClubRole })}
                        aria-label={`Rôle minimum pour ${ch.name}`}
                      >
                        {MIN_ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {CLUB_ROLE_LABELS[r]}+
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                        onClick={() => void patchChannel(ch.id, { readOnlyForMembers: !ch.readOnlyForMembers })}
                      >
                        {ch.readOnlyForMembers ? 'Ouvrir écriture' : 'Lecture seule'}
                      </button>
                      {idx > 0 ? (
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}
                          aria-label={`Monter ${ch.name}`}
                          onClick={() => void patchChannel(ch.id, { position: Math.max(0, (ch.position ?? idx) - 1) })}
                        >
                          <ArrowUp size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                      {idx < activeChannels.length - 1 ? (
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}
                          aria-label={`Descendre ${ch.name}`}
                          onClick={() => void patchChannel(ch.id, { position: (ch.position ?? idx) + 1 })}
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
                      style={{ height: 28, padding: '0 8px', fontSize: 11, marginLeft: 'auto' }}
                      onClick={() => void patchChannel(ch.id, { archived: true })}
                    >
                      <Archive size={12} aria-hidden="true" />
                      <span>Archiver</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {archivedChannels.length > 0 ? (
        <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 12, color: 'var(--label2)' }}>Salons archivés ({archivedChannels.length})</b>
          {archivedChannels.map((ch) => (
            <div
              key={ch.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--label2)' }}>#{ch.name}</span>
              {canArchive ? (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <button
                    type="button"
                    className="lkdv-carnet-btn-soft"
                    style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                    onClick={() => void patchChannel(ch.id, { archived: false })}
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    <span>Restaurer</span>
                  </button>
                  <button
                    type="button"
                    className="lkdv-carnet-btn-soft"
                    style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#b91c1c' }}
                    onClick={() => void deleteChannel(ch.id)}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
