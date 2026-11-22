'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Flag,
  Hash,
  Layers,
  Lock,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type { ClubChannel, ClubChannelKind, ClubChannelMessage } from '@/features/clubs';
import type { ClubData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
import { ClubEmptyCard } from './ClubSharedUi';

interface CachedSalonData {
  channels: ClubChannel[];
  activeChannelId: string | null;
  messages: ClubChannelMessage[];
  canPost: boolean;
  ts: number;
}

const salonsCache = new Map<string, CachedSalonData>();
const SALONS_TTL_MS = 30_000;

export interface ClubSalonsDrawerBodyProps {
  activeSubTab: number;
  active: boolean;
  activeClub: ClubData;
  members: ClubMemberData[];
  currentUserId: string | null;
  onSwitchSubTab: (subIndex: number) => void;
  onToggleJoinClub?: (clubId: string) => Promise<void> | void;
  onToast?: (payload: ClubToastPayload) => void;
}

function channelIcon(kind: ClubChannelKind, size = 14) {
  if (kind === 'announcements') return <Megaphone size={size} aria-hidden="true" />;
  if (kind === 'events') return <Calendar size={size} aria-hidden="true" />;
  return <Hash size={size} aria-hidden="true" />;
}

function channelKindLabel(kind: ClubChannelKind): string {
  switch (kind) {
    case 'announcements':
      return 'Annonces';
    case 'events':
      return 'Sorties';
    case 'custom':
      return 'Thématique';
    default:
      return 'Général';
  }
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function resolveAuthorDisplay(
  authorId: string,
  memberByUserId: Map<string, ClubMemberData>,
  currentUserId: string | null,
) {
  const author = memberByUserId.get(authorId);
  const rawName = author?.name?.trim();
  const isMine = Boolean(currentUserId && authorId === currentUserId);
  const name =
    rawName && rawName !== 'Membre LKDV'
      ? rawName
      : author?.role === 'Fondateur'
        ? 'Alexandre Dumas'
        : author?.handle || (isMine ? 'Vous' : author?.role || 'Membre du club');
  return {
    name,
    role: author?.role,
    avatarUrl: author?.avatarUrl,
    isMine,
  };
}

export function ClubSalonsDrawerBody({
  activeSubTab,
  active,
  activeClub,
  members,
  currentUserId,
  onSwitchSubTab,
  onToggleJoinClub,
  onToast,
}: ClubSalonsDrawerBodyProps) {
  const cachedInit = salonsCache.get(activeClub.id);

  const [channels, setChannels] = useState<ClubChannel[]>(cachedInit?.channels ?? []);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    cachedInit?.activeChannelId ?? null,
  );
  const [messages, setMessages] = useState<ClubChannelMessage[]>(cachedInit?.messages ?? []);
  const [canPost, setCanPost] = useState<boolean>(cachedInit?.canPost ?? true);
  const [loading, setLoading] = useState<boolean>(!cachedInit);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelKind, setNewChannelKind] = useState<ClubChannelKind>('custom');
  const [newChannelReadOnly, setNewChannelReadOnly] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ClubMemberData>();
    for (const m of members) {
      if (m.userId) map.set(m.userId, m);
      if (m.id) map.set(m.id, m);
    }
    return map;
  }, [members]);

  const currentMember = useMemo(() => {
    if (!currentUserId) return null;
    return memberByUserId.get(currentUserId) ?? null;
  }, [currentUserId, memberByUserId]);

  const canManageChannels = useMemo(() => {
    if (activeClub.role === 'Admin' || activeClub.role === 'Modérateur') return true;
    const r = currentMember?.rawRole;
    return r === 'admin' || r === 'moderator';
  }, [activeClub.role, currentMember]);

  const loadChannel = useCallback(
    async (channelId?: string | null, force = false) => {
      if (typeof fetch !== 'function' || !activeClub.id) return;
      const key = `${activeClub.id}:${channelId ?? 'default'}`;
      const hit = salonsCache.get(key);
      if (!force && hit && Date.now() - hit.ts < SALONS_TTL_MS) {
        setChannels(hit.channels);
        setActiveChannelId(hit.activeChannelId);
        setMessages(hit.messages);
        setCanPost(hit.canPost);
        setLoading(false);
        return;
      }

      if (!hit) setLoading(true);
      setError(null);
      try {
        const qs = channelId ? `?channelId=${encodeURIComponent(channelId)}` : '';
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons${qs}`, {
          credentials: 'include',
        });
        const payload = (await res.json().catch(() => null)) as {
          data?: {
            channels: ClubChannel[];
            activeChannelId: string | null;
            messages: ClubChannelMessage[];
            canPost?: boolean;
          };
          error?: string;
          message?: string;
        } | null;

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError('Rejoins ce club pour accéder aux salons de discussion.');
          } else {
            setError(payload?.message || payload?.error || 'Impossible de charger les salons.');
          }
          return;
        }

        const data = payload?.data;
        if (!data) return;
        const entry: CachedSalonData = {
          channels: data.channels ?? [],
          activeChannelId: data.activeChannelId ?? null,
          messages: data.messages ?? [],
          canPost: data.canPost ?? true,
          ts: Date.now(),
        };
        salonsCache.set(key, entry);
        if (!channelId) salonsCache.set(activeClub.id, entry);
        setChannels(entry.channels);
        setActiveChannelId(entry.activeChannelId);
        setMessages(entry.messages);
        setCanPost(entry.canPost);
      } catch {
        setError('Erreur réseau lors du chargement des salons.');
      } finally {
        setLoading(false);
      }
    },
    [activeClub.id],
  );

  useEffect(() => {
    if (!active) return;
    void loadChannel(activeChannelId);
  }, [active, activeChannelId, loadChannel]);

  useEffect(() => {
    if (active && activeSubTab === 0 && messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [active, activeSubTab, messages.length, activeChannelId]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0] ?? null,
    [channels, activeChannelId],
  );

  const visibleMessages = useMemo(() => {
    const clean = messages.filter((m) => !m.deletedAt && !m.hiddenByModeratorId);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clean;
    return clean.filter((m) => {
      const info = resolveAuthorDisplay(m.authorId, memberByUserId, currentUserId);
      return m.body.toLowerCase().includes(q) || info.name.toLowerCase().includes(q);
    });
  }, [messages, searchQuery, memberByUserId, currentUserId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || !activeChannel || sending || !canPost) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ClubChannelMessage = {
      id: tempId,
      channelId: activeChannel.id,
      clubId: activeClub.id,
      authorId: currentUserId || 'me',
      body: text,
      createdAt: new Date().toISOString(),
    };

    setDraft('');
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_message',
          channelId: activeChannel.id,
          body: text,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: ClubChannelMessage;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.message || payload?.error || "Impossible d'envoyer le message.");
      }
      setMessages((prev) => prev.map((m) => (m.id === tempId ? payload.data! : m)));
      salonsCache.delete(`${activeClub.id}:${activeChannel.id}`);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      onToast?.({
        title: 'Envoi impossible',
        subtitle: err instanceof Error ? err.message : 'Vérifiez votre connexion.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newChannelName.trim();
    if (name.length < 2 || creatingChannel) return;
    setCreatingChannel(true);
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_channel',
          name,
          kind: newChannelKind,
          readOnlyForMembers: newChannelReadOnly,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: ClubChannel;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.message || payload?.error || 'Création impossible.');
      }
      setNewChannelName('');
      setChannels((prev) => [...prev, payload.data!]);
      setActiveChannelId(payload.data.id);
      salonsCache.clear();
      onToast?.({
        title: 'Salon créé ✓',
        subtitle: `#${payload.data.name}`,
      });
      onSwitchSubTab(0);
    } catch (err) {
      onToast?.({
        title: 'Erreur',
        subtitle: err instanceof Error ? err.message : 'Création refusée.',
      });
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleModerate = async (msg: ClubChannelMessage, moderation: 'hide' | 'delete') => {
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'moderate',
          messageId: msg.id,
          moderation,
        }),
      });
      if (!res.ok) throw new Error('Action refusée');
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setSelectedMsgId(null);
      salonsCache.delete(`${activeClub.id}:${activeChannelId ?? 'default'}`);
      onToast?.({ title: 'Message supprimé' });
    } catch {
      onToast?.({ title: 'Impossible de supprimer ce message' });
    }
  };

  const handleReport = async (msg: ClubChannelMessage) => {
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          messageId: msg.id,
          reason: 'Signalé par un membre depuis le salon du club',
        }),
      });
      if (!res.ok) throw new Error('Signalement refusé');
      setSelectedMsgId(null);
      onToast?.({ title: 'Message signalé aux encadrants ✓' });
    } catch {
      onToast?.({ title: 'Impossible de signaler ce message' });
    }
  };

  // ============================================================================
  // Lens 1: Canaux & création (style Discord)
  // ============================================================================
  if (activeSubTab === 1) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-salons-channels-pane">
        {canManageChannels ? (
          <form onSubmit={handleCreateChannel} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#17402c' }}>
              Créer un nouveau salon
            </div>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Ex : Alpinisme hivernal, Covoiturage Lyon…"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              minLength={2}
              maxLength={60}
              required
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['general', 'announcements', 'events', 'custom'] as ClubChannelKind[]).map((k) => {
                const isActiveKind = newChannelKind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`club-filter-pill ${isActiveKind ? 'is-active' : ''}`}
                    onClick={() => setNewChannelKind(k)}
                  >
                    {isActiveKind ? <span className="club-filter-pill-bg" /> : null}
                    <span className="club-filter-pill-label">
                      {channelIcon(k, 13)}
                      <span>{channelKindLabel(k)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--label2)' }}>
              <input
                type="checkbox"
                checked={newChannelReadOnly}
                onChange={(e) => setNewChannelReadOnly(e.target.checked)}
              />
              <span>Annonces uniquement (lecture seule pour les membres)</span>
            </label>
            <button
              type="submit"
              disabled={creatingChannel || newChannelName.trim().length < 2}
              className="lkdv-carnet-btn-primary"
              style={{ height: 34, borderRadius: 999, justifyContent: 'center' }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{creatingChannel ? 'Création…' : 'Créer le salon'}</span>
            </button>
          </form>
        ) : null}

        {channels.length === 0 ? (
          <ClubEmptyCard
            icon={<Layers size={22} />}
            title="Aucun salon disponible"
            description="Les salons de discussion du club apparaîtront ici."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {channels.map((ch) => {
              const isCurrent = ch.id === (activeChannel?.id ?? null);
              return (
                <button
                  key={ch.id}
                  type="button"
                  className={`club-glass-card ${isCurrent ? 'is-active-club' : ''}`}
                  style={{
                    width: '100%',
                    border: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                  onClick={() => {
                    setActiveChannelId(ch.id);
                    onSwitchSubTab(0);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        background: isCurrent ? '#17402c' : 'rgba(23, 64, 44, 0.08)',
                        color: isCurrent ? '#ffffff' : '#17402c',
                        display: 'grid',
                        placeItems: 'center',
                        flex: 'none',
                      }}
                    >
                      {channelIcon(ch.kind)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13.5, color: 'var(--label)' }}>
                        {ch.name}
                      </b>
                      <small style={{ fontSize: 11.5, color: 'var(--label2)' }}>
                        {channelKindLabel(ch.kind)}
                        {ch.readOnlyForMembers ? ' · Lecture seule' : ' · Ouvert aux membres'}
                      </small>
                    </div>
                  </div>
                  {ch.readOnlyForMembers ? (
                    <Lock size={14} aria-hidden="true" style={{ color: 'var(--label2)', flex: 'none' }} />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // Lens 0: Chat Discord-like (header fixe, flux scrollable, compositeur fixe en bas)
  // ============================================================================
  return (
    <div
      className="club-drawer-pane-content"
      data-testid="club-salons-chat-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        paddingBottom: 0,
        gap: 8,
      }}
    >
      {/* En-tête Discord-like : sélecteur de salon + recherche + actualiser */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.72)',
          boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.12)',
        }}
      >
        <button
          type="button"
          onClick={() => setChannelMenuOpen((v) => !v)}
          aria-expanded={channelMenuOpen}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 0,
            background: 'transparent',
            padding: '2px 4px',
            cursor: 'pointer',
            color: '#172b24',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: '#17402c',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            {activeChannel ? channelIcon(activeChannel.kind, 13) : <Hash size={13} />}
          </span>
          <b
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeChannel?.name || 'Général'}
          </b>
          {activeChannel?.readOnlyForMembers ? (
            <Lock size={12} aria-hidden="true" style={{ color: '#56665d', flex: 'none' }} />
          ) : null}
          <ChevronDown
            size={14}
            aria-hidden="true"
            style={{
              color: '#56665d',
              flex: 'none',
              transform: channelMenuOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.18s ease',
            }}
          />
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <button
            type="button"
            className={`reseau-btn ${searchOpen ? 'active' : ''} club-icon-pill`}
            aria-label="Rechercher dans le salon"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="reseau-btn club-icon-pill"
            aria-label="Actualiser les messages"
            onClick={() => void loadChannel(activeChannelId, true)}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Menu déroulant des salons (style Discord) */}
      {channelMenuOpen && channels.length > 0 ? (
        <div
          className="club-glass-card"
          role="listbox"
          aria-label="Changer de salon"
          style={{
            flex: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: 8,
            maxHeight: 190,
            overflowY: 'auto',
          }}
        >
          {channels.map((ch) => {
            const selected = ch.id === activeChannel?.id;
            return (
              <button
                key={ch.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setActiveChannelId(ch.id);
                  setChannelMenuOpen(false);
                  setSelectedMsgId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 11,
                  border: 0,
                  background: selected ? '#17402c' : 'transparent',
                  color: selected ? '#ffffff' : '#172b24',
                  fontSize: 13,
                  fontWeight: selected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  {channelIcon(ch.kind, 13)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.name}
                  </span>
                </span>
                <span style={{ fontSize: 10.5, opacity: 0.72, flex: 'none' }}>
                  {channelKindLabel(ch.kind)}
                </span>
              </button>
            );
          })}
          {canManageChannels ? (
            <button
              type="button"
              onClick={() => {
                setChannelMenuOpen(false);
                onSwitchSubTab(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 10px',
                borderRadius: 11,
                border: '1px dashed rgba(23, 64, 44, 0.22)',
                background: 'transparent',
                color: '#17402c',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              <Plus size={13} aria-hidden="true" />
              <span>Créer ou gérer les salons</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {searchOpen ? (
        <div style={{ flex: 'none', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: 30, width: '100%' }}
            placeholder="Filtrer les messages ou un auteur…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer"
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Flux scrollable uniquement */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '4px 2px 8px',
        }}
      >
        {error ? (
          <ClubEmptyCard
            icon={<MessageCircle size={22} />}
            title="Accès au salon"
            description={error}
            actions={
              onToggleJoinClub && !activeClub.joined ? (
                <button
                  type="button"
                  className="lkdv-carnet-btn-primary"
                  onClick={() => void onToggleJoinClub(activeClub.id)}
                >
                  Rejoindre {activeClub.name}
                </button>
              ) : (
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  onClick={() => void loadChannel(activeChannelId, true)}
                >
                  Réessayer
                </button>
              )
            }
          />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--label2)', fontSize: 12.5 }}>
            Chargement des messages…
          </div>
        ) : (
          <>
            {/* Bannière d'accueil du salon façon Discord */}
            {activeChannel && !searchQuery ? (
              <div style={{ padding: '6px 6px 12px', borderBottom: '1px solid rgba(23, 64, 44, 0.08)', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'rgba(23, 64, 44, 0.1)',
                      color: '#17402c',
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {channelIcon(activeChannel.kind, 16)}
                  </span>
                  <div>
                    <b style={{ display: 'block', fontSize: 14, color: '#172b24' }}>
                      Bienvenue dans #{activeChannel.name}
                    </b>
                    <small style={{ fontSize: 11.5, color: '#56665d' }}>
                      {activeChannel.readOnlyForMembers
                        ? 'Salon officiel en lecture seule pour les annonces du club.'
                        : 'C’est le début du salon. Échangez en direct avec la cordée.'}
                    </small>
                  </div>
                </div>
              </div>
            ) : null}

            {visibleMessages.length === 0 ? (
              <p style={{ margin: '12px 6px', fontSize: 12.5, color: 'var(--label2)' }}>
                {searchQuery ? 'Aucun message trouvé.' : 'Aucun message pour le moment.'}
              </p>
            ) : (
              visibleMessages.map((msg, idx) => {
                const info = resolveAuthorDisplay(msg.authorId, memberByUserId, currentUserId);
                const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                const isGrouped = Boolean(prev && prev.authorId === msg.authorId);
                const showActions = selectedMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMsgId((cur) => (cur === msg.id ? null : msg.id))}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: isGrouped ? '2px 8px' : '8px 8px 3px',
                      borderRadius: 12,
                      background: showActions ? 'rgba(23, 64, 44, 0.06)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <div style={{ width: 34, flex: 'none', paddingTop: 1 }}>
                      {!isGrouped ? (
                        info.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={info.avatarUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: info.isMine ? '#17402c' : 'rgba(23, 64, 44, 0.12)',
                              color: info.isMine ? '#ffffff' : '#17402c',
                              fontSize: 12.5,
                              fontWeight: 700,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            {info.name.slice(0, 1).toUpperCase()}
                          </div>
                        )
                      ) : null}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!isGrouped ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <b style={{ fontSize: 13, color: info.isMine ? '#17402c' : '#172b24' }}>
                            {info.name}
                          </b>
                          {info.role && info.role !== 'Membre actif' ? (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 999,
                                background:
                                  info.role === 'Fondateur'
                                    ? '#17402c'
                                    : 'rgba(23, 64, 44, 0.1)',
                                color: info.role === 'Fondateur' ? '#ffffff' : '#17402c',
                              }}
                            >
                              {info.role}
                            </span>
                          ) : null}
                          <span style={{ fontSize: 10.5, color: '#7a8a80' }}>
                            {formatMsgTime(msg.createdAt)}
                          </span>
                        </div>
                      ) : null}

                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.42, color: '#172b24', whiteSpace: 'pre-wrap' }}>
                        {msg.body}
                      </p>

                      {showActions && !msg.id.startsWith('temp-') ? (
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraft((prevDraft) =>
                                prevDraft ? `${prevDraft} @${info.name} ` : `@${info.name} `,
                              );
                              setSelectedMsgId(null);
                              inputRef.current?.focus();
                            }}
                            style={{
                              background: 'none',
                              border: 0,
                              color: '#17402c',
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <Reply size={12} />
                            <span>Mentionner</span>
                          </button>
                          {!info.isMine ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleReport(msg);
                              }}
                              style={{
                                background: 'none',
                                border: 0,
                                color: '#56665d',
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <Flag size={11} />
                              <span>Signaler</span>
                            </button>
                          ) : null}
                          {canManageChannels || info.isMine ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleModerate(msg, 'delete');
                              }}
                              style={{
                                background: 'none',
                                border: 0,
                                color: '#b91c1c',
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <Trash2 size={11} />
                              <span>Supprimer</span>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Compositeur fixe tout en bas (jamais au-dessus des messages) */}
      {!error ? (
        canPost && activeChannel ? (
          <form
            onSubmit={handleSendMessage}
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 6px 5px 12px',
              marginRight: 94,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.96)',
              boxShadow: 'inset 0 0 0 1px rgba(23, 64, 44, 0.14), 0 4px 14px rgba(16, 32, 25, 0.08)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message dans #${activeChannel.name}…`}
              aria-label={`Écrire dans ${activeChannel.name}`}
              maxLength={2000}
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                background: 'transparent',
                fontSize: 13.5,
                color: '#172b24',
                outline: 'none',
                paddingLeft: 4,
              }}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Envoyer le message"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 0,
                background: draft.trim() ? '#17402c' : 'rgba(23, 64, 44, 0.12)',
                color: draft.trim() ? '#ffffff' : '#56665d',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                cursor: draft.trim() ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </form>
        ) : activeChannel?.readOnlyForMembers ? (
          <div
            className="club-glass-card"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--label2)',
              padding: '8px 12px',
              marginRight: 94,
            }}
          >
            <Lock size={13} aria-hidden="true" />
            <span>Lecture seule</span>
          </div>
        ) : null
      ) : null}
    </div>
  );
}

export default ClubSalonsDrawerBody;
