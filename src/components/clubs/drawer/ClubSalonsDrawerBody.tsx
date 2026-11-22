'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Flag,
  Hash,
  Layers,
  Lock,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
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

function channelIcon(kind: ClubChannelKind) {
  if (kind === 'announcements') return <Megaphone size={13} aria-hidden="true" />;
  if (kind === 'events') return <Calendar size={13} aria-hidden="true" />;
  return <Hash size={13} aria-hidden="true" />;
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
  const cacheKeyBase = activeClub.id;
  const cachedInit = salonsCache.get(cacheKeyBase);

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelKind, setNewChannelKind] = useState<ClubChannelKind>('custom');
  const [newChannelReadOnly, setNewChannelReadOnly] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

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
      const author = memberByUserId.get(m.authorId);
      return (
        m.body.toLowerCase().includes(q) ||
        (author?.name || '').toLowerCase().includes(q)
      );
    });
  }, [messages, searchQuery, memberByUserId]);

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
      setShowCreateForm(false);
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
      onToast?.({
        title: moderation === 'delete' ? 'Message supprimé' : 'Message masqué',
      });
    } catch {
      onToast?.({ title: 'Impossible de modérer ce message' });
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
  // Lens 1: Gestion & liste des canaux
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
              {(['general', 'announcements', 'events', 'custom'] as ClubChannelKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`club-filter-pill ${newChannelKind === k ? 'is-active' : ''}`}
                  onClick={() => setNewChannelKind(k)}
                >
                  <span className="club-filter-pill-label">
                    {channelIcon(k)}
                    <span>{channelKindLabel(k)}</span>
                  </span>
                </button>
              ))}
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
            description="Les salons de discussion du club apparaîtront ici dès que tu rejoins la cordée."
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
  // Lens 0: Discussions en direct
  // ============================================================================
  return (
    <div
      className="club-drawer-pane-content"
      data-testid="club-salons-chat-pane"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}
    >
      {/* Barre supérieure : sélecteur de canaux + recherche + rafraîchir */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          className="club-filter-rail"
          data-hscroll="true"
          style={{ flex: 1, minWidth: 0 }}
          role="tablist"
          aria-label="Canaux du club"
        >
          {channels.map((ch) => {
            const selected = ch.id === activeChannel?.id;
            return (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`club-filter-pill ${selected ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveChannelId(ch.id);
                  setSelectedMsgId(null);
                }}
              >
                <span className="club-filter-pill-label">
                  {channelIcon(ch.kind)}
                  <span>{ch.name}</span>
                  {ch.readOnlyForMembers ? <Lock size={10} aria-hidden="true" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="reseau-btn club-icon-pill"
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

        {canManageChannels ? (
          <button
            type="button"
            className={`reseau-btn ${showCreateForm ? 'primary' : ''} club-icon-pill`}
            aria-label="Nouveau salon"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {searchOpen ? (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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

      {showCreateForm && canManageChannels ? (
        <form onSubmit={handleCreateChannel} className="club-glass-card" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            className="club-glass-input"
            placeholder="Nom du nouveau salon…"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            minLength={2}
            required
          />
          <button
            type="submit"
            disabled={creatingChannel || newChannelName.trim().length < 2}
            className="lkdv-carnet-btn-primary"
            style={{ height: 32, padding: '0 12px', borderRadius: 999, flex: 'none' }}
          >
            Créer
          </button>
        </form>
      ) : null}

      {/* Fil de discussion */}
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
        <div className="club-glass-card" style={{ textAlign: 'center', padding: 24, color: 'var(--label2)', fontSize: 12.5 }}>
          Chargement des messages…
        </div>
      ) : visibleMessages.length === 0 ? (
        <ClubEmptyCard
          icon={<MessageCircle size={22} />}
          title={searchQuery ? 'Aucun message trouvé' : `Bienvenue dans #${activeChannel?.name || 'Général'}`}
          description={
            searchQuery
              ? 'Essayez un autre mot-clé.'
              : 'Lance la conversation avec les membres du club : conditions terrain, covoiturage ou idées de sorties.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto' }}>
          {visibleMessages.map((msg, idx) => {
            const isMine = Boolean(currentUserId && msg.authorId === currentUserId);
            const author = memberByUserId.get(msg.authorId);
            const authorName = author?.name || (isMine ? 'Vous' : 'Membre du club');
            const prev = idx > 0 ? visibleMessages[idx - 1] : null;
            const isGrouped = Boolean(prev && prev.authorId === msg.authorId);
            const showActions = selectedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                }}
              >
                {!isMine ? (
                  <div style={{ width: 28, flex: 'none' }}>
                    {!isGrouped ? (
                      author?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={author.avatarUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'rgba(23, 64, 44, 0.12)',
                            color: '#17402c',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {authorName.slice(0, 1).toUpperCase()}
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <div
                  onClick={() => setSelectedMsgId((cur) => (cur === msg.id ? null : msg.id))}
                  style={{
                    maxWidth: '80%',
                    padding: '9px 12px',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine ? '#17402c' : 'rgba(255, 255, 255, 0.88)',
                    color: isMine ? '#ffffff' : '#172b24',
                    boxShadow: isMine
                      ? '0 4px 12px rgba(23, 64, 44, 0.2)'
                      : 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.12), 0 2px 8px rgba(23, 43, 36, 0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {!isMine && !isGrouped ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <b style={{ fontSize: 11.5 }}>{authorName}</b>
                      {author?.role && author.role !== 'Membre actif' ? (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: 'rgba(23, 64, 44, 0.1)',
                            color: '#17402c',
                          }}
                        >
                          {author.role}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {msg.body}
                  </p>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      opacity: isMine ? 0.72 : 0.55,
                      textAlign: 'right',
                    }}
                  >
                    {formatMsgTime(msg.createdAt)}
                  </div>

                  {showActions && !msg.id.startsWith('temp-') ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: isMine
                          ? '1px solid rgba(255,255,255,0.18)'
                          : '1px solid rgba(23,64,44,0.1)',
                      }}
                    >
                      {!isMine ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReport(msg);
                          }}
                          style={{
                            background: 'none',
                            border: 0,
                            color: 'inherit',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
                            opacity: 0.85,
                          }}
                        >
                          <Flag size={11} />
                          <span>Signaler</span>
                        </button>
                      ) : null}
                      {canManageChannels || isMine ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleModerate(msg, 'delete');
                          }}
                          style={{
                            background: 'none',
                            border: 0,
                            color: isMine ? '#fecaca' : '#b91c1c',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
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
          })}
          <div ref={endRef} />
        </div>
      )}

      {/* Compositeur sticky en bas du salon */}
      {!error ? (
        canPost && activeChannel ? (
          <form
            onSubmit={handleSendMessage}
            style={{
              position: 'sticky',
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.92)',
              boxShadow: 'inset 0 0 0 1px rgba(23, 64, 44, 0.14), 0 8px 20px rgba(16, 32, 25, 0.1)',
              backdropFilter: 'blur(16px)',
              marginTop: 'auto',
            }}
          >
            <input
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
                paddingLeft: 6,
              }}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Envoyer le message"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 0,
                background: draft.trim() ? '#17402c' : 'rgba(23, 64, 44, 0.14)',
                color: draft.trim() ? '#ffffff' : '#56665d',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                cursor: draft.trim() ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Send size={15} aria-hidden="true" />
            </button>
          </form>
        ) : activeChannel?.readOnlyForMembers ? (
          <div
            className="club-glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--label2)',
              padding: '8px 12px',
            }}
          >
            <Lock size={13} aria-hidden="true" />
            <span>Salon d’annonces réservé aux encadrants.</span>
          </div>
        ) : null
      ) : null}
    </div>
  );
}

export default ClubSalonsDrawerBody;
