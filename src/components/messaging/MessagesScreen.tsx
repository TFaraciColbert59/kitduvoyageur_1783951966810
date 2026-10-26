'use client';

/**
 * Écran Messages — grammaire Compte (verre Liquid Glass v8).
 *
 * Écran verrouillé 430 × 932 : barre haute 36 (pilule + 3 ronds), carte
 * 406 × 541 (identité de la conversation, bio, 4 anneaux de filtre, liste des
 * discussions dans `.ig-grid-wrap`, sélecteur liste/grille 88 × 30), zone basse
 * 334,9 (fil de la conversation + réponse rapide), barre basse 48.
 *
 * Aucune donnée inventée : tout vient de `useConversations`, `useMessages`,
 * `useRealtimeMessaging` et `messagingService`. Aucune couleur littérale,
 * aucune matière d'écran : le verre vient de compte-v8.css.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/compte/compte-v8.css';
import '@/components/compte/compte-apple-hig.css';
import '@/design/account/account-grammar-pins.css';
import '@/components/messaging/messages-grammar.css';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import Icon from '@/components/ui/Icon';
import ReportBlockModal, { type ReportTarget } from '@/components/ui/ReportBlockModal';
import { lkvConfirm } from '@/components/ui/dialogs';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useLongPress } from '@/hooks/gestures';
import { createClient } from '@/lib/supabase/client';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useRealtimeMessaging } from '@/features/messaging/hooks/useRealtimeMessaging';
import { messagingService } from '@/features/messaging/services/messagingService';
import { formatConversationTimestamp } from '@/features/messaging/lib/messagingUtils';
import { parseMessageDeepLink, resolveHandleToUserId } from '@/features/messaging/lib/deepLinks';
import {
  SWIPE_REVEAL,
  clampSwipe,
  conversationTitle,
  filterConversations,
  lastPreview,
  resolveSwipeEnd,
  type FilterId,
} from './messagesModel';
import { VoiceRecorderBar } from '@/features/messaging/components/VoiceRecorderBar';
import { ComposerMenuSheet } from '@/features/messaging/components/ComposerMenuSheet';
import { ConversationOptionsSheet } from '@/features/messaging/components/ConversationOptionsSheet';
import { ForwardMessageSheet } from '@/features/messaging/components/ForwardMessageSheet';
import { GroupSettingsModal } from '@/features/messaging/components/GroupSettingsModal';
import type {
  Conversation,
  ConversationMember,
  KitMessageMeta,
  Message,
  ProductMessageMeta,
  TrailMessageMeta,
  UserProfileSummary,
} from '@/features/messaging/types/messaging.types';

const MUTE_PRESETS = [
  { label: '1 heure', minutes: 60 },
  { label: '8 heures', minutes: 480 },
  { label: '1 semaine', minutes: 10_080 },
  { label: 'Désactiver', minutes: null },
] as const;

const FILTERS: Array<{ id: FilterId; label: string; icon: string }> = [
  { id: 'all', label: 'Toutes', icon: 'M4 6h16v12H4z' },
  { id: 'direct', label: 'Directs', icon: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c.8-3.8 3.8-6 8-6s7.2 2.2 8 6' },
  { id: 'group', label: 'Groupes', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.5-3 2.8-5 6-5s5.5 2 6 5M16 10a2.5 2.5 0 1 0 0-5M17 14c2 .4 3.3 2 3.8 4.4' },
  { id: 'requests', label: 'Demandes', icon: 'M12 3a6 6 0 0 0-6 6v4l-2 4h16l-2-4V9a6 6 0 0 0-6-6Zm-2 17a2 2 0 0 0 4 0' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Rangée de conversation (gestes conservés : glissement + appui long) */
/* ------------------------------------------------------------------ */

type SwipeAction = 'delete' | 'notify';

