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
import { VoiceRecorderBar } from '@/features/messaging/components/VoiceRecorderBar';
import { ComposerMenuSheet } from '@/features/messaging/components/ComposerMenuSheet';
import { ConversationOptionsSheet } from '@/features/messaging/components/ConversationOptionsSheet';
import { ForwardMessageSheet } from '@/features/messaging/components/ForwardMessageSheet';
import { NewConversationModal } from '@/features/messaging/components/NewConversationModal';
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
type ViewId = 'list' | 'grid';

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
  onSelect,
  onLongPress,
  onSwipeAction,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: (conv: Conversation) => void;
  onLongPress?: (conv: Conversation) => void;
  onSwipeAction?: (conv: Conversation, action: SwipeAction) => void;
}) {
  const { haptic } = useHapticFeedback();
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
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, flex: 'none' }}>
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
        </span>
        <span style={{ minWidth: 0 }}>
          <b>
            {title}
            {conversation.is_muted ? <Icon name="bell-off" className="ml-1 inline size-3" aria-hidden="true" /> : null}
            {isPending ? <span className="mrow-pending">Demande</span> : null}
          </b>
          <small>{lastPreview(conversation)}</small>
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
  compact,
  focusMessageId,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  members: ConversationMember[];
  compact: boolean;
  focusMessageId?: string | null;
}) {
  const { haptic } = useHapticFeedback();
  const { messages, loading, error, hasMore, loadingEarlier, loadEarlier, retryMessage, toggleReaction } =
    useMessages(conversation.id, currentUserId, currentUserProfile);
  const { typingUserNames, sendTypingSignal } = useRealtimeMessaging(conversation.id, currentUserId, currentUserProfile?.full_name);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, conversation.id]);

  useEffect(() => {
    if (!focusMessageId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`grammar-msg-${focusMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messages.length]);

  const readBy = (message: Message) => {
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
      <div className="mthread" ref={scroller} aria-label={`Fil de discussion avec ${conversationTitle(conversation)}`}>
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
                    aria-label="Actions du message"
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

        {typingUserNames.length > 0 ? <div className="mday">{typingUserNames.join(', ')} écrit…</div> : null}
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
  compact,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  onTyping?: () => void;
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
    await messagingService.sendMessage(conversation.id, currentUserId, text, 'text', replyTo?.id || undefined);
    onCancelReply();
    setSending(false);
  };

  const upload = async (file: File) => {
    const isGpx = file.name.toLowerCase().endsWith('.gpx') || file.type.includes('gpx');
    const url = await messagingService.uploadAttachment(conversation.id, file);
    if (!url) return;
    await messagingService.sendMessage(conversation.id, currentUserId, url, isGpx ? 'gpx' : file.type.startsWith('image/') ? 'image' : 'file');
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
        onSendProduct={(meta: ProductMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.name, 'product', undefined, meta as unknown as Record<string, unknown>)}
        onSendTrail={(meta: TrailMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.name, 'trail', undefined, meta as unknown as Record<string, unknown>)}
        onSendKit={(meta: KitMessageMeta) => void messagingService.sendMessage(conversation.id, currentUserId, meta.kit_name, 'kit', undefined, meta as unknown as Record<string, unknown>)}
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
  const [view, setView] = useState<ViewId>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchMessages, setSearchMessages] = useState<Array<{ id: string; conversation_id: string; content: string; created_at: string }>>([]);
  const [searchPeople, setSearchPeople] = useState<Array<{ id: string; full_name: string; avatar_url?: string | null }>>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [optionsConv, setOptionsConv] = useState<Conversation | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const handledDest = useRef<string | null>(null);
  const handledConv = useRef(false);

  useEffect(() => {
    const stop = initLiquidLenses(phone.current);
    return () => {
      if (typeof stop === 'function') stop();
    };
  }, []);
  useEffect(() => {
    refreshLiquidLenses(phone.current);
  }, [view, filter, selectedId, sheetOpen, conversations.length]);

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
    const target = new URLSearchParams(window.location.search).get('dest');
    if (!target || handledDest.current === target) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target) || target === currentUserId) {
      setDeepLinkError('Destinataire invalide.');
      handledDest.current = target;
      return;
    }
    handledDest.current = target;
    let cancelled = false;
    const run = async () => {
      try {
        const supabase = createClient();
        const [blockedByMe, blockedMe] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId).eq('blocked_id', target).maybeSingle(),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id', currentUserId).eq('blocker_id', target).maybeSingle(),
        ]);
        if (blockedByMe.error || blockedMe.error || blockedByMe.data || blockedMe.data) throw new Error('blocked');
        const id = await messagingService.getOrCreateDirectConversation(target, currentUserId);
        if (!id || cancelled) return;
        await refreshConversations();
        if (cancelled) return;
        setSelectedId(id);
        setDeepLinkError(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('dest');
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

  const guest = !currentUserId;
  const headerTitle = selected ? conversationTitle(selected) : 'Messages';
  const headerAvatar = selected?.avatar_url ?? currentUserProfile?.avatar_url ?? null;

  return (
    <div className={`lkdv-compte-v8 lkdv-pays lkdv-messages${sheetOpen ? ' sheet-open' : ''}`}>
      <h1 className="sr-only">Messagerie</h1>
      <div className="stage">
        <div className="pwrap">
          <div className={`phone hasnext${sheetOpen ? ' sheet-open' : ''}${selectedId ? ' chat-open' : ''}`} id="phone" ref={phone}>
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
                    <Icon name="plus" className="size-[18px]" />
                  </button>
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Rechercher une discussion" onClick={() => setSearchOpen(true)}>
                    <Icon name="search" className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    className="lg gbtn ig-top-btn"
                    aria-label={`Demandes de message${pendingCount ? ` : ${pendingCount} en attente` : ''}`}
                    onClick={() => setFilter('requests')}
                    aria-pressed={filter === 'requests'}
                  >
                    <Icon name="bell" className="size-[18px]" />
                    {pendingCount > 0 ? <i className="tb-badge">{pendingCount}</i> : null}
                  </button>
                </div>
              </div>

              <div className="card cs" id="card">
                <div className="card-scroll">
                  <div className="ig-header">
                    <div className="ig-left">
                      <span className="ig-avi-wrap">
                        <span className="ig-avi-in">
                          {headerAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                            <img src={headerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ font: '700 20px var(--sf)', color: 'var(--tint)' }}>{initials(headerTitle)}</span>
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="ig-right">
                      <div className="ig-stats" role="group" aria-label="Chiffres de la messagerie">
                        <button type="button" className="ig-stat" onClick={() => setFilter('all')}>
                          <b className="num">{conversations.filter((conversation) => conversation.status !== 'pending').length}</b>
                          <span>discussions</span>
                        </button>
                        <button type="button" className="ig-stat" onClick={() => setFilter('all')}>
                          <b className="num">{unreadTotal}</b>
                          <span>non lus</span>
                        </button>
                        <button type="button" className="ig-stat" onClick={() => setFilter('requests')}>
                          <b className="num">{pendingCount}</b>
                          <span>demandes</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="ig-bio">
                    <div className="ig-bio-top">
                      <b className="ig-bio-cc">{headerTitle}</b>
                      <span className="ig-bio-dot" aria-hidden="true">·</span>
                      <span className="ig-bio-stats">
                        {selected
                          ? selected.type === 'group'
                            ? `${members.length || 1} membres`
                            : 'Membre LKDV'
                          : `${unreadTotal} message${unreadTotal > 1 ? 's' : ''} non lu${unreadTotal > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <p className="ig-bio-text">{selected ? lastPreview(selected) : 'Vos échanges avec la communauté.'}</p>
                  </div>

                  <div className="ig-hl-row" role="group" aria-label="Filtrer les discussions">
                    {FILTERS.map((item) => {
                      const count = item.id === 'requests' ? pendingCount : item.id === 'all' ? conversations.length : conversations.filter((conversation) => conversation.type === item.id).length;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`ig-hl${filter === item.id ? ' live' : ''}`}
                          aria-pressed={filter === item.id}
                          onClick={() => {
                            haptic('light');
                            setFilter(item.id);
                          }}
                        >
                          <span className="ig-hl-ring">
                            <span className="ig-hl-in">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tint)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d={item.icon} />
                              </svg>
                            </span>
                          </span>
                          <span>
                            {item.label}
                            {count > 0 && item.id === 'requests' ? ` ${count}` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="ig-grid-wrap">
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
                    ) : view === 'list' ? (
                      visible.map((conversation) => (
                        <ConversationFeedRow
                          key={conversation.id}
                          conversation={conversation}
                          selected={conversation.id === selectedId}
                          onSelect={open}
                          onLongPress={currentUserId ? setOptionsConv : undefined}
                          onSwipeAction={currentUserId ? swipe : undefined}
                        />
                      ))
                    ) : (
                      <div className="ig-grid" role="list" aria-label="Discussions (grille)">
                        {visible.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            role="listitem"
                            className="igt"
                            onClick={() => open(conversation)}
                            aria-label={conversationTitle(conversation)}
                          >
                            {conversation.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                              <img src={conversation.avatar_url} alt="" loading="lazy" />
                            ) : (
                              <span style={{ font: '700 15px var(--sf)', color: 'var(--tint)' }}>{initials(conversationTitle(conversation))}</span>
                            )}
                            <b>{conversationTitle(conversation)}</b>
                            {conversation.unread_count > 0 ? <span className="mrow-badge">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="ig-tabs-float">
                  <div className="ig-tabs" role="tablist" aria-label="Affichage des discussions">
                    <span className="ig-th" style={{ transform: view === 'list' ? 'translateX(0%)' : 'translateX(100%)' }} aria-hidden="true" />
                    <button type="button" role="tab" aria-selected={view === 'list'} aria-label="Liste" onClick={() => setView('list')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <button type="button" role="tab" aria-selected={view === 'grid'} aria-label="Grille" onClick={() => setView('grid')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mapzone" aria-label="Conversation">
              <div className="map" style={{ display: 'flex', flexDirection: 'column', background: 'var(--fill3)' }}>
                {selected ? (
                  <>
                    <div className="mpane-h">
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
                        <button type="button" className="lg gbtn" style={{ width: 34, height: 34 }} onClick={() => setSelectedId(null)} aria-label="Fermer la conversation">
                          <Icon name="x" className="size-4" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                    <MessageThread
                      key={selected.id}
                      conversation={selected}
                      currentUserId={currentUserId as string}
                      currentUserProfile={currentUserProfile}
                      members={members}
                      compact
                    />
                  </>
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
                style={{ borderRadius: 12, minHeight: 36, marginBottom: 8 }}
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
                  <div style={{ display: 'flex', gap: 6, padding: '0 0 4px' }}>
                    <button type="button" className="mbtn" onClick={() => setOptionsConv(selected)}>
                      Options
                    </button>
                    <button
                      type="button"
                      className="mbtn"
                      onClick={() => {
                        setSheetOpen(false);
                        setSelectedId(null);
                      }}
                    >
                      Fermer
                    </button>
                  </div>
                  <MessageThread
                    key={`drawer-${selected.id}`}
                    conversation={selected}
                    currentUserId={currentUserId as string}
                    currentUserProfile={currentUserProfile}
                    members={members}
                    compact={false}
                  />
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
