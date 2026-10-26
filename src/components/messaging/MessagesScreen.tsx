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
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useLongPress } from '@/hooks/gestures';
import { createClient } from '@/lib/supabase/client';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useRealtimeMessaging } from '@/features/messaging/hooks/useRealtimeMessaging';
import { messagingService } from '@/features/messaging/services/messagingService';
import { formatConversationTimestamp } from '@/features/messaging/lib/messagingUtils';
import { parseMessageDeepLink, resolveHandleToUserId } from '@/features/messaging/lib/deepLinks';
import { VoiceRecorderBar } from '@/features/messaging/components/VoiceRecorderBar';
import { ComposerMenuSheet } from '@/features/messaging/components/ComposerMenuSheet';
import { ConversationOptionsSheet } from '@/features/messaging/components/ConversationOptionsSheet';
import { ForwardMessageSheet } from '@/features/messaging/components/ForwardMessageSheet';
import { NewConversationModal } from '@/features/messaging/components/NewConversationModal';
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

type FilterId = 'all' | 'direct' | 'group' | 'requests';

const FILTERS: Array<{ id: FilterId; label: string; icon: string }> = [
  { id: 'all', label: 'Toutes', icon: 'M4 6h16v12H4z' },
  { id: 'direct', label: 'Directs', icon: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c.8-3.8 3.8-6 8-6s7.2 2.2 8 6' },
  { id: 'group', label: 'Groupes', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.5-3 2.8-5 6-5s5.5 2 6 5M16 10a2.5 2.5 0 1 0 0-5M17 14c2 .4 3.3 2 3.8 4.4' },
  { id: 'requests', label: 'Demandes', icon: 'M12 3a6 6 0 0 0-6 6v4l-2 4h16l-2-4V9a6 6 0 0 0-6-6Zm-2 17a2 2 0 0 0 4 0' },
];

function conversationTitle(conv: Conversation): string {
  if (conv.title) return conv.title;
  if (conv.other_member?.full_name) return conv.other_member.full_name;
  return conv.type === 'group' ? "Groupe d'expédition" : 'Voyageur LKDV';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function lastPreview(conv: Conversation): string {
  const last = conv.last_message;
  if (!last) return 'Aucun message';
  const prefix = conv.type === 'group' && last.sender_name ? `${last.sender_name.split(' ')[0]} : ` : '';
  switch (last.message_type) {
    case 'image':
      return `${prefix}Photo`;
    case 'audio':
      return `${prefix}Note vocale`;
    case 'gpx':
      return `${prefix}Trace GPX`;
    case 'file':
      return `${prefix}Fichier`;
    case 'product':
      return `${prefix}Équipement`;
    case 'trail':
      return `${prefix}Randonnée`;
    case 'kit':
      return `${prefix}Kit`;
    default:
      return `${prefix}${last.content}`;
  }
}

/* ------------------------------------------------------------------ */
/* Rangée de conversation (gestes conservés : glissement + appui long) */
/* ------------------------------------------------------------------ */

type SwipeAction = 'accept' | 'decline' | 'archive' | 'mute';
const REVEAL = 96;

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
    dxRef.current = snapped ? -REVEAL : 0;
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
      const base = snapped ? -REVEAL : 0;
      dxRef.current = Math.max(-REVEAL, Math.min(base + ddx, 0));
      setDx(dxRef.current);
    }
    longPress.onTouchMove(event);
  };

  const onTouchEnd = () => {
    moved.current = axis.current !== 'none';
    longPress.onTouchEnd();
    if (axis.current === 'x') {
      if (dxRef.current < -REVEAL * 0.4) {
        dxRef.current = -REVEAL;
        setDx(-REVEAL);
        setSnapped(true);
      } else {
        dxRef.current = 0;
        setDx(0);
        setSnapped(false);
      }
    } else {
      dxRef.current = snapped ? -REVEAL : 0;
      setDx(dxRef.current);
    }
    axis.current = 'none';
  };

  return (
    <div className="mfeed-item" style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, flex: 'none', ['--i' as string]: index }}>
      {(dx < 0 || snapped) && onSwipeAction ? (
        <div style={{ position: 'absolute', inset: '0 0 0 auto', display: 'flex', width: REVEAL }}>
          {isPending ? (
            <>
              <button type="button" className="mbtn soft" style={{ flex: 1, height: '100%', borderRadius: 0 }} onClick={() => fire('accept')} aria-label="Accepter la demande">
                <Icon name="check" className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="mbtn" style={{ flex: 1, height: '100%', borderRadius: 0, color: 'var(--bad)' }} onClick={() => fire('decline')} aria-label="Refuser la demande">
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="mbtn" style={{ flex: 1, height: '100%', borderRadius: 0 }} onClick={() => fire('archive')} aria-label={conversation.is_archived ? 'Désarchiver' : 'Archiver'}>
                <Icon name={conversation.is_archived ? 'archive-restore' : 'archive'} className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="mbtn" style={{ flex: 1, height: '100%', borderRadius: 0 }} onClick={() => fire('mute')} aria-label={conversation.is_muted ? 'Réactiver les notifications' : 'Masquer les notifications'}>
                <Icon name={conversation.is_muted ? 'bell' : 'bell-off'} className="size-4" aria-hidden="true" />
              </button>
            </>
          )}
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
  const { conversations, loading, error, refreshConversations } = useConversations(currentUserId ?? undefined);

  const [filter, setFilter] = useState<FilterId>('all');
  // Sens du changement de filtre : la liste glisse dans ce sens (voir CSS).
  const [filterDir, setFilterDir] = useState<'next' | 'prev'>('next');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchMessages, setSearchMessages] = useState<Array<{ id: string; conversation_id: string; content: string; created_at: string }>>([]);
  const [searchPeople, setSearchPeople] = useState<Array<{ id: string; full_name: string; avatar_url?: string | null }>>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [optionsConv, setOptionsConv] = useState<Conversation | null>(null);
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
  }, [filter, selectedId, sheetOpen, conversations.length]);

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

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === 'requests') {
        if (conversation.status !== 'pending') return false;
      } else {
        if (conversation.status === 'pending' || conversation.status === 'rejected') return false;
        if (filter === 'direct' && conversation.type !== 'direct') return false;
        if (filter === 'group' && conversation.type !== 'group') return false;
      }
      if (!text) return true;
      return [conversationTitle(conversation), lastPreview(conversation)].join(' ').toLowerCase().includes(text);
    });
  }, [conversations, filter, query]);

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
    if (action === 'accept') await messagingService.acceptMessageRequest(conversation.id, currentUserId);
    else if (action === 'decline') await messagingService.declineMessageRequest(conversation.id, currentUserId);
    else if (action === 'archive') await messagingService.updateMemberPreferences(conversation.id, currentUserId, { is_archived: !conversation.is_archived });
    else await messagingService.updateMemberPreferences(conversation.id, currentUserId, { is_muted: !conversation.is_muted });
    await refreshConversations();
  };

  /** Toute surface ouverte (drawer, feuille, modale) sort la barre basse :
   *  c'est l'état de la grammaire, pas un bricolage par composant. */
  const surfaceOpen =
    sheetOpen || searchOpen || newOpen || optionsConv !== null || groupSettingsOpen || reportTarget !== null;
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

  // Glissement vertical du tiroir : il suit le doigt (résistance après 120 px),
  // puis se ferme au-delà de 110 px OU d'une vitesse de 0,55 px/ms — les deux
  // seuils des feuilles iOS, pour que le geste court et vif marche aussi.
  useEffect(() => {
    if (!sheetOpen) return;
    const wrap = [...document.querySelectorAll('.sw-wrap')].find(
      (node) => node.getAttribute('data-det') === 'open',
    );
    const sheet = wrap?.querySelector<HTMLElement>('.sheet');
    const handle = wrap?.querySelector<HTMLElement>('.sh-h');
    if (!sheet || !handle) return;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let active = false;
    const rubber = (value: number) => (value < 120 ? value : 120 + (value - 120) * 0.55);
    const onDown = (event: PointerEvent) => {
      active = true;
      startY = event.clientY;
      startT = event.timeStamp;
      dy = 0;
      sheet.style.transition = 'none';
      sheet.style.willChange = 'transform';
      handle.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!active) return;
      dy = rubber(Math.max(0, event.clientY - startY));
      sheet.style.transform = `translateY(${dy}px)`;
      sheet.style.opacity = String(Math.max(0.6, 1 - dy / 900));
    };
    const onUp = (event: PointerEvent) => {
      if (!active) return;
      active = false;
      const speed = dy / Math.max(1, event.timeStamp - startT);
      sheet.style.transition = 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s';
      sheet.style.transform = '';
      sheet.style.opacity = '';
      sheet.style.willChange = '';
      if (dy > 110 || speed > 0.55) setSheetOpen(false);
    };
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
    return () => {
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
  }, [sheetOpen]);

  // Volet de conversation : le doigt le tire vers le bas pour revenir à la
  // liste (le glissement vers le haut ouvre la feuille plein écran).
  const paneRef = useRef<HTMLDivElement>(null);
  const paneDrag = useRef({ y: 0, dy: 0, raw: 0, active: false, captured: false, t: 0 });
  const closingRef = useRef(false);

  const closePane = () => {
    if (closingRef.current) return;
    const el = paneRef.current;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce) {
      setSelectedId(null);
      return;
    }
    closingRef.current = true;
    el.classList.remove('dragging', 'settling');
    el.classList.add('out');
    window.setTimeout(() => {
      closingRef.current = false;
      setSelectedId(null);
    }, 210);
  };

  const paneDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    // Pas de capture au pointerdown : elle retirerait le clic aux boutons de
    // l'en-tête. On ne capture qu'une fois le geste engagé (6 px).
    paneDrag.current = { y: event.clientY, dy: 0, raw: 0, active: true, captured: false, t: event.timeStamp };
  };

  const paneMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = paneDrag.current;
    if (!drag.active) return;
    const raw = event.clientY - drag.y;
    if (!drag.captured) {
      if (Math.abs(raw) < 6) return;
      drag.captured = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      paneRef.current?.classList.add('dragging');
    }
    // Vers le bas : suit le doigt. Vers le haut : résiste (le geste sert au tiroir).
    const dy = raw > 0 ? raw : raw * 0.5;
    paneDrag.current.dy = dy;
    paneDrag.current.raw = raw;
    const el = paneRef.current;
    if (!el) return;
    el.style.transform = `translateY(${dy}px)`;
    el.style.opacity = String(Math.max(0.45, 1 - Math.max(0, dy) / 460));
  };

  const paneUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!paneDrag.current.active) return;
    const started = paneDrag.current.captured;
    const dy = paneDrag.current.dy;
    const raw = paneDrag.current.raw;
    const speed = dy / Math.max(1, event.timeStamp - paneDrag.current.t);
    paneDrag.current = { y: 0, dy: 0, raw: 0, active: false, captured: false, t: 0 };
    if (!started) return; // simple tap : les boutons de l'en-tête gardent leur clic
    const el = paneRef.current;
    if (dy > 84 || speed > 0.7) {
      haptic('light');
      if (el) {
        el.style.transform = '';
        el.style.opacity = '';
        el.classList.remove('dragging');
      }
      closePane();
      return;
    }
    if (raw < -28) haptic('light');
    if (el) {
      el.classList.remove('dragging');
      el.classList.add('settling');
      el.style.transform = '';
      el.style.opacity = '';
      window.setTimeout(() => el.classList.remove('settling'), 420);
    }
    // Le seuil se juge sur le déplacement réel, pas sur la valeur amortie.
    if (raw < -28) setSheetOpen(true);
  };

  const guest = !currentUserId;

  return (
    <div className={`lkdv-compte-v8 lkdv-pays lkdv-messages${surfaceOpen ? ' sheet-open' : ''}`}>
      <h1 className="sr-only">Messagerie</h1>
      <div className="stage">
        <div className="pwrap">
          <div className={`phone hasnext${selected ? ' mapbig' : ''}${surfaceOpen ? ' sheet-open' : ''}`} id="phone" ref={phone}>
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
                  {unreadTotal > 0 ? <i className="tb-badge">{unreadTotal > 99 ? '99+' : unreadTotal}</i> : null}
                </button>
                <div className="ig-top-r">
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Nouvelle discussion" onClick={() => setNewOpen(true)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h10a2.5 2.5 0 0 0 2.5-2.5V13" />
                      <path d="M17.4 3.6a2.2 2.2 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Rechercher une discussion" onClick={() => setSearchOpen(true)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="10.8" cy="10.8" r="6.3" />
                      <path d="m15.6 15.6 4 4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="lg gbtn ig-top-btn"
                    aria-label={`Demandes de message${pendingCount ? ` : ${pendingCount} en attente` : ''}`}
                    onClick={() => changeFilter('requests')}
                    aria-pressed={filter === 'requests'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.1 1.6 5.6 1.6 5.6H4.6s1.6-1.5 1.6-5.6Z" />
                      <path d="M10 18.2a2 2 0 0 0 4 0" />
                    </svg>
                    {pendingCount > 0 ? <i className="tb-badge">{pendingCount}</i> : null}
                  </button>
                </div>
              </div>

              <div className="card cs" id="card">
                <div className="card-scroll">
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
                          <button type="button" className="mbtn p" onClick={() => setNewOpen(true)}>
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
                  <div
                    className="mpane in"
                    ref={paneRef}
                    data-conversation={selected.id}
                    onAnimationEnd={(event) => {
                      if (event.animationName === 'mpane-in') {
                        event.currentTarget.dataset.entered = 'true';
                      }
                    }}
                  >
                    <div
                      className="mpane-h"
                      onPointerDown={paneDown}
                      onPointerMove={paneMove}
                      onPointerUp={paneUp}
                      onPointerCancel={paneUp}
                    >
                      <button
                        type="button"
                        className="mpane-av"
                        onClick={() => {
                          if (selected.type === 'group') setOptionsConv(selected);
                          else if (selected.other_member?.id) router.push(`/profil/${selected.other_member.id}`);
                        }}
                        aria-label={selected.type === 'group' ? 'Options du groupe' : 'Voir le profil'}
                      >
                        {selected.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                          <img src={selected.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          initials(conversationTitle(selected))
                        )}
                      </button>
                      <div className="mpane-t">
                        <b>{conversationTitle(selected)}</b>
                        <small>{selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'}</small>
                      </div>
                      <span style={{ display: 'flex', gap: 5 }}>
                        <button type="button" className="lg gbtn" style={{ width: 34, height: 34 }} onClick={() => setSheetOpen(true)} aria-label="Ouvrir la conversation en grand">
                          <Icon name="arrow-up-right" className="size-4" aria-hidden="true" />
                        </button>
                        <button type="button" className="lg gbtn" style={{ width: 34, height: 34 }} onClick={closePane} aria-label="Fermer la conversation">
                          <Icon name="x" className="size-4" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
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
                    <button type="button" className="mbtn p" onClick={() => setNewOpen(true)}>
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

            <AccountDrawerHost open={searchOpen} title="Rechercher" subtitle="Discussions, personnes, messages" onClose={() => setSearchOpen(false)}>
              <input
                className="mfield"
                style={{ borderRadius: 12, minHeight: 36, height: 36, flex: 'none', marginBottom: 8 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher une discussion, une personne ou un message"
                autoFocus
              />
              {query.trim().length >= 2 ? (
                <>
                  {searchPeople.length > 0 ? (
                    <div>
                      <div className="s2" style={{ font: '600 10px var(--sf)', color: 'var(--label2)', textTransform: 'none', margin: '2px 0 4px' }}>
                        Personnes
                      </div>
                      {searchPeople.map((person) => (
                        <div className="li" key={person.id}>
                          <div>
                            <div className="ttl">{person.full_name}</div>
                            <div className="s2">Démarrer une discussion</div>
                          </div>
                          <button
                            type="button"
                            className="mbtn"
                            onClick={async () => {
                              const id = await messagingService.getOrCreateDirectConversation(person.id, currentUserId as string);
                              if (!id) return;
                              await refreshConversations();
                              setSelectedId(id);
                              setSearchOpen(false);
                            }}
                          >
                            Écrire
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {searchMessages.length > 0 ? (
                    <div>
                      <div className="s2" style={{ font: '600 10px var(--sf)', color: 'var(--label2)', margin: '6px 0 4px' }}>
                        Messages
                      </div>
                      {searchMessages.map((message) => (
                        <button
                          key={message.id}
                          type="button"
                          className="li nt"
                          style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedId(message.conversation_id);
                            setSearchOpen(false);
                            setSheetOpen(true);
                          }}
                        >
                          <div>
                            <div className="s2" style={{ color: 'var(--label)' }}>
                              {message.content.length > 80 ? `${message.content.slice(0, 80)}…` : message.content}
                            </div>
                            <div className="s2">{new Date(message.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {searchPeople.length === 0 && searchMessages.length === 0 ? <div className="mstate">Aucun résultat.</div> : null}
                </>
              ) : (
                <div className="mstate">Deux caractères suffisent pour chercher.</div>
              )}
            </AccountDrawerHost>

            {selected ? (
              <AccountDrawerHost
                open={sheetOpen}
                title={conversationTitle(selected)}
                subtitle={selected.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV'}
                onClose={() => setSheetOpen(false)}
              >
                <div className="mdrawer">
                  <div className="mdrawer-actions">
                    <button type="button" className="mbtn" onClick={() => setOptionsConv(selected)}>
                      Options
                    </button>
                    {selected.type === 'group' ? (
                      <button type="button" className="mbtn" onClick={() => setGroupSettingsOpen(true)}>
                        Gérer le groupe
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`mbtn${hideReads ? '' : ' soft'}`}
                      aria-pressed={hideReads}
                      onClick={() => {
                        const next = !hideReads;
                        setHideReads(next);
                        try {
                          window.localStorage.setItem('lkdv:messages:hide-reads', next ? '1' : '0');
                        } catch {
                          /* stockage local indisponible */
                        }
                      }}
                    >
                      Accusés&nbsp;: {hideReads ? 'masqués' : 'visibles'}
                    </button>
                    <button
                      type="button"
                      className={`mbtn${notifyPref ? ' soft' : ''}`}
                      aria-pressed={notifyPref}
                      onClick={async () => {
                        if (notifyPref) {
                          setNotifyPref(false);
                          try {
                            window.localStorage.setItem('lkdv:messages:notify', '0');
                          } catch {
                            /* ignore */
                          }
                          return;
                        }
                        try {
                          const permission = await Notification.requestPermission();
                          if (permission !== 'granted') return;
                          setNotifyPref(true);
                          window.localStorage.setItem('lkdv:messages:notify', '1');
                        } catch {
                          /* API indisponible */
                        }
                      }}
                    >
                      Notifications&nbsp;: {notifyPref ? 'activées' : 'désactivées'}
                    </button>
                    <button
                      type="button"
                      className="mbtn"
                      onClick={() => {
                        setSheetOpen(false);
                        setSelectedId(null);
                      }}
                    >
                      Quitter
                    </button>
                  </div>
                  {sheetOpen ? <MessageThread
                    key={`drawer-${selected.id}`}
                    conversation={selected}
                    currentUserId={currentUserId as string}
                    currentUserProfile={currentUserProfile}
                    members={members}
                    hideReads={hideReads}
                    compact={false}
                  /> : null}
                </div>
              </AccountDrawerHost>
            ) : null}

            <NewConversationModal
              isOpen={newOpen}
              onClose={() => setNewOpen(false)}
              currentUserId={currentUserId ?? ''}
              onConversationCreated={async (id) => {
                await refreshConversations();
                setSelectedId(id);
                setNewOpen(false);
              }}
            />

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
                  setSheetOpen(false);
                  setSelectedId(null);
                }}
              />
            ) : null}

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
