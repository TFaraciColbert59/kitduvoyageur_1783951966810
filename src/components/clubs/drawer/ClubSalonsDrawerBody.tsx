'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerUpLeft,
  Flag,
  Hash,
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
import type { ClubItemData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
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
const QUICK_REACTIONS = ['🏔️', '👍', '🔥', '❤️'] as const;

export interface ClubSalonsDrawerBodyProps {
  activeSubTab?: number;
  active: boolean;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  currentUserId: string | null;
  onSwitchSubTab?: (subIndex: number) => void;
  onToggleJoinClub?: (clubId: string) => Promise<boolean | void> | void;
  onToast?: (payload: ClubToastPayload) => void;
}

function channelIcon(kind: ClubChannelKind, size = 15) {
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

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const todayKey = now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === todayKey) return "Aujourd'hui";
  if (d.toDateString() === yest.toDateString()) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
}

function parseReplyPrefix(body: string): { replyTo?: string; quote?: string; text: string } {
  const match = body.match(/^>\s*([^:\n]+):\s*([^\n]+)\n([\s\S]*)$/);
  if (!match) return { text: body };
  return {
    replyTo: match[1].trim(),
    quote: match[2].trim(),
    text: match[3].trim(),
  };
}

function roleBadgeStyle(role?: string): React.CSSProperties {
  if (role === 'Fondateur') {
    return { background: '#17402c', color: '#ffffff' };
  }
  if (role === 'Guide & Sécurité') {
    return { background: 'rgba(23, 64, 44, 0.14)', color: '#17402c' };
  }
  if (role === 'Encadrant') {
    return { background: 'rgba(91, 127, 85, 0.18)', color: '#24482a' };
  }
  return { background: 'rgba(23, 43, 36, 0.08)', color: '#56665d' };
}