function ConversationFeedRow({
  conversation,
  selected,
  index = 0,
  onSelect,
  onLongPress,
  onSwipeAction,
}: {
  conversation: Conversation;
  selected: boolean;
  /** Position dans la liste : sert au décalage de l'apparition. */
  index?: number;
  onSelect: (conv: Conversation) => void;
  onLongPress?: (conv: Conversation) => void;
  onSwipeAction?: (conv: Conversation, action: SwipeAction) => void;
}) {
  const { haptic } = useHapticFeedback();
  // Brouillon local de cette conversation (même clé que le composer).
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    try {
      setDraft(window.localStorage.getItem(`lkdv:draft:${conversation.id}`));
    } catch {
      setDraft(null);
    }
  }, [conversation.id]);
  const [dx, setDx] = useState(0);
  const [snapped, setSnapped] = useState(false);
  const dxRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const moved = useRef(false);
  const suppress = useRef(false);

  const longPress = useLongPress(() => {
    if (!onLongPress) return;
    suppress.current = true;
    haptic('medium');
    onLongPress(conversation);
  });

  const title = conversationTitle(conversation);
  const unread = conversation.unread_count || 0;
  const isPending = conversation.status === 'pending';
  const avatar = conversation.avatar_url;

  const fire = (action: SwipeAction) => {
    haptic('medium');
    setDx(0);
    setSnapped(false);
    onSwipeAction?.(conversation, action);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    startX.current = event.touches[0].clientX;
    startY.current = event.touches[0].clientY;
    axis.current = 'none';
    dxRef.current = snapped ? SWIPE_REVEAL : 0;
    suppress.current = false;
    longPress.onTouchStart(event);
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const ddx = event.touches[0].clientX - startX.current;
    const ddy = event.touches[0].clientY - startY.current;
    if (axis.current === 'none' && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (axis.current === 'x') {
      dxRef.current = clampSwipe(ddx, snapped ? SWIPE_REVEAL : 0);
      setDx(dxRef.current);
    }
    longPress.onTouchMove(event);
  };

  const onTouchEnd = () => {
    moved.current = axis.current !== 'none';
    longPress.onTouchEnd();
    if (axis.current === 'x') {
      const end = resolveSwipeEnd(dxRef.current);
      dxRef.current = end.dx;
      setDx(end.dx);
      setSnapped(end.open);
    } else {
      dxRef.current = snapped ? SWIPE_REVEAL : 0;
      setDx(dxRef.current);
    }
    axis.current = 'none';
  };

  return (
    <div className="mfeed-item" style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, flex: 'none', ['--i' as string]: index }}>
      {(dx > 0 || snapped) && onSwipeAction ? (
        <div className="mrow-actions" style={{ width: SWIPE_REVEAL }}>
          <button
            type="button"
            className="mrow-act danger"
            onClick={() => fire('delete')}
            aria-label="Supprimer la conversation"
          >
            <Icon name="trash-2" className="size-4" aria-hidden="true" />
            <small>Supprimer</small>
          </button>
          <button
            type="button"
            className="mrow-act"
            onClick={() => fire('notify')}
            aria-label="Gérer les notifications"
          >
            <Icon name="bell" className="size-4" aria-hidden="true" />
            <small>Notifs</small>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="ig-feed-row"
        aria-current={selected ? 'true' : undefined}
        aria-label={`${title}${unread > 0 ? `, ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (suppress.current || snapped) {
            suppress.current = false;
            if (snapped) {
              setDx(0);
              setSnapped(false);
            }
            return;
          }
          haptic('light');
          onSelect(conversation);
        }}
        style={{
          width: '100%',
          border: selected ? '0.5px solid var(--subtle)' : 0,
          background: selected ? 'var(--mint)' : undefined,
          transform: `translate3d(${dx}px,0,0)`,
          transition: dx === 0 ? 'transform .2s cubic-bezier(.3,1.2,.4,1)' : 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span className="fa" aria-hidden="true">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar distant de la conversation
            <img src={avatar} alt="" loading="lazy" />
          ) : (
            initials(title)
          )}
          {conversation.type === 'group' ? (
            <span className="fa-grp">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.5-3 2.8-5 6-5s5.5 2 6 5M16 10a2.5 2.5 0 1 0 0-5M17 14c2 .4 3.3 2 3.8 4.4" />
              </svg>
            </span>
          ) : null}
        </span>
        <span style={{ minWidth: 0 }}>
          <b>
            {title}
            {conversation.is_muted ? <Icon name="bell-off" className="ml-1 inline size-3" aria-hidden="true" /> : null}
            {isPending ? <span className="mrow-pending">Demande</span> : null}
          </b>
          <small>
            {draft ? <span style={{ color: 'var(--warn)' }}>Brouillon — {draft.replace(/\s+/g, ' ').slice(0, 40)}</span> : lastPreview(conversation)}
          </small>
        </span>
        <span className="mrow-side">
          {formatConversationTimestamp(conversation.last_message_at)}
          {unread > 0 ? <span className="mrow-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fil + bulles + composer                                            */
/* ------------------------------------------------------------------ */

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];

function MessageThread({
  conversation,
  currentUserId,
  currentUserProfile,
  members,
  hideReads = false,
  compact,
  focusMessageId,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  members: ConversationMember[];
  /** Accusés de lecture masqués (préférence locale). */
  hideReads?: boolean;
  compact: boolean;
  focusMessageId?: string | null;
}) {
  const { haptic } = useHapticFeedback();
  const { messages, loading, error, hasMore, loadingEarlier, loadEarlier, retryMessage, toggleReaction, sendMessage: sendThreadMessage, refreshMessages } =
    useMessages(conversation.id, currentUserId, currentUserProfile);
  const { typingUserNames, sendTypingSignal } = useRealtimeMessaging(conversation.id, currentUserId, currentUserProfile?.full_name);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, conversation.id]);

  // B6 — retour du réseau : on relance les envois restés en échec.
  useEffect(() => {
    const retryFailed = () => {
      messages.filter((message) => message.status === 'error').forEach((message) => retryMessage(message.id));
    };
    window.addEventListener('online', retryFailed);
    return () => window.removeEventListener('online', retryFailed);
  }, [messages, retryMessage]);

  useEffect(() => {
    if (!focusMessageId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`grammar-msg-${focusMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messages.length]);

  const readBy = (message: Message) => {
    if (hideReads) return null;
    if (message.sender_id !== currentUserId) return null;
    const others = members.filter((m) => m.user_id !== currentUserId);
    if (others.length === 0) return null;
    const stamp = new Date(message.created_at).getTime();
    const count = others.filter((m) => (m.last_read_at ? new Date(m.last_read_at).getTime() >= stamp - 1000 : false)).length;
    if (!count) return null;
    return count;
  };

  if (loading && messages.length === 0) {
    return (
      <div className="mthread" aria-busy="true" aria-label="Chargement des messages">
        {[1, 2, 3].map((i) => (
          <div className="mskel" key={i}>
            <i style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <i style={{ width: i % 2 ? 160 : 210, height: 34 }} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="mstate">
        <b>Le début de votre discussion</b>
        <span>Écrivez le premier message.</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="mthread"
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`Fil de discussion avec ${conversationTitle(conversation)}`}
      >
        {hasMore ? (
          <button type="button" className="mbtn" style={{ alignSelf: 'center', margin: '2px 0 4px' }} onClick={loadEarlier} disabled={loadingEarlier}>
            {loadingEarlier ? 'Chargement…' : 'Messages précédents'}
          </button>
        ) : null}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const stamp = new Date(message.created_at).getTime();
          const sameAsPrev = previous && previous.sender_id === message.sender_id && Math.abs(stamp - new Date(previous.created_at).getTime()) < 120000;
          const sameAsNext = next && next.sender_id === message.sender_id && Math.abs(new Date(next.created_at).getTime() - stamp) < 120000;
          const mine = message.sender_id === currentUserId;
          const showDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
          const reactions = message.reactions ?? [];
          const reads = readBy(message);

          if (message.message_type === 'system') {
            return (
              <React.Fragment key={message.id}>
                {showDay ? <div className="mday">{dayLabel(message.created_at)}</div> : null}
                <div className="bub-sys">{message.content}</div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={message.id}>
              {showDay ? <div className="mday">{dayLabel(message.created_at)}</div> : null}
              <div className={`mrow${mine ? ' mine' : ''}`} id={`grammar-msg-${message.id}`}>
                <div className={`mstack${mine ? ' mine' : ''}`}>
                  {conversation.type === 'group' && !mine && !sameAsPrev ? (
                    <span className="msender">{message.sender_profile?.full_name ?? 'Voyageur'}</span>
                  ) : null}

                  <button
                    type="button"
                    className={`bub ${mine ? 'mine' : 'other'}${sameAsPrev && sameAsNext ? ' mid' : ''} tap`}
                    onClick={() => {
                      haptic('light');
                      setOpenMenu(openMenu === message.id ? null : message.id);
                    }}
                    aria-label={`Message de ${mine ? 'vous' : message.sender_profile?.full_name ?? 'un voyageur'}, ${timeLabel(message.created_at)}`}
                    onDoubleClick={() => {
                      haptic('medium');
                      void toggleReaction(message.id, REACTIONS[1]);
                    }}
                  >
                    {message.reply_to_message ? (
                      <span className="bub-quote">
                        {message.reply_to_message.sender_name} — {message.reply_to_message.content}
                      </span>
                    ) : null}
                    {message.message_type === 'image' ? (
                      <span className="bub-img">
                        {/* eslint-disable-next-line @next/next/no-img-element -- pièce jointe distante */}
                        <img src={message.content} alt="" loading="lazy" style={{ maxWidth: '100%', display: 'block' }} />
                      </span>
                    ) : (
                      message.content
                    )}
                    <span className="bub-time">
                      {timeLabel(message.created_at)}
                      {message.status === 'sending' ? '…' : null}
                      {message.status === 'error' ? (
                        <button
                          type="button"
                          className="mbtn"
                          style={{ height: 18, padding: '0 6px', marginLeft: 4, fontSize: 9.5 }}
                          onClick={(event) => {
                            event.stopPropagation();
                            retryMessage(message.id);
                          }}
                        >
                          Réessayer
                        </button>
                      ) : null}
                      {reads ? <span aria-label={`Lu par ${reads}`}>✓✓</span> : mine ? <span aria-hidden="true">✓</span> : null}
                    </span>
                  </button>

                  {reactions.length > 0 ? (
                    <div className="mreacts">
                      {reactions.map((reaction) => (
                        <button
                          key={reaction.id}
                          type="button"
                          className={`mreact${reaction.user_id === currentUserId ? ' on' : ''}`}
                          onClick={() => toggleReaction(message.id, reaction.reaction_value)}
                          aria-pressed={reaction.user_id === currentUserId}
                        >
                          {reaction.reaction_value}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {openMenu === message.id ? (
                    <div className="mreacts" style={{ padding: '2px 0' }}>
                      <button
                        type="button"
                        className="mreact"
                        onClick={() => {
                          setReplyTo(message);
                          setOpenMenu(null);
                        }}
                      >
                        Répondre
                      </button>
                      <button
                        type="button"
                        className="mreact"
                        onClick={() => {
                          setForwarding(message);
                          setOpenMenu(null);
                        }}
                      >
                        Transférer
                      </button>
                      <button
                        type="button"
                        className="mreact"
                        onClick={() => {
                          void navigator.clipboard?.writeText(message.content).catch(() => {});
                          setOpenMenu(null);
                        }}
                      >
                        Copier
                      </button>
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="mreact"
                          onClick={() => {
                            void toggleReaction(message.id, emoji);
                            setOpenMenu(null);
                          }}
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
        })}

        {typingUserNames.length > 0 ? (
          <div className="mday mtyping">
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <span className="sr-only">{typingUserNames.join(', ')} écrit</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mreply" role="alert">
          <span style={{ color: 'var(--bad)' }}>{error}</span>
        </div>
      ) : null}

      <MessageComposerBar
        conversation={conversation}
        currentUserId={currentUserId}
        currentUserProfile={currentUserProfile}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={sendTypingSignal}
        onSend={sendThreadMessage}
        onRefresh={refreshMessages}
        compact={compact}
      />

      <ForwardMessageSheet
        isOpen={forwarding !== null}
        onClose={() => setForwarding(null)}
        message={forwarding}
        currentUserId={currentUserId}
      />
    </>
  );
}

function MessageComposerBar({
  conversation,
  currentUserId,
  currentUserProfile,
  replyTo,
  onCancelReply,
  onTyping,
  onSend,
  onRefresh,
  compact,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  onTyping?: () => void;
  /** Envoi texte : passe par le hook du fil (optimiste + réconciliation). */
  onSend: (content: string, replyToId?: string) => Promise<void>;
  /** Rechargement du fil après un envoi direct (pièce jointe, vocal, partage). */
  onRefresh: () => Promise<void>;
  compact: boolean;
}) {
  const { haptic } = useHapticFeedback();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setContent(window.localStorage.getItem(`lkdv:draft:${conversation.id}`) || '');
    } catch {
      setContent('');
    }
  }, [conversation.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try {
        if (content.trim()) window.localStorage.setItem(`lkdv:draft:${conversation.id}`, content);
        else window.localStorage.removeItem(`lkdv:draft:${conversation.id}`);
      } catch {
        /* stockage local indisponible */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [content, conversation.id]);

  const submit = async () => {
    const text = content.trim();
    if (!text || sending) return;
    haptic('light');
    setSending(true);
    setContent('');
    try {
      window.localStorage.removeItem(`lkdv:draft:${conversation.id}`);
    } catch {
      /* ignore */
    }
    await onSend(text, replyTo?.id || undefined);
    onCancelReply();
    setSending(false);
  };

  const upload = async (file: File) => {
    const isGpx = file.name.toLowerCase().endsWith('.gpx') || file.type.includes('gpx');
    const url = await messagingService.uploadAttachment(conversation.id, file);
    if (!url) return;
    await messagingService.sendMessage(conversation.id, currentUserId, url, isGpx ? 'gpx' : file.type.startsWith('image/') ? 'image' : 'file');
    await onRefresh();
  };

  if (recording) {
    return (
      <VoiceRecorderBar
        onSendVoiceNote={async (blob, duration) => {
          setRecording(false);
          const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
          const file = new File([blob], `voicenote_${Date.now()}.${ext}`, { type: blob.type });
          const url = await messagingService.uploadAttachment(conversation.id, file);
          if (!url) return;
          await messagingService.sendMessage(conversation.id, currentUserId, url, 'audio');
          await onRefresh();
          void duration;
        }}
        onCancel={() => setRecording(false)}
      />
    );
  }

  return (
    <>
      {replyTo ? (
        <div className="mreply">
          <span>
            Réponse à <b>{replyTo.sender_profile?.full_name ?? 'un voyageur'}</b> — {replyTo.content.slice(0, 60)}
          </span>
          <button type="button" className="mtool" style={{ width: 22, height: 22, marginLeft: 'auto' }} onClick={onCancelReply} aria-label="Annuler la réponse">
            <Icon name="x" className="size-3" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <form
        className="mcomposer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
          aria-label="Joindre une photo"
        />
        <button type="button" className="mtool" onClick={() => fileInput.current?.click()} aria-label="Envoyer une photo">
          <Icon name="image-plus" className="size-4" aria-hidden="true" />
        </button>

        <textarea
          ref={field}
          className="mfield"
          rows={1}
          value={content}
          placeholder={compact ? 'Réponse rapide…' : 'Votre message…'}
          aria-label="Votre message"
          enterKeyHint="send"
          onChange={(event) => {
            setContent(event.target.value);
            onTyping?.();
            const node = event.target;
            node.style.height = 'auto';
            node.style.height = `${Math.min(Math.max(node.scrollHeight, 36), 110)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <button
          type="button"
          className="mtool"
          onClick={() => setRecording(true)}
          aria-label="Enregistrer une note vocale"
        >
          <Icon name="mic" className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className="mtool" onClick={() => setMenuOpen(true)} aria-label="Partager un GPX, un équipement ou une randonnée">
          <Icon name="ellipsis" className="size-4" aria-hidden="true" />
        </button>
        <button
          type="submit"
          className={`msend${content.trim() ? ' on' : ''}`}
          disabled={!content.trim() || sending}
          aria-label="Envoyer le message"
        >
          <Icon name="send" className="size-4" aria-hidden="true" />
        </button>
      </form>

      <ComposerMenuSheet
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentUserId={currentUserId}
        onSendGpx={(file) => void upload(file)}
        onSendProduct={(meta: ProductMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.name, 'product', undefined, meta as unknown as Record<string, unknown>).then(onRefresh)}
        onSendTrail={(meta: TrailMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.name, 'trail', undefined, meta as unknown as Record<string, unknown>).then(onRefresh)}
        onSendKit={(meta: KitMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.kit_name, 'kit', undefined, meta as unknown as Record<string, unknown>).then(onRefresh)}
      />
      {currentUserProfile ? null : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Écran                                                              */
/* ------------------------------------------------------------------ */

export interface MessagesScreenProps {
  currentUserId?: string | null;
  currentUserProfile?: UserProfileSummary | null;
}

export function MessagesScreen({ currentUserId, currentUserProfile }: MessagesScreenProps) {
  const { haptic } = useHapticFeedback();
  const router = useRouter();
  const phone = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { conversations, loading, error, refreshConversations } = useConversations(currentUserId ?? undefined);

  const [filter, setFilter] = useState<FilterId>('all');
  // Sens du changement de filtre : la liste glisse dans ce sens (voir CSS).
  const [filterDir, setFilterDir] = useState<'next' | 'prev'>('next');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchMessages, setSearchMessages] = useState<Array<{ id: string; conversation_id: string; content: string; created_at: string }>>([]);
  const [searchPeople, setSearchPeople] = useState<Array<{ id: string; full_name: string; avatar_url?: string | null }>>([]);
  const [optionsConv, setOptionsConv] = useState<Conversation | null>(null);
  const [notifyConv, setNotifyConv] = useState<Conversation | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  // Préférences locales de l'appareil (jamais envoyées au serveur).
  const [hideReads, setHideReads] = useState(false);
  const [notifyPref, setNotifyPref] = useState(false);
  const [offline, setOffline] = useState(false);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const handledDest = useRef<string | null>(null);
  const handledConv = useRef(false);

  // Réseau : bandeau honnête + renvoi automatique géré dans le fil.
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);


  useEffect(() => {
    try {
      setHideReads(window.localStorage.getItem('lkdv:messages:hide-reads') === '1');
      setNotifyPref(window.localStorage.getItem('lkdv:messages:notify') === '1');
    } catch {
      /* stockage local indisponible */
    }
  }, []);

  useEffect(() => {
    const stop = initLiquidLenses(phone.current);
    return () => {
      if (typeof stop === 'function') stop();
    };
  }, []);
  useEffect(() => {
    refreshLiquidLenses(phone.current);
  }, [filter, selectedId, conversations.length]);

  /* Deep links : ?conversation=<uuid> puis ?dest=<uuid> (comportement historique). */
  useEffect(() => {
    if (handledConv.current) return;
    const id = new URLSearchParams(window.location.search).get('conversation');
    if (id && conversations.some((conversation) => conversation.id === id)) {
      handledConv.current = true;
      setSelectedId(id);
    }
  }, [conversations]);

  useEffect(() => {
    if (!currentUserId) return;
    const link = parseMessageDeepLink(window.location.search);
    const target = link.recipientId ?? link.handle;
    if (!target || handledDest.current === target) return;
    handledDest.current = target;
    let cancelled = false;
    const run = async () => {
      try {
        // `?to=<handle>` : on résout le profil public avant tout (jamais de faux destinataire).
        const recipientId = link.recipientId ?? (link.handle ? await resolveHandleToUserId(link.handle) : null);
        if (!recipientId || recipientId === currentUserId) {
          if (!cancelled) setDeepLinkError('Destinataire introuvable.');
          return;
        }
        const supabase = createClient();
        const [blockedByMe, blockedMe] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId).eq('blocked_id', recipientId).maybeSingle(),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id', currentUserId).eq('blocker_id', recipientId).maybeSingle(),
        ]);
        if (blockedByMe.error || blockedMe.error || blockedByMe.data || blockedMe.data) throw new Error('blocked');
        const id = await messagingService.getOrCreateDirectConversation(recipientId, currentUserId);
        if (!id || cancelled) return;
        await refreshConversations();
        if (cancelled) return;
        setSelectedId(id);
        setDeepLinkError(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('dest');
        url.searchParams.delete('to');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      } catch {
        if (!cancelled) setDeepLinkError('Impossible d’ouvrir cette discussion.');
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (handledDest.current === target) handledDest.current = null;
    };
  }, [currentUserId, refreshConversations]);

  /* Recherche transverse (A-084) : personnes + messages, bornée par RLS. */
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setSearchMessages([]);
      setSearchPeople([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const exclude = conversations.map((conversation) => conversation.other_member?.id).filter((id): id is string => Boolean(id));
      const [foundMessages, foundPeople] = await Promise.all([messagingService.searchMessages(text), messagingService.searchPeople(text, exclude)]);
      if (cancelled) return;
      setSearchMessages(foundMessages);
      setSearchPeople(foundPeople);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, conversations]);

  /* Membres de la conversation sélectionnée : accusés de lecture + groupe. */
  useEffect(() => {
    if (!selectedId) {
      setMembers([]);
      return;
    }
    let mounted = true;
    messagingService.getGroupMembers(selectedId).then((rows) => {
      if (mounted) setMembers(rows);
    });
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const unreadTotal = useMemo(() => conversations.reduce((total, conversation) => total + (conversation.unread_count || 0), 0), [conversations]);
  // Badge d'application (PWA / navigateur qui le supporte) : compteur réel.
  // Déclaré APRÈS `unreadTotal` : une dépendance évaluée avant sa déclaration
  // lève une ReferenceError et fait tomber l'écran dans l'error boundary.
  useEffect(() => {
    const badge = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void> };
    if (!badge.setAppBadge) return;
    void badge.setAppBadge(unreadTotal > 0 ? unreadTotal : undefined).catch(() => {});
  }, [unreadTotal]);
  const pendingCount = useMemo(() => conversations.filter((conversation) => conversation.status === 'pending').length, [conversations]);

  const visible = useMemo(
    () => filterConversations(conversations, { filter, query }),
    [conversations, filter, query]
  );

  /** Disparition puis apparition de la liste : 120 ms de fondu sortant, puis
   *  le nouveau filtre entre (les rangées ont leur propre fondu décalé). */
  const changeFilter = (next: FilterId) => {
    if (next === filter) return;
    const from = FILTERS.findIndex((item) => item.id === filter);
    const to = FILTERS.findIndex((item) => item.id === next);
    setFilterDir(to >= from ? 'next' : 'prev');
    setFilter(next);
  };

  const open = (conversation: Conversation) => {
    setSelectedId(conversation.id);
  };

  const swipe = async (conversation: Conversation, action: SwipeAction) => {
    if (!currentUserId) return;
    if (action === 'notify') {
      setNotifyConv(conversation);
      return;
    }
    const ok = await lkvConfirm({
      title: 'Supprimer la conversation ?',
      message: `« ${conversationTitle(conversation)} » disparaîtra de ta messagerie. L'autre participant garde l'historique.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!ok) return;
    const deleted = await messagingService.deleteConversationForMe(conversation.id, currentUserId);
    if (deleted && selectedId === conversation.id) setSelectedId(null);
    await refreshConversations();
  };

  /** Toute surface ouverte (drawer, feuille, modale) sort la barre basse :
   *  c'est l'état de la grammaire, pas un bricolage par composant. */
  const surfaceOpen =
    optionsConv !== null || groupSettingsOpen || reportTarget !== null || notifyConv !== null;
  // B5 — notification navigateur : uniquement si l'utilisateur l'a activée et
  // que l'onglet est caché. Jamais de notification pour une conversation ouverte.
  const lastNotifiedRef = useRef<number>(0);
  useEffect(() => {
    if (!notifyPref || typeof window === 'undefined') return;
    if (document.visibilityState === 'visible') return;
    const now = Date.now();
    if (now - lastNotifiedRef.current < 5000) return;
    const freshest = conversations
      .filter((conversation) => (conversation.unread_count || 0) > 0 && conversation.id !== selectedId)
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())[0];
    if (!freshest) return;
    const stamp = new Date(freshest.last_message_at).getTime();
    if (stamp <= lastNotifiedRef.current - 2000) return;
    lastNotifiedRef.current = now;
    try {
      new Notification(conversationTitle(freshest), {
        body: lastPreview(freshest).slice(0, 120),
        tag: `lkdv-msg-${freshest.id}`,
        silent: false,
      });
    } catch {
      /* permission retirée : on n'insiste pas */
    }
  }, [conversations, notifyPref, selectedId]);

  /** « Nouvelle discussion » n'ouvre plus de drawer : il met le curseur dans
   *  la barre de recherche de la carte (personnes + messages). */
  const focusSearch = () => {
    searchRef.current?.focus({ preventScroll: true });
    searchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const guest = !currentUserId;

  return (
    <div className={`lkdv-compte-v8 lkdv-pays lkdv-messages${surfaceOpen ? ' sheet-open' : ''}`}>
      <h1 className="sr-only">Messagerie</h1>
      <div className="stage">
        <div className="pwrap">
          <div className={`phone hasnext${surfaceOpen ? ' sheet-open' : ''}`} id="phone" ref={phone}>
            <div
              className="bg"
              style={{ backgroundImage: "url('/assets/images/account-bg.webp')" }}
              aria-hidden="true"
            />

            <section className="top" id="top">
              <div className="ig-top">
                <button
                  type="button"
                  className="lg ig-handle"
                  onClick={() => router.push('/compte')}
                  aria-label="Messages — aller au compte"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>Messages</span>
                </button>
                <div className="ig-top-r">
                  <button
                    type="button"
                    className="lg gbtn ig-top-btn"
                    aria-label="Notifications"
                    onClick={() => router.push('/compte?tab=notifications')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.1 1.6 5.6 1.6 5.6H4.6s1.6-1.5 1.6-5.6Z" />
                      <path d="M10 18.2a2 2 0 0 0 4 0" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="msearch">
                <Icon name="search" className="size-4" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une discussion"
                  aria-label="Rechercher une discussion, une personne ou un message"
                />
                {query ? (
                  <button
                    type="button"
                    className="msearch-x"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Effacer la recherche"
                  >
                    <Icon name="x" className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="card cs" id="card">
                <div className="card-scroll">
                  {query.trim().length >= 2 && !guest ? (
                    <div className="mresults">
                      {searchPeople.length > 0 ? (
                        <section aria-label="Personnes">
                          <h3>Personnes</h3>
                          {searchPeople.slice(0, 4).map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              className="mresult"
                              onClick={async () => {
                                const id = await messagingService.getOrCreateDirectConversation(
                                  person.id,
                                  currentUserId as string
                                );
                                if (!id) return;
                                await refreshConversations();
                                setSelectedId(id);
                                setQuery('');
                              }}
                            >
                              <span className="fa" aria-hidden="true">
                                {person.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                                  <img src={person.avatar_url} alt="" />
                                ) : (
                                  initials(person.full_name)
                                )}
                              </span>
                              <b>{person.full_name}</b>
                              <small>Écrire</small>
                            </button>
                          ))}
                        </section>
                      ) : null}
                      {searchMessages.length > 0 ? (
                        <section aria-label="Messages">
                          <h3>Messages</h3>
                          {searchMessages.slice(0, 4).map((message) => (
                            <button
                              key={message.id}
                              type="button"
                              className="mresult"
                              onClick={() => {
                                setSelectedId(message.conversation_id);
                                setQuery('');
                              }}
                            >
                              <span className="mresult-txt">
                                {message.content.length > 80 ? `${message.content.slice(0, 80)}…` : message.content}
                              </span>
                              <small>
                                {new Date(message.created_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </small>
                            </button>
                          ))}
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                  <div key={filter} className={`ig-grid-wrap slide-${filterDir}`}>
                    {error ? (
                      <div className="mstate" role="alert">
                        <b>Discussions indisponibles</b>
                        <span>{error}</span>
                        <button type="button" className="mbtn p" onClick={() => void refreshConversations()}>
                          Réessayer
                        </button>
                      </div>
                    ) : loading ? (
                      [1, 2, 3, 4].map((row) => (
                        <div className="mskel" key={row} aria-hidden="true">
                          <i style={{ width: 40, height: 40, borderRadius: '50%' }} />
                          <i style={{ flex: 1, height: 12 }} />
                          <i style={{ width: 28, height: 10 }} />
                        </div>
                      ))
                    ) : guest ? (
                      <div className="mstate">
                        <b>Connectez-vous pour voir vos messages</b>
                        <span>Vos discussions et demandes apparaîtront ici.</span>
                        <button type="button" className="mbtn p" onClick={() => router.push('/connexion?next=/messagerie')}>
                          Se connecter
                        </button>
                      </div>
                    ) : visible.length === 0 ? (
                      <div className="mstate">
                        <b>{query.trim() ? 'Aucun résultat' : filter === 'requests' ? 'Aucune demande en attente' : 'Aucune discussion'}</b>
                        <span>{query.trim() ? 'Essayez un autre nom.' : filter === 'requests' ? 'Les nouvelles demandes apparaîtront ici.' : 'Lancez une discussion avec un membre de la communauté.'}</span>
                        {query.trim() ? (
                          <button type="button" className="mbtn" onClick={() => setQuery('')}>
                            Effacer la recherche
                          </button>
                        ) : (
                          <button type="button" className="mbtn p" onClick={focusSearch}>
                            Nouvelle discussion
                          </button>
                        )}
                      </div>
                    ) : (
                      visible.map((conversation) => (
                        <ConversationFeedRow
                          key={conversation.id}
                          conversation={conversation}
                          selected={conversation.id === selectedId}
                          index={visible.indexOf(conversation)}
                          onSelect={open}
                          onLongPress={currentUserId ? setOptionsConv : undefined}
                          onSwipeAction={currentUserId ? swipe : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="mfilter-float">
                  <div className="ig-tabs mfilters" role="tablist" aria-label="Filtrer les discussions">
                    <span className="ig-th" style={{ transform: `translateX(${Math.max(0, FILTERS.findIndex((item) => item.id === filter)) * 100}%)` }} aria-hidden="true" />
                    {FILTERS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === item.id}
                        className="mfilters-btn"
                        onClick={() => {
                          haptic('light');
                          changeFilter(item.id);
                        }}
                      >
                        {item.label}
                        {item.id === 'requests' && pendingCount > 0 ? <b className="mrow-badge">{pendingCount}</b> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="mapzone" aria-label="Conversation">
              {offline ? (
                <div className="moffline" role="status">
                  Hors ligne — vos messages restent en brouillon local et partiront au retour du réseau.
                </div>
              ) : null}
              <div className="map" style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 70 }}>
                {selected ? (
                  <div className="mpane in" data-conversation={selected.id}>
                    <button
                      type="button"
                      className="mpill"
                      onClick={() => {
                        if (selected.type === 'group') setOptionsConv(selected);
                        else if (selected.other_member?.id) router.push(`/profil/${selected.other_member.id}`);
                      }}
                      aria-label={`${conversationTitle(selected)} — ${
                        selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'
                      }`}
                    >
                      <span className="mpill-av" aria-hidden="true">
                        {selected.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                          <img src={selected.avatar_url} alt="" />
                        ) : (
                          initials(conversationTitle(selected))
                        )}
                      </span>
                      <span className="mpill-txt">
                        <b>{conversationTitle(selected)}</b>
                        <span>{selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'}</span>
                      </span>
                    </button>
                    <div className="mpane-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <MessageThread
                        key={selected.id}
                        conversation={selected}
                        currentUserId={currentUserId as string}
                        currentUserProfile={currentUserProfile}
                        members={members}
                        hideReads={hideReads}
                        compact
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mstate" style={{ margin: 'auto' }}>
                    <b>Choisissez une discussion</b>
                    <span>Ou lancez une nouvelle discussion avec un membre de la communauté.</span>
                    <button type="button" className="mbtn p" onClick={focusSearch}>
                      Nouvelle discussion
                    </button>
                  </div>
                )}
              </div>
            </section>

            {deepLinkError ? (
              <div className="mstate" role="alert" style={{ position: 'absolute', left: 12, right: 12, top: 52, zIndex: 30, background: 'var(--fill3)', borderRadius: 16 }}>
                <b>Discussion indisponible</b>
                <span>{deepLinkError}</span>
              </div>
            ) : null}

            <nav className="lkdv-account-bar" aria-label="Navigation principale">
              <AccountBottomBar renderAs="button" active="messages" badges={unreadTotal > 0 ? { messages: unreadTotal } : {}} />
            </nav>

            {currentUserId ? (
              <ConversationOptionsSheet
                isOpen={optionsConv !== null}
                onClose={() => setOptionsConv(null)}
                conversation={optionsConv}
                currentUserId={currentUserId}
                onRefreshConversations={refreshConversations}
                onReport={(conversation) => {
                  setOptionsConv(null);
                  setReportTarget({
                    userId: conversation.other_member?.id || conversation.created_by || 'unknown',
                    userName: conversation.other_member?.full_name || conversation.title || 'Voyageur LKDV',
                    groupId: conversation.type === 'group' ? conversation.id : undefined,
                    groupName: conversation.type === 'group' ? conversation.title || undefined : undefined,
                  });
                }}
              />
            ) : null}

            {selected && selected.type === 'group' ? (
              <GroupSettingsModal
                isOpen={groupSettingsOpen}
                onClose={() => setGroupSettingsOpen(false)}
                conversation={selected}
                currentUserId={currentUserId ?? ''}
                onRefreshConversations={refreshConversations}
                onLeaveSuccess={() => {
                  setGroupSettingsOpen(false);
                  setSelectedId(null);
                }}
              />
            ) : null}

            <AccountDrawerHost
              open={notifyConv !== null}
              variant="card"
              title="Notifications"
              subtitle={notifyConv ? conversationTitle(notifyConv) : undefined}
              onClose={() => setNotifyConv(null)}
            >
              <div className="mdrawer-actions">
                {MUTE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="mbtn"
                    onClick={async () => {
                      if (!notifyConv || !currentUserId) return;
                      await messagingService.updateMemberPreferences(notifyConv.id, currentUserId, {
                        is_muted: preset.minutes !== null,
                        mute_until:
                          preset.minutes === null
                            ? null
                            : new Date(Date.now() + preset.minutes * 60_000).toISOString(),
                      });
                      setNotifyConv(null);
                      await refreshConversations();
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </AccountDrawerHost>

            <ReportBlockModal
              target={reportTarget}
              onClose={() => setReportTarget(null)}
              onSuccess={() => {
                setReportTarget(null);
                void refreshConversations();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessagesScreen;
