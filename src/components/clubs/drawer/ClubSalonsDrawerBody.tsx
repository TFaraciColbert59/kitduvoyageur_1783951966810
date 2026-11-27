'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Hash,
  Lock,
  Megaphone,
  Menu,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type {
  ClubChannel,
  ClubChannelKind,
  ClubChannelMessage,
  ClubChannelMessageType,
} from '@/features/clubs';
import type {
  KitMessageMeta,
  Message,
  ProductMessageMeta,
  TrailMessageMeta,
} from '@/features/messaging/types/messaging.types';
import { messagingService } from '@/features/messaging/services/messagingService';
import { useResolvedAttachmentUrl } from '@/features/messaging/hooks/useAttachmentUrl';
import { AttachmentDrawer } from '@/features/messaging/components/AttachmentDrawer';
import { TraceMap } from '@/features/messaging/components/TraceMap';
import { resolveTrailCoordinates } from '@/features/messaging/data/realTrailsData';
import { AudioPlayerBubble } from '@/features/messaging/components/AudioPlayerBubble';
import { Icon } from '@/components/ui/Icon';
import '@/components/messaging/messages-grammar.css';
import type { ClubItemData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
import { ClubEmptyCard } from './ClubSharedUi';

const VoiceRecorderBar = dynamic(
  () => import('@/features/messaging/components/VoiceRecorderBar').then((m) => m.VoiceRecorderBar),
  { ssr: false },
);
const ComposerMenuSheet = dynamic(
  () => import('@/features/messaging/components/ComposerMenuSheet').then((m) => m.ComposerMenuSheet),
  { ssr: false },
);

function SalonAttachmentImage({ content }: { content: string }) {
  const url = useResolvedAttachmentUrl(content);
  if (!url) {
    return (
      <span
        style={{
          display: 'block',
          width: 180,
          height: 120,
          borderRadius: 12,
          background: 'rgba(23, 64, 44, 0.08)',
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Photo partagée" loading="lazy" decoding="async" />
  );
}

function toMessagingMessage(msg: ClubChannelMessage): Message {
  return {
    id: msg.id,
    conversation_id: msg.channelId,
    sender_id: msg.authorId,
    content: msg.body,
    message_type: (msg.messageType ?? 'text') as Message['message_type'],
    metadata: (msg.metadata ?? undefined) as Message['metadata'],
    created_at: msg.createdAt,
    updated_at: msg.editedAt ?? msg.createdAt,
  };
}

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRealtimeMessage(row: Record<string, unknown>): ClubChannelMessage {
  const rawType = typeof row.message_type === 'string' ? row.message_type : 'text';
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  return {
    id: String(row.id ?? ''),
    channelId: String(row.channel_id ?? ''),
    clubId: String(row.club_id ?? ''),
    authorId: String(row.author_id ?? ''),
    body: typeof row.body === 'string' ? row.body : '',
    messageType: rawType as ClubChannelMessageType,
    metadata,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    editedAt: typeof row.edited_at === 'string' ? row.edited_at : null,
    hiddenByModeratorId:
      typeof row.hidden_by_moderator_id === 'string' ? row.hidden_by_moderator_id : null,
    hiddenReason: typeof row.hidden_reason === 'string' ? row.hidden_reason : null,
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  };
}

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
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [openAttachment, setOpenAttachment] = useState<Message | null>(null);
  const channelMenuRef = useRef<HTMLDivElement | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ author: string; excerpt: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Record<string, number>>>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

  const canModerateMessages = useMemo(() => {
    if (activeClub.viewerCapabilities) {
      return activeClub.viewerCapabilities.includes('salons.moderate_messages');
    }
    if (
      activeClub.viewerRole === 'founder' ||
      activeClub.viewerRole === 'admin' ||
      activeClub.viewerRole === 'moderator' ||
      activeClub.role === 'Admin' ||
      activeClub.role === 'Modérateur'
    ) {
      return true;
    }
    const r = currentMember?.rawRole;
    return r === 'founder' || r === 'admin' || r === 'moderator';
  }, [activeClub.role, activeClub.viewerCapabilities, activeClub.viewerRole, currentMember]);

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

      if (!force && !hit) setLoading(true);
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

  // Synchronisation temps réel automatique (Supabase Realtime + resync retour d'onglet)
  useEffect(() => {
    if (!active || !activeChannelId || !UUID_RE.test(activeChannelId)) return;

    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      supabase = null;
    }

    const realtimeChannel = supabase
      ? supabase
          .channel(`club-salon-live-${activeChannelId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'club_channel_messages',
              filter: `channel_id=eq.${activeChannelId}`,
            },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                const oldRow = payload.old as Record<string, unknown> | null;
                const deletedId = oldRow?.id ? String(oldRow.id) : null;
                if (!deletedId) return;
                setMessages((prev) => prev.filter((m) => m.id !== deletedId));
                return;
              }
              const newRow = payload.new as Record<string, unknown> | null;
              if (!newRow || !newRow.id) return;
              const mapped = mapRealtimeMessage(newRow);
              setMessages((prev) => {
                if (payload.eventType === 'UPDATE') {
                  return prev.map((m) => (m.id === mapped.id ? mapped : m));
                }
                if (prev.some((m) => m.id === mapped.id)) return prev;
                const withoutMatchingTemp = prev.filter(
                  (m) =>
                    !(
                      m.id.startsWith('temp-') &&
                      m.authorId === mapped.authorId &&
                      m.body === mapped.body
                    ),
                );
                return [...withoutMatchingTemp, mapped];
              });
            },
          )
          .subscribe()
      : null;

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void loadChannel(activeChannelId, true);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (supabase && realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
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
      if (channelMenuOpen) {
        setChannelMenuOpen(false);
      } else if (selectedMsgId) {
        setSelectedMsgId(null);
      } else if (searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      } else if (view === 'channels') {
        setView('chat');
      } else if (replyingTo) {
        setReplyingTo(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, channelMenuOpen, replyingTo, searchOpen, selectedMsgId, view]);

  useEffect(() => {
    if (!channelMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (channelMenuRef.current && !channelMenuRef.current.contains(e.target as Node)) {
        setChannelMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [channelMenuOpen]);

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

  const sendSalonMessage = useCallback(
    async (opts: {
      body: string;
      messageType?: ClubChannelMessageType;
      metadata?: Record<string, unknown> | null;
      restoreDraftOnError?: string;
    }) => {
      if (!activeChannel || !canPost) return false;
      const bodyClean = opts.body.trim();
      if (!bodyClean) return false;

      const msgType: ClubChannelMessageType = opts.messageType ?? 'text';
      const tempId = `temp-${Date.now()}`;
      const optimistic: ClubChannelMessage = {
        id: tempId,
        channelId: activeChannel.id,
        clubId: activeClub.id,
        authorId: currentUserId || 'me',
        body: bodyClean,
        messageType: msgType,
        metadata: opts.metadata ?? null,
        createdAt: new Date().toISOString(),
      };

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
            body: bodyClean,
            messageType: msgType,
            metadata: opts.metadata ?? null,
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
        return true;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (opts.restoreDraftOnError) setDraft(opts.restoreDraftOnError);
        onToast?.({
          title: 'Envoi impossible',
          subtitle: err instanceof Error ? err.message : 'Vérifiez votre connexion.',
        });
        return false;
      } finally {
        setSending(false);
      }
    },
    [activeChannel, activeClub.id, canPost, currentUserId, onToast],
  );

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawText = draft.trim();
    if (!rawText || !activeChannel || sending || !canPost) return;

    const finalBody = replyingTo
      ? `> ${replyingTo.author}: ${replyingTo.excerpt}\n${rawText}`
      : rawText;

    setDraft('');
    setReplyingTo(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    await sendSalonMessage({
      body: finalBody,
      messageType: 'text',
      restoreDraftOnError: rawText,
    });
  };

  const handleUploadAndSendFile = useCallback(
    async (
      file: File,
      forcedType?: 'image' | 'gpx' | 'audio' | 'file',
      extraMeta?: Record<string, unknown>,
    ) => {
      if (!activeChannel || !canPost) return;
      const isGpx =
        forcedType === 'gpx' ||
        file.name.toLowerCase().endsWith('.gpx') ||
        file.type.includes('gpx');
      const resolvedType: ClubChannelMessageType =
        forcedType ?? (isGpx ? 'gpx' : file.type.startsWith('image/') ? 'image' : 'file');

      const url = await messagingService.uploadAttachment(activeChannel.id, file);
      if (!url) {
        onToast?.({
          title: 'Téléversement refusé',
          subtitle: 'Vérifiez votre connexion et la taille du fichier (max 25 Mo).',
        });
        return;
      }
      await sendSalonMessage({
        body: url,
        messageType: resolvedType,
        metadata: {
          file_name: file.name,
          file_size: file.size,
          url,
          ...(extraMeta ?? {}),
        },
      });
    },
    [activeChannel, canPost, onToast, sendSalonMessage],
  );

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
      className="lkdv-messages"
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
              padding: '0 12px 0 8px',
              borderRadius: 999,
              border: '0.5px solid rgba(255, 255, 255, 0.85)',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.42))',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 8px rgba(23, 43, 36, 0.08)',
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
            <button
              type="button"
              className={`reseau-btn ${searchOpen ? 'active' : ''} club-icon-pill`}
              aria-label="Rechercher dans le salon"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={14} aria-hidden="true" />
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
        </div>
      ) : (
        <>
          {/* FLUX DE MESSAGES (DESIGN IDENTIQUE PAGE MESSAGERIE — .mthread / .mrow / .bub) */}
          <div
            ref={scrollRef}
            className="mthread"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={`Fil du salon ${activeChannel?.name || 'club'}`}
            style={{ padding: '10px 6px 14px' }}
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
              <div className="mstate" style={{ margin: 'auto', textAlign: 'center' }}>
                <span>Chargement de #{activeChannel?.name || 'salon'}…</span>
              </div>
            ) : (
              <>
                {visibleMessages.length === 0 ? (
                  <div className="mstate" style={{ margin: 'auto', textAlign: 'center' }}>
                    <b>{searchQuery ? 'Aucun résultat' : 'Le début de la discussion'}</b>
                    <span>
                      {searchQuery
                        ? 'Aucun message ne correspond à ta recherche.'
                        : 'Écrivez le premier message.'}
                    </span>
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => {
                    const author = resolveAuthor(msg.authorId);
                    const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                    const next = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;
                    const dayLabel = formatDayLabel(msg.createdAt);
                    const prevDayLabel = prev ? formatDayLabel(prev.createdAt) : null;
                    const showDaySep = Boolean(dayLabel && dayLabel !== prevDayLabel);

                    const prevMs = prev ? Date.parse(prev.createdAt) : 0;
                    const curMs = Date.parse(msg.createdAt);
                    const nextMs = next ? Date.parse(next.createdAt) : 0;
                    const sameAsPrev =
                      !showDaySep &&
                      Boolean(prev && prev.authorId === msg.authorId && Math.abs(curMs - prevMs) < 120_000);
                    const sameAsNext =
                      Boolean(next && next.authorId === msg.authorId && Math.abs(nextMs - curMs) < 120_000);

                    const mine = author.isMine;
                    const msgType: ClubChannelMessageType = msg.messageType ?? 'text';
                    const isAttachment =
                      msgType === 'image' ||
                      msgType === 'product' ||
                      msgType === 'trail' ||
                      msgType === 'gpx' ||
                      msgType === 'kit' ||
                      msgType === 'post';
                    const parsed = parseReplyPrefix(msg.body);
                    const isSelected = selectedMsgId === msg.id;
                    const reactions = reactionsByMsg[msg.id] || {};
                    const reactionEntries = Object.entries(reactions);
                    const meta = msg.metadata ?? {};

                    return (
                      <React.Fragment key={msg.id}>
                        {showDaySep ? <div className="mday">{dayLabel}</div> : null}

                        <div className={`mrow${mine ? ' mine' : ''}`}>
                          <div className={`mstack${mine ? ' mine' : ''}`}>
                            {!mine && !sameAsPrev ? (
                              <span className="msender">{author.name}</span>
                            ) : null}

                            <button
                              type="button"
                              className={`bub ${mine ? 'mine' : 'other'}${sameAsPrev && sameAsNext ? ' mid' : ''}${isAttachment ? ' bub-attachment' : ''} tap`}
                              onClick={() => setSelectedMsgId((cur) => (cur === msg.id ? null : msg.id))}
                              aria-label={`Message de ${mine ? 'vous' : author.name}, ${formatMsgTime(msg.createdAt)}`}
                            >
                              {parsed.replyTo && msgType === 'text' ? (
                                <span className="bub-quote">
                                  <b>{parsed.replyTo}</b> — {parsed.quote}
                                </span>
                              ) : null}

                              {msgType === 'image' ? (
                                <span
                                  className="bub-img"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenAttachment(toMessagingMessage(msg));
                                  }}
                                >
                                  <SalonAttachmentImage content={msg.body} />
                                </span>
                              ) : msgType === 'product' ? (
                                <span
                                  className="mcard"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenAttachment(toMessagingMessage(msg));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setOpenAttachment(toMessagingMessage(msg));
                                    }
                                  }}
                                >
                                  {typeof meta.photo_url === 'string' ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      className="mcard-img"
                                      src={meta.photo_url}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="mcard-ico" aria-hidden="true">
                                      <Icon name="backpack" className="size-4" />
                                    </span>
                                  )}
                                  <span className="mcard-txt">
                                    <b>{String(meta.name || msg.body || 'Équipement')}</b>
                                    <small>
                                      {typeof meta.price_cents === 'number'
                                        ? `${(meta.price_cents / 100).toFixed(2).replace('.', ',')} €`
                                        : 'Équipement partagé'}
                                    </small>
                                  </span>
                                </span>
                              ) : msgType === 'trail' || msgType === 'gpx' ? (
                                (() => {
                                  const trailGeojson =
                                    (meta.geojson as {
                                      type: 'LineString';
                                      coordinates: [number, number][];
                                    } | null) ??
                                    (Array.isArray(meta.coordinates) && meta.coordinates.length > 1
                                      ? {
                                          type: 'LineString' as const,
                                          coordinates: meta.coordinates as [number, number][],
                                        }
                                      : null) ??
                                    resolveTrailCoordinates(
                                      (meta.name as string) ||
                                        (meta.id as string) ||
                                        msg.body,
                                    );
                                  return (
                                    <div
                                      className="mbub-map"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenAttachment(toMessagingMessage(msg));
                                      }}
                                    >
                                      <TraceMap geojson={trailGeojson} height={160} />
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          padding: '8px 10px',
                                          background:
                                            'linear-gradient(180deg, transparent, rgba(23, 43, 36, 0.92))',
                                          color: '#fff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          pointerEvents: 'none',
                                          zIndex: 10,
                                        }}
                                      >
                                        <b
                                          style={{
                                            fontSize: 12,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: '75%',
                                          }}
                                        >
                                          {msgType === 'trail'
                                            ? String(meta.name || msg.body)
                                            : String(meta.file_name || 'Tracé GPX')}
                                        </b>
                                        <span
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            background: 'rgba(255,255,255,0.25)',
                                            padding: '2px 8px',
                                            borderRadius: 999,
                                          }}
                                        >
                                          Voir
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : msgType === 'kit' ? (
                                <span
                                  className="mcard mcard-kit"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenAttachment(toMessagingMessage(msg));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setOpenAttachment(toMessagingMessage(msg));
                                    }
                                  }}
                                >
                                  <span className="mcard-tile" aria-hidden="true">
                                    <Icon name="layers" className="size-4" />
                                  </span>
                                  <span className="mcard-txt">
                                    <b>{String(meta.kit_name || msg.body || 'Kit partagé')}</b>
                                    <small>
                                      {typeof meta.items_count === 'number'
                                        ? `Kit de matériel · ${meta.items_count} élément${meta.items_count > 1 ? 's' : ''}`
                                        : 'Kit de matériel'}
                                    </small>
                                  </span>
                                  <Icon
                                    name="chevron-right"
                                    className="size-3.5 mcard-chevron"
                                    aria-hidden="true"
                                  />
                                </span>
                              ) : msgType === 'audio' ? (
                                <AudioPlayerBubble audioUrl={msg.body} isMine={mine} />
                              ) : msgType === 'file' || msgType === 'video' ? (
                                <span
                                  className="mcard"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenAttachment(toMessagingMessage(msg));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setOpenAttachment(toMessagingMessage(msg));
                                    }
                                  }}
                                >
                                  <span className="mcard-ico" aria-hidden="true">
                                    <Icon
                                      name={msgType === 'video' ? 'play' : 'paperclip'}
                                      className="size-4"
                                    />
                                  </span>
                                  <span className="mcard-txt">
                                    <b>{msgType === 'video' ? 'Vidéo' : 'Fichier'}</b>
                                    <small>
                                      {String(meta.file_name || msg.body.split('/').pop() || 'Pièce jointe').slice(0, 42)}
                                    </small>
                                  </span>
                                  <Icon
                                    name="chevron-right"
                                    className="size-3.5 mcard-chevron"
                                    aria-hidden="true"
                                  />
                                </span>
                              ) : (
                                parsed.text
                              )}

                              <span className="bub-time">
                                {formatMsgTime(msg.createdAt)}
                                {msg.id.startsWith('temp-') ? '…' : mine ? <span aria-hidden="true">✓</span> : null}
                              </span>
                            </button>

                            {reactionEntries.length > 0 ? (
                              <div className="mreacts">
                                {reactionEntries.map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="mreact on"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleReaction(msg.id, emoji);
                                    }}
                                  >
                                    {emoji} {count}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {isSelected && !msg.id.startsWith('temp-') ? (
                              <div className="mreacts" style={{ padding: '2px 0' }} onClick={(e) => e.stopPropagation()}>
                                {canPost ? (
                                  <button
                                    type="button"
                                    className="mreact"
                                    onClick={() => {
                                      setReplyingTo({
                                        author: author.name,
                                        excerpt: parsed.text.slice(0, 60),
                                      });
                                      setSelectedMsgId(null);
                                      inputRef.current?.focus();
                                    }}
                                  >
                                    Répondre
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="mreact"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(parsed.text).catch(() => {});
                                    setSelectedMsgId(null);
                                    onToast?.({ title: 'Message copié ✓' });
                                  }}
                                >
                                  Copier
                                </button>
                                {!mine ? (
                                  <button
                                    type="button"
                                    className="mreact"
                                    onClick={() => void handleReportMessage(msg)}
                                  >
                                    Signaler
                                  </button>
                                ) : null}
                                {canModerateMessages || mine ? (
                                  <button
                                    type="button"
                                    className="mreact"
                                    style={{ color: '#b91c1c' }}
                                    onClick={() => void handleDeleteMessage(msg)}
                                  >
                                    Supprimer
                                  </button>
                                ) : null}
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="mreact"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    aria-label={`Réagir ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
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
              3. COMPOSITEUR + HAMBURGER DES SALONS TOUT EN BAS À DROITE
             ===================================================================== */}
          {!error ? (
            <div
              ref={channelMenuRef}
              style={{
                flex: 'none',
                position: 'relative',
                paddingTop: 8,
                paddingBottom: 2,
                borderTop: '1px solid rgba(23, 64, 44, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {channelMenuOpen && channels.length > 0 ? (
                <div
                  role="menu"
                  aria-label="Salons du club"
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 'calc(100% + 8px)',
                    zIndex: 45,
                    minWidth: 236,
                    maxWidth: 'min(290px, calc(100vw - 36px))',
                    maxHeight: 280,
                    overflowY: 'auto',
                    padding: 8,
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.95)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    border: '0.5px solid rgba(23, 64, 44, 0.14)',
                    boxShadow:
                      '0 14px 36px rgba(23, 43, 36, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.07em',
                      color: '#56665d',
                      padding: '4px 10px 2px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Salons du club
                  </div>
                  {channels.map((ch) => {
                    const isCur = ch.id === (activeChannel?.id ?? null);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isCur}
                        onClick={() => {
                          setActiveChannelId(ch.id);
                          setSelectedMsgId(null);
                          setSearchQuery('');
                          setSearchOpen(false);
                          setChannelMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: 0,
                          background: isCur ? 'rgba(23, 64, 44, 0.1)' : 'transparent',
                          color: isCur ? '#17402c' : '#172b24',
                          fontSize: 12.5,
                          fontWeight: isCur ? 700 : 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ opacity: isCur ? 1 : 0.65, display: 'inline-flex', flex: 'none' }}>
                            {channelIcon(ch.kind, 14)}
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ch.name}
                          </span>
                        </span>
                        {isCur ? (
                          <Check size={14} color="#17402c" style={{ flex: 'none' }} aria-hidden="true" />
                        ) : ch.readOnlyForMembers ? (
                          <Lock size={12} color="#56665d" style={{ flex: 'none' }} aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {replyingTo ? (
                <div className="mreply">
                  <span>
                    Réponse à <b>{replyingTo.author}</b> — {replyingTo.excerpt}
                  </span>
                  <button
                    type="button"
                    className="mtool"
                    style={{ width: 22, height: 22, marginLeft: 'auto' }}
                    aria-label="Annuler la réponse"
                    onClick={() => setReplyingTo(null)}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {canPost && activeChannel ? (
                recording ? (
                  <VoiceRecorderBar
                    onSendVoiceNote={async (blob, duration) => {
                      setRecording(false);
                      const ext = blob.type.includes('mp4')
                        ? 'm4a'
                        : blob.type.includes('ogg')
                          ? 'ogg'
                          : 'webm';
                      const file = new File([blob], `voicenote_${Date.now()}.${ext}`, {
                        type: blob.type || 'audio/webm',
                      });
                      await handleUploadAndSendFile(file, 'audio', { duration });
                    }}
                    onCancel={() => setRecording(false)}
                  />
                ) : (
                  <form className="mcomposer" onSubmit={handleSendMessage}>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUploadAndSendFile(file, 'image');
                        event.target.value = '';
                      }}
                      aria-label="Joindre une photo depuis la galerie"
                    />
                    <div className="mfield-wrap" style={{ flex: 1, minWidth: 0 }}>
                      <textarea
                        ref={inputRef}
                        className="mfield"
                        rows={1}
                        value={draft}
                        placeholder="Votre message…"
                        aria-label={`Écrire dans ${activeChannel.name}`}
                        enterKeyHint="send"
                        maxLength={2000}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          const node = e.target;
                          node.style.height = 'auto';
                          node.style.height = `${Math.min(Math.max(node.scrollHeight, 36), 110)}px`;
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            typeof window !== 'undefined' &&
                            window.matchMedia('(pointer: fine)').matches
                          ) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="mfield-mic"
                        onClick={() => setRecording(true)}
                        aria-label="Enregistrer une note vocale"
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="9" y="2.8" width="6" height="11" rx="3" />
                          <path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0" />
                          <path d="M12 18.2v3" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="lg gbtn"
                      onClick={() => setShareMenuOpen(true)}
                      aria-label="Partager une photo, un GPX ou un équipement"
                    >
                      <Icon name="ellipsis" className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="submit"
                      className={`lg gbtn msend${draft.trim() ? ' on' : ''}`}
                      disabled={sending || !draft.trim()}
                      aria-label="Envoyer le message"
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4.4 12h14.2" />
                        <path d="M12.8 6.2 18.6 12l-5.8 5.8" />
                      </svg>
                    </button>
                    {channels.length > 0 ? (
                      <button
                        type="button"
                        className={`lg gbtn${channelMenuOpen ? ' on' : ''}`}
                        onClick={() => setChannelMenuOpen((v) => !v)}
                        aria-label="Salons du club"
                        aria-haspopup="menu"
                        aria-expanded={channelMenuOpen}
                      >
                        <Menu size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </form>
                )
              ) : activeChannel?.readOnlyForMembers ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
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
                  {channels.length > 0 ? (
                    <button
                      type="button"
                      className={`lg gbtn${channelMenuOpen ? ' on' : ''}`}
                      onClick={() => setChannelMenuOpen((v) => !v)}
                      aria-label="Salons du club"
                      aria-haspopup="menu"
                      aria-expanded={channelMenuOpen}
                    >
                      <Menu size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {typeof document !== 'undefined' && activeChannel
        ? createPortal(
            <div className="lkdv-messages club-salon-sheet-host">
              <AttachmentDrawer
                message={openAttachment}
                onClose={() => setOpenAttachment(null)}
              />
              <ComposerMenuSheet
                isOpen={shareMenuOpen}
                onClose={() => setShareMenuOpen(false)}
                currentUserId={currentUserId ?? ''}
                onPickPhoto={() => photoInputRef.current?.click()}
                onSendPhoto={async (file) => {
                  await handleUploadAndSendFile(file, 'image');
                  setShareMenuOpen(false);
                }}
                onSendGpx={async (file, geojson) => {
                  await handleUploadAndSendFile(file, 'gpx', {
                    geojson: geojson ?? null,
                    coordinates: geojson?.coordinates ?? null,
                  });
                  setShareMenuOpen(false);
                }}
                onSendProduct={async (meta: ProductMessageMeta) => {
                  await sendSalonMessage({
                    body: meta.name,
                    messageType: 'product',
                    metadata: meta as unknown as Record<string, unknown>,
                  });
                  setShareMenuOpen(false);
                }}
                onSendTrail={async (meta: TrailMessageMeta) => {
                  await sendSalonMessage({
                    body: meta.name,
                    messageType: 'trail',
                    metadata: meta as unknown as Record<string, unknown>,
                  });
                  setShareMenuOpen(false);
                }}
                onSendKit={async (meta: KitMessageMeta) => {
                  await sendSalonMessage({
                    body: meta.kit_name,
                    messageType: 'kit',
                    metadata: meta as unknown as Record<string, unknown>,
                  });
                  setShareMenuOpen(false);
                }}
              />
            </div>,
            document.querySelector('.lkdv-clubs-v8 .phone') ?? document.body,
          )
        : null}
    </div>
  );
}

export default ClubSalonsDrawerBody;