export function ClubSalonsDrawerBody({
  active,
  activeClub,
  members,
  currentUserId,
  onToggleJoinClub,
  onToast,
}: ClubSalonsDrawerBodyProps) {
  const cachedInit = salonsCache.get(activeClub.id);

  const [view, setView] = useState<'chat' | 'channels'>('chat');
  const [channels, setChannels] = useState<ClubChannel[]>(cachedInit?.channels ?? []);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    cachedInit?.activeChannelId ?? null,
  );
  const [messages, setMessages] = useState<ClubChannelMessage[]>(cachedInit?.messages ?? []);
  const [canPost, setCanPost] = useState<boolean>(cachedInit?.canPost ?? true);
  const [loading, setLoading] = useState<boolean>(!cachedInit);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ author: string; excerpt: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Record<string, number>>>({});

  // Create channel state (in Discord channel list view)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelKind, setNewChannelKind] = useState<ClubChannelKind>('custom');
  const [newChannelReadOnly, setNewChannelReadOnly] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ClubMemberData>();
    for (const m of members) {
      if (m.userId) map.set(m.userId, m);
      if (m.id) map.set(m.id, m);
    }
    return map;
  }, [members]);

  const resolveAuthor = useCallback(
    (authorId: string) => {
      const m = memberByUserId.get(authorId);
      const rawName = m?.name?.trim();
      const isMine = Boolean(currentUserId && authorId === currentUserId);
      const name =
        rawName && rawName !== 'Membre LKDV'
          ? rawName
          : m?.role === 'Fondateur'
            ? 'Alexandre Dumas'
            : m?.handle
              ? m.handle
              : isMine
                ? 'Vous'
                : m?.role || 'Membre';
      return {
        name,
        avatarUrl: m?.avatarUrl,
        role: m?.role,
        isMine,
      };
    },
    [currentUserId, memberByUserId],
  );

  const currentMember = useMemo(
    () => (currentUserId ? memberByUserId.get(currentUserId) ?? null : null),
    [currentUserId, memberByUserId],
  );

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

      if (force) setRefreshing(true);
      else if (!hit) setLoading(true);
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
        setRefreshing(false);
      }
    },
    [activeClub.id],
  );

  useEffect(() => {
    if (!active) return;
    void loadChannel(activeChannelId);
  }, [active, activeChannelId, loadChannel]);

  useEffect(() => {
    if (active && view === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [active, view, messages.length, activeChannelId]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedMsgId) {
        setSelectedMsgId(null);
      } else if (searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      } else if (showCreateForm) {
        setShowCreateForm(false);
      } else if (view === 'channels') {
        setView('chat');
      } else if (replyingTo) {
        setReplyingTo(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, replyingTo, searchOpen, selectedMsgId, showCreateForm, view]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0] ?? null,
    [channels, activeChannelId],
  );

  const infoChannels = useMemo(
    () => channels.filter((c) => c.kind === 'announcements' || c.readOnlyForMembers),
    [channels],
  );
  const discussionChannels = useMemo(
    () => channels.filter((c) => c.kind !== 'announcements' && !c.readOnlyForMembers),
    [channels],
  );

  const visibleMessages = useMemo(() => {
    const clean = messages.filter((m) => !m.deletedAt && !m.hiddenByModeratorId);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clean;
    return clean.filter((m) => {
      const author = resolveAuthor(m.authorId);
      return m.body.toLowerCase().includes(q) || author.name.toLowerCase().includes(q);
    });
  }, [messages, searchQuery, resolveAuthor]);

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setReactionsByMsg((prev) => {
      const msgMap = { ...(prev[msgId] || {}) };
      if (msgMap[emoji]) delete msgMap[emoji];
      else msgMap[emoji] = 1;
      return { ...prev, [msgId]: msgMap };
    });
    setSelectedMsgId(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawText = draft.trim();
    if (!rawText || !activeChannel || sending || !canPost) return;

    const finalBody = replyingTo
      ? `> ${replyingTo.author}: ${replyingTo.excerpt}\n${rawText}`
      : rawText;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ClubChannelMessage = {
      id: tempId,
      channelId: activeChannel.id,
      clubId: activeClub.id,
      authorId: currentUserId || 'me',
      body: finalBody,
      createdAt: new Date().toISOString(),
    };

    setDraft('');
    setReplyingTo(null);
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
          body: finalBody,
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
      setDraft(rawText);
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
      setNewChannelReadOnly(false);
      setShowCreateForm(false);
      setChannels((prev) => [...prev, payload.data!]);
      setActiveChannelId(payload.data.id);
      salonsCache.clear();
      setView('chat');
      onToast?.({ title: 'Salon créé ✓', subtitle: `#${payload.data.name}` });
    } catch (err) {
      onToast?.({
        title: 'Erreur',
        subtitle: err instanceof Error ? err.message : 'Création refusée.',
      });
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleDeleteMessage = async (msg: ClubChannelMessage) => {
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'moderate',
          messageId: msg.id,
          moderation: 'delete',
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

  const handleReportMessage = async (msg: ClubChannelMessage) => {
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/salons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          messageId: msg.id,
          reason: 'Signalé depuis le salon du club',
        }),
      });
      if (!res.ok) throw new Error('Refusé');
      setSelectedMsgId(null);
      onToast?.({ title: 'Message signalé aux encadrants ✓' });
    } catch {
      onToast?.({ title: 'Impossible de signaler ce message' });
    }
  };

  const renderChannelRow = (ch: ClubChannel) => {
    const isCurrent = ch.id === (activeChannel?.id ?? null);
    return (
      <button
        key={ch.id}
        type="button"
        onClick={() => {
          setActiveChannelId(ch.id);
          setSelectedMsgId(null);
          setSearchQuery('');
          setSearchOpen(false);
          setView('chat');
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 14,
          border: 0,
          background: isCurrent ? 'rgba(23, 64, 44, 0.1)' : 'rgba(255, 255, 255, 0.65)',
          color: isCurrent ? '#17402c' : '#172b24',
          textAlign: 'left',
          cursor: 'pointer',
          boxShadow: isCurrent
            ? 'inset 3px 0 0 #17402c, inset 0 0 0 0.5px rgba(23, 64, 44, 0.16)'
            : 'inset 0 0 0 0.5px rgba(23, 43, 36, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ opacity: isCurrent ? 1 : 0.65, display: 'inline-flex', flex: 'none' }}>
            {channelIcon(ch.kind, 16)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: isCurrent ? 700 : 600,
                fontSize: 13.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ch.name}
            </div>
            <div style={{ fontSize: 11, color: '#56665d' }}>
              {channelKindLabel(ch.kind)}
              {ch.readOnlyForMembers ? ' · Lecture seule' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', color: '#56665d' }}>
          {ch.readOnlyForMembers ? <Lock size={13} aria-hidden="true" /> : null}
          <ChevronRight size={15} aria-hidden="true" />
        </div>
      </button>
    );
  };

  return (
    <div
      data-testid="club-salons-discord"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: '0 2px',
      }}
    >
      {/* =====================================================================
          1. BARRE SUPÉRIEURE FIXE (STYLE DISCORD)
         ===================================================================== */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 2px 10px',
          borderBottom: '1px solid rgba(23, 64, 44, 0.09)',
        }}
      >
        {view === 'channels' ? (
          <button
            type="button"
            onClick={() => setView('chat')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px 0 6px',
              borderRadius: 999,
              border: 0,
              background: 'rgba(23, 64, 44, 0.08)',
              color: '#17402c',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            <span>Retour au salon</span>
          </button>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              fontSize: 13.5,
              color: '#172b24',
              minWidth: 0,
            }}
          >
            {activeChannel ? channelIcon(activeChannel.kind, 15) : <Hash size={15} aria-hidden="true" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeChannel?.name || 'Salons'}
            </span>
          </span>
        )}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          {view === 'chat' ? (
            <>
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
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined}
                />
              </button>
            </>
          ) : canManageChannels ? (
            <button
              type="button"
              className={`reseau-btn ${showCreateForm ? 'primary' : ''} club-icon-pill`}
              aria-label="Créer un salon"
              onClick={() => setShowCreateForm((v) => !v)}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Barre de recherche optionnelle (Mode Chat) */}
      {view === 'chat' && searchOpen ? (
        <div style={{ flex: 'none', padding: '8px 0 4px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: 30, width: '100%' }}
            placeholder={`Rechercher dans #${activeChannel?.name || 'salon'}…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
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

      {/* =====================================================================
          2. CORPS SCROLLABLE (SOIT LISTE DES SALONS DISCORD, SOIT FLUX CHAT)
         ===================================================================== */}
      {view === 'channels' ? (
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            overflowY: 'auto',
            padding: '10px 0 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {showCreateForm && canManageChannels ? (
            <form
              onSubmit={handleCreateChannel}
              className="club-glass-card"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#17402c' }}>
                Nouveau salon textuel
              </div>
              <input
                type="text"
                className="club-glass-input"
                placeholder="Ex : alpinisme, covoit-lyon, bivouac…"
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
                        {channelIcon(k, 12)}
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
                <span>Salon d’annonces (lecture seule pour les membres)</span>
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

          {infoChannels.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: '#56665d', paddingLeft: 4 }}>
                INFORMATIONS ({infoChannels.length})
              </div>
              {infoChannels.map(renderChannelRow)}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: '#56665d', paddingLeft: 4 }}>
              SALONS TEXTUELS ({discussionChannels.length})
            </div>
            {discussionChannels.length > 0 ? (
              discussionChannels.map(renderChannelRow)
            ) : (
              <ClubEmptyCard
                icon={<Hash size={20} />}
                title="Aucun salon disponible"
                description="Les salons de discussion de la cordée apparaîtront ici."
              />
            )}
          </div>

          {canManageChannels && !showCreateForm ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ width: '100%', justifyContent: 'center', height: 36 }}
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={14} aria-hidden="true" />
              <span>Créer un salon</span>
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* FLUX DE MESSAGES (STYLE DISCORD — PLEINE LARGEUR, SCROLL PROPRE) */}
          <div
            ref={scrollRef}
            style={{
              flex: '1 1 0',
              minHeight: 0,
              overflowY: 'auto',
              padding: '10px 2px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
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
              <div style={{ textAlign: 'center', padding: 28, color: '#56665d', fontSize: 12.5 }}>
                Chargement de #{activeChannel?.name || 'salon'}…
              </div>
            ) : (
              <>
                {visibleMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 8px', fontSize: 12.5, color: '#56665d' }}>
                    {searchQuery
                      ? 'Aucun message ne correspond à ta recherche.'
                      : 'Aucun message pour l’instant. Envoie le premier !'}
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => {
                    const author = resolveAuthor(msg.authorId);
                    const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                    const dayLabel = formatDayLabel(msg.createdAt);
                    const prevDayLabel = prev ? formatDayLabel(prev.createdAt) : null;
                    const showDaySep = dayLabel && dayLabel !== prevDayLabel;

                    const prevMs = prev ? Date.parse(prev.createdAt) : 0;
                    const curMs = Date.parse(msg.createdAt);
                    const isGrouped =
                      !showDaySep &&
                      Boolean(prev && prev.authorId === msg.authorId && Math.abs(curMs - prevMs) < 5 * 60_000);

                    const parsed = parseReplyPrefix(msg.body);
                    const isSelected = selectedMsgId === msg.id;
                    const reactions = reactionsByMsg[msg.id] || {};
                    const reactionEntries = Object.entries(reactions);

                    return (
                      <React.Fragment key={msg.id}>
                        {showDaySep ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              margin: '10px 4px 6px',
                            }}
                          >
                            <span style={{ flex: 1, height: 1, background: 'rgba(23, 64, 44, 0.09)' }} />
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665d' }}>
                              {dayLabel}
                            </span>
                            <span style={{ flex: 1, height: 1, background: 'rgba(23, 64, 44, 0.09)' }} />
                          </div>
                        ) : null}

                        <div
                          onClick={() => setSelectedMsgId((cur) => (cur === msg.id ? null : msg.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: isGrouped ? '2px 6px' : '7px 6px 4px',
                            marginTop: isGrouped ? 0 : 4,
                            borderRadius: 12,
                            background: isSelected ? 'rgba(23, 64, 44, 0.06)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background-color 0.12s ease',
                          }}
                        >
                          {/* Avatar colonne gauche (36px fixe, style Discord) */}
                          <div style={{ width: 34, flex: 'none', paddingTop: isGrouped ? 0 : 1 }}>
                            {!isGrouped ? (
                              author.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={author.avatarUrl}
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
                                    background: 'rgba(23, 64, 44, 0.13)',
                                    color: '#17402c',
                                    fontSize: 13,
                                    fontWeight: 800,
                                    display: 'grid',
                                    placeItems: 'center',
                                  }}
                                >
                                  {author.name.slice(0, 1).toUpperCase()}
                                </div>
                              )
                            ) : (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 9.5,
                                  color: '#76877e',
                                  textAlign: 'right',
                                  opacity: isSelected ? 0.9 : 0,
                                  paddingTop: 3,
                                }}
                              >
                                {formatMsgTime(msg.createdAt)}
                              </span>
                            )}
                          </div>

                          {/* Contenu message colonne droite */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {parsed.replyTo ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontSize: 11,
                                  color: '#56665d',
                                  marginBottom: 3,
                                  paddingLeft: 6,
                                  borderLeft: '2px solid rgba(23, 64, 44, 0.3)',
                                }}
                              >
                                <CornerUpLeft size={11} aria-hidden="true" style={{ flex: 'none' }} />
                                <b style={{ flex: 'none', color: '#17402c' }}>{parsed.replyTo}</b>
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {parsed.quote}
                                </span>
                              </div>
                            ) : null}

                            {!isGrouped ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                  marginBottom: 2,
                                }}
                              >
                                <b style={{ fontSize: 13.5, color: author.isMine ? '#17402c' : '#172b24' }}>
                                  {author.name}
                                </b>
                                {author.role && author.role !== 'Membre actif' ? (
                                  <span
                                    style={{
                                      ...roleBadgeStyle(author.role),
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    {author.role}
                                  </span>
                                ) : null}
                                <span style={{ fontSize: 10.5, color: '#6b7d73' }}>
                                  {formatMsgTime(msg.createdAt)}
                                </span>
                              </div>
                            ) : null}

                            <p
                              style={{
                                margin: 0,
                                fontSize: 13.5,
                                lineHeight: 1.42,
                                color: '#172b24',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {parsed.text}
                            </p>

                            {reactionEntries.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                {reactionEntries.map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleReaction(msg.id, emoji);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 7px',
                                      borderRadius: 999,
                                      border: '1px solid rgba(23, 64, 44, 0.2)',
                                      background: 'rgba(23, 64, 44, 0.08)',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      color: '#17402c',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>{emoji}</span>
                                    <span>{count}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {/* Barre d'actions Discord au tap */}
                            {isSelected && !msg.id.startsWith('temp-') ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 4,
                                  marginTop: 6,
                                  padding: '4px 6px',
                                  borderRadius: 12,
                                  background: 'rgba(255, 255, 255, 0.92)',
                                  boxShadow: '0 4px 12px rgba(16, 32, 25, 0.1), inset 0 0 0 0.5px rgba(23, 64, 44, 0.12)',
                                }}
                              >
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: 999,
                                      border: 0,
                                      background: 'transparent',
                                      fontSize: 13.5,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <span style={{ width: 1, height: 14, background: 'rgba(23, 64, 44, 0.14)', margin: '0 2px' }} />
                                {canPost ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo({
                                        author: author.name,
                                        excerpt: parsed.text.slice(0, 60),
                                      });
                                      setSelectedMsgId(null);
                                      inputRef.current?.focus();
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      height: 26,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      border: 0,
                                      background: 'rgba(23, 64, 44, 0.08)',
                                      color: '#17402c',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <CornerUpLeft size={11} />
                                    <span>Répondre</span>
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(parsed.text).catch(() => {});
                                    setSelectedMsgId(null);
                                    onToast?.({ title: 'Message copié ✓' });
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    height: 26,
                                    padding: '0 8px',
                                    borderRadius: 999,
                                    border: 0,
                                    background: 'transparent',
                                    color: '#172b24',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Copy size={11} />
                                  <span>Copier</span>
                                </button>
                                {!author.isMine ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleReportMessage(msg)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      height: 26,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      border: 0,
                                      background: 'transparent',
                                      color: '#56665d',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Flag size={11} />
                                    <span>Signaler</span>
                                  </button>
                                ) : null}
                                {canManageChannels || author.isMine ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteMessage(msg)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      height: 26,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      border: 0,
                                      background: 'rgba(185, 28, 28, 0.08)',
                                      color: '#b91c1c',
                                      fontSize: 11,
                                      fontWeight: 700,
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
                      </React.Fragment>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* =====================================================================
              3. SÉLECTEUR DE SALONS EN BAS À DROITE (DÉFILEMENT HORIZONTAL) + COMPOSITEUR
             ===================================================================== */}
          {!error ? (
            <div
              style={{
                flex: 'none',
                paddingTop: 8,
                paddingBottom: 2,
                borderTop: '1px solid rgba(23, 64, 44, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {channels.length > 0 ? (
                <div
                  data-hscroll="true"
                  role="tablist"
                  aria-label="Salons du club"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    padding: '2px 0',
                  }}
                >
                  {channels.map((ch) => {
                    const isCur = ch.id === (activeChannel?.id ?? null);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        role="tab"
                        aria-selected={isCur}
                        onClick={() => {
                          setActiveChannelId(ch.id);
                          setSelectedMsgId(null);
                          setSearchQuery('');
                          setSearchOpen(false);
                        }}
                        style={{
                          flex: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 999,
                          border: isCur ? '0.5px solid rgba(255,255,255,0.22)' : '0.5px solid rgba(23, 64, 44, 0.14)',
                          background: isCur ? '#17402c' : 'rgba(255, 255, 255, 0.86)',
                          color: isCur ? '#ffffff' : '#172b24',
                          fontSize: 11.5,
                          fontWeight: isCur ? 700 : 600,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        {channelIcon(ch.kind, 12)}
                        <span>{ch.name}</span>
                      </button>
                    );
                  })}
                  {canManageChannels ? (
                    <button
                      type="button"
                      aria-label="Gérer les salons"
                      onClick={() => setView('channels')}
                      style={{
                        flex: 'none',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '0.5px solid rgba(23, 64, 44, 0.14)',
                        background: 'rgba(255, 255, 255, 0.86)',
                        color: '#17402c',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {replyingTo ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '5px 10px',
                    borderRadius: 12,
                    background: 'rgba(23, 64, 44, 0.07)',
                    fontSize: 11.5,
                    color: '#17402c',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Réponse à <b>{replyingTo.author}</b> · {replyingTo.excerpt}
                  </span>
                  <button
                    type="button"
                    aria-label="Annuler la réponse"
                    onClick={() => setReplyingTo(null)}
                    style={{ background: 'none', border: 0, cursor: 'pointer', color: '#17402c', display: 'grid', placeItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : null}

              {canPost && activeChannel ? (
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 6px 5px 14px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.94)',
                    boxShadow: 'inset 0 0 0 1px rgba(23, 64, 44, 0.14), 0 4px 12px rgba(16, 32, 25, 0.06)',
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
                      background: draft.trim() ? '#17402c' : 'rgba(23, 64, 44, 0.12)',
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#56665d',
                    padding: '8px 12px',
                    borderRadius: 14,
                    background: 'rgba(23, 64, 44, 0.05)',
                  }}
                >
                  <Lock size={13} aria-hidden="true" />
                  <span>Salon d’annonces — lecture seule</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ClubSalonsDrawerBody;
