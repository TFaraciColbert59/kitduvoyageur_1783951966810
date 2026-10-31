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

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/compte/compte-v8.css';
import '@/components/compte/compte-apple-hig.css';
import '@/design/account/account-grammar-pins.css';
import '@/components/messaging/messages-grammar.css';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import { SubCapsuleTabs } from '@/components/ui/CapsuleTabs';
import { NotificationBell } from '@/components/ui/NotificationBell';
import Icon from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import type { ReportTarget } from '@/components/ui/ReportBlockModal';
import { lkvConfirm } from '@/components/ui/dialogs';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createClient } from '@/lib/supabase/client';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useRealtimeMessaging } from '@/features/messaging/hooks/useRealtimeMessaging';
import { messagingService } from '@/features/messaging/services/messagingService';
import { formatConversationTimestamp } from '@/features/messaging/lib/messagingUtils';
import { useResolvedAttachmentUrl } from '@/features/messaging/hooks/useAttachmentUrl';
import { SharedPostEmbed } from '@/features/messaging/components/SharedPostEmbed';
import { AttachmentDrawer } from '@/features/messaging/components/AttachmentDrawer';
import { GpxThumb } from '@/features/messaging/components/GpxThumb';
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
// Surcouches ouvertes à la demande : hors du bundle initial (hydratation plus
// rapide), chargées au premier clic qui les concerne.
const ReportBlockModal = dynamic(() => import('@/components/ui/ReportBlockModal'), { ssr: false });
const VoiceRecorderBar = dynamic(
  () => import('@/features/messaging/components/VoiceRecorderBar').then((m) => m.VoiceRecorderBar),
  { ssr: false }
);
const ComposerMenuSheet = dynamic(
  () => import('@/features/messaging/components/ComposerMenuSheet').then((m) => m.ComposerMenuSheet),
  { ssr: false }
);
const ConversationOptionsSheet = dynamic(
  () => import('@/features/messaging/components/ConversationOptionsSheet').then((m) => m.ConversationOptionsSheet),
  { ssr: false }
);
const ForwardMessageSheet = dynamic(
  () => import('@/features/messaging/components/ForwardMessageSheet').then((m) => m.ForwardMessageSheet),
  { ssr: false }
);
const GroupSettingsModal = dynamic(
  () => import('@/features/messaging/components/GroupSettingsModal').then((m) => m.GroupSettingsModal),
  { ssr: false }
);
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
  const [dragging, setDragging] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const moved = useRef(false);
  const suppress = useRef(false);

  // Geste de rangée : pointeurs React (suivent le doigt, pas de dépendance à
  // un nœud DOM capturé) + appui long. Les actions vivent à DROITE : on tire
  // la rangée vers la gauche pour les révéler.
  const gesture = useRef({ startX: 0, startY: 0, dx: 0, axis: 'none' as 'none' | 'x' | 'y', active: false, hapted: false });
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLongPress = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  useEffect(() => stopLongPress, []);

  const onRowPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      dx: openRef.current ? -SWIPE_REVEAL : 0,
      axis: 'none',
      active: true,
      hapted: false,
    };
    setDragging(true);
    stopLongPress();
    longTimer.current = setTimeout(() => {
      longTimer.current = null;
      if (gesture.current.axis === 'none' && onLongPress) {
        suppress.current = true;
        haptic('medium');
        onLongPress(conversation);
      }
    }, 450);
  };

  const onRowPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const ddx = event.clientX - g.startX;
    const ddy = event.clientY - g.startY;
    if (g.axis === 'none' && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      g.axis = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
      if (g.axis === 'x') {
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          /* pointeur déjà relâché (annulation système) : le geste continue */
        }
      }
    }
    if (g.axis === 'x') {
      stopLongPress();
      g.dx = clampSwipe(ddx, openRef.current ? -SWIPE_REVEAL : 0);
      setDx(g.dx);
      // Micro-retour au franchissement du seuil d'ouverture.
      const armed = g.axis === 'x' && Math.abs(g.dx) > SWIPE_REVEAL * 0.4;
      if (armed && !g.hapted) {
        g.hapted = true;
        haptic('light');
      } else if (!armed && g.hapted) {
        g.hapted = false;
      }
    } else if (g.axis === 'y') {
      stopLongPress();
    }
  };

  const onRowPointerUp = () => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    stopLongPress();
    setDragging(false);
    if (g.axis === 'x') {
      const end = resolveSwipeEnd(g.dx);
      g.dx = end.dx;
      openRef.current = end.open;
      setDx(end.dx);
      setSnapped(end.open);
      moved.current = true;
    }
    g.axis = 'none';
  };

  const title = conversationTitle(conversation);
  const unread = conversation.unread_count || 0;
  const isPending = conversation.status === 'pending';
  const avatar = conversation.avatar_url;

  const fire = (action: SwipeAction) => {
    haptic('medium');
    openRef.current = false;
    setDx(0);
    setSnapped(false);
    onSwipeAction?.(conversation, action);
  };

  return (
    <div className="mfeed-item" style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, flex: 'none', ['--i' as string]: index }}>
      {(dx < 0 || snapped) && onSwipeAction ? (
        <div className="mrow-actions" style={{ width: SWIPE_REVEAL }}>
          <button
            type="button"
            className="mrow-act danger"
            onClick={() => fire('delete')}
            aria-label="Supprimer la conversation"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M10 11v6M14 11v6" />
              <path d="M6 7l.9 12.1A2 2 0 0 0 8.9 21h6.2a2 2 0 0 0 2-1.9L18 7" />
              <path d="M9 7V5.2A2.2 2.2 0 0 1 11.2 3h1.6A2.2 2.2 0 0 1 15 5.2V7" />
            </svg>
          </button>
          <button
            type="button"
            className="mrow-act"
            onClick={() => fire('notify')}
            aria-label="Gérer les notifications"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.1 1.6 5.6 1.6 5.6H4.6s1.6-1.5 1.6-5.6Z" />
              <path d="M10 18.2a2 2 0 0 0 4 0" />
            </svg>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="ig-feed-row"
        aria-current={selected ? 'true' : undefined}
        ref={rowRef}
        aria-label={`${title}${unread > 0 ? `, ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}` : ''}`}
        onPointerDown={onRowPointerDown}
        onPointerMove={onRowPointerMove}
        onPointerUp={onRowPointerUp}
        onPointerCancel={onRowPointerUp}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (suppress.current || openRef.current) {
            suppress.current = false;
            if (openRef.current) {
              openRef.current = false;
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
          transition: dragging
            ? 'none'
            : 'transform .3s var(--ease-spring)',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span className="fa" aria-hidden="true">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar distant de la conversation
            <img src={avatar} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={40} height={40} />
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

const ConversationFeedRowMemo = React.memo(ConversationFeedRow);

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

/** Une pièce jointe est stockée comme CLÉ durable : on résout l'URL lisible
 *  avant de peindre (sinon la bulle reste vide). */
function AttachmentImage({ content }: { content: string }) {
  const url = useResolvedAttachmentUrl(content);
  if (!url) {
    return <span className="bub-img-skeleton" aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pièce jointe résolue
    <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ maxWidth: '100%', display: 'block' }} />
  );
}

function MessageThread({
  conversation,
  currentUserId,
  currentUserProfile,
  members,
  hideReads = false,
  compact,
  focusMessageId,
  onOpenShareMenu,
  onOpenPost,
  onOpenAttachment,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  members: ConversationMember[];
  /** Accusés de lecture masqués (préférence locale). */
  hideReads?: boolean;
  compact: boolean;
  focusMessageId?: string | null;
  /** Ouvre la feuille « Partager » au niveau de l'écran (sinon elle est
   *  rognée par l'overflow de la carte). */
  onOpenShareMenu?: () => void;
  /** Ouvre la publication partagée dans le fil Communauté. */
  onOpenPost?: (postId: string) => void;
  /** Ouvre un partage (kit, GPX, randonnée, équipement, vocal, fichier). */
  onOpenAttachment?: (message: Message) => void;
}) {
  const { haptic } = useHapticFeedback();
  const { messages, loading, error, hasMore, loadingEarlier, loadEarlier, retryMessage, toggleReaction, sendMessage: sendThreadMessage, refreshMessages } =
    useMessages(conversation.id, currentUserId, currentUserProfile);
  const { typingUserNames, sendTypingSignal } = useRealtimeMessaging(conversation.id, currentUserId, currentUserProfile?.full_name);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

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
                {message.message_type === 'post' ? (
                  <div className="mpost-embed-row">
                    <SharedPostEmbed
                      postId={String(message.metadata?.post_id ?? message.content)}
                      currentUserId={currentUserId}
                      currentUserProfile={currentUserProfile}
                    />
                  </div>
                ) : (
                <div className={`mstack${mine ? ' mine' : ''}`}>
                  {conversation.type === 'group' && !mine && !sameAsPrev ? (
                    <span className="msender">{message.sender_profile?.full_name ?? 'Voyageur'}</span>
                  ) : null}

                  <button
                    type="button"
                    className={`bub ${mine ? 'mine' : 'other'}${sameAsPrev && sameAsNext ? ' mid' : ''} tap`}
                    onPointerDown={(event) => {
                      pressStart.current = { x: event.clientX, y: event.clientY };
                      if (pressTimer.current) clearTimeout(pressTimer.current);
                      pressTimer.current = setTimeout(() => {
                        haptic('medium');
                        setOpenMenu((current) => (current === message.id ? null : message.id));
                      }, 460);
                    }}
                    onPointerMove={(event) => {
                      const start = pressStart.current;
                      if (!start || !pressTimer.current) return;
                      if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) {
                        clearTimeout(pressTimer.current);
                        pressTimer.current = null;
                      }
                    }}
                    onPointerUp={() => {
                      if (pressTimer.current) clearTimeout(pressTimer.current);
                      pressTimer.current = null;
                    }}
                    onPointerCancel={() => {
                      if (pressTimer.current) clearTimeout(pressTimer.current);
                      pressTimer.current = null;
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpenMenu((current) => (current === message.id ? null : message.id));
                      }
                    }}
                    aria-label={`Message de ${mine ? 'vous' : message.sender_profile?.full_name ?? 'un voyageur'}, ${timeLabel(message.created_at)}. Appui long pour les actions.`}
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
                        <AttachmentImage content={message.content} />
                      </span>
                    ) : message.message_type === 'product' ? (
                      <span
                        className="mcard"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachment?.(message);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenAttachment?.(message);
                          }
                        }}
                      >
                        {typeof message.metadata?.photo_url === 'string' ? (
                          // eslint-disable-next-line @next/next/no-img-element -- vignette distante
                          <img className="mcard-img" src={message.metadata.photo_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="mcard-ico" aria-hidden="true">
                            <Icon name="backpack" className="size-4" />
                          </span>
                        )}
                        <span className="mcard-txt">
                          <b>{String(message.metadata?.name || 'Équipement')}</b>
                          <small>
                            {typeof message.metadata?.price_cents === 'number'
                              ? `${(message.metadata.price_cents / 100).toFixed(2).replace('.', ',')} €`
                              : 'Équipement partagé'}
                          </small>
                        </span>
                      </span>
                    ) : message.message_type === 'trail' ? (
                      <span
                        className="mcard"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachment?.(message);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenAttachment?.(message);
                          }
                        }}
                      >
                        <span className="mcard-ico" aria-hidden="true">
                          <Icon name="route" className="size-4" />
                        </span>
                        <span className="mcard-txt">
                          <b>{String(message.metadata?.name || 'Randonnée')}</b>
                          <small>
                            {[
                              typeof message.metadata?.distance_km === 'number'
                                ? `${message.metadata.distance_km.toFixed(1)} km`
                                : null,
                              typeof message.metadata?.elevation_gain_m === 'number'
                                ? `+${Math.round(message.metadata.elevation_gain_m)} m`
                                : null,
                              typeof message.metadata?.region === 'string' ? message.metadata.region : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Trace partagée'}
                          </small>
                        </span>
                      </span>
                    ) : message.message_type === 'kit' ? (
                      <span
                        className="mcard mcard-kit"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachment?.(message);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenAttachment?.(message);
                          }
                        }}
                      >
                        <span className="mcard-tile" aria-hidden="true">
                          <Icon name="layers" className="size-4" />
                        </span>
                        <span className="mcard-txt">
                          <b>{String(message.metadata?.kit_name || 'Kit partagé')}</b>
                          <small>
                            {typeof message.metadata?.items_count === 'number'
                              ? `Kit de matériel · ${message.metadata.items_count} élément${message.metadata.items_count > 1 ? 's' : ''}`
                              : 'Kit de matériel'}
                          </small>
                        </span>
                        <Icon name="chevron-right" className="size-3.5 mcard-chevron" aria-hidden="true" />
                      </span>
                    ) : message.message_type === 'audio' ? (
                      <span
                        className="mcard"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachment?.(message);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenAttachment?.(message);
                          }
                        }}
                      >
                        <span className="mcard-ico" aria-hidden="true">
                          <Icon name="mic" className="size-4" />
                        </span>
                        <span className="mcard-txt">
                          <b>Note vocale</b>
                          <small>Message vocal partagé</small>
                        </span>
                      </span>
                    ) : message.message_type === 'gpx' || message.message_type === 'file' || message.message_type === 'video' ? (
                      <span
                        className="mcard"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAttachment?.(message);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenAttachment?.(message);
                          }
                        }}
                      >
                        {message.message_type === 'gpx' ? (
                          <GpxThumb content={message.content} />
                        ) : (
                          <span className="mcard-ico" aria-hidden="true">
                            <Icon name={message.message_type === 'video' ? 'play' : 'paperclip'} className="size-4" />
                          </span>
                        )}
                        <span className="mcard-txt">
                          <b>
                            {message.message_type === 'gpx'
                              ? 'Trace GPX'
                              : message.message_type === 'video'
                                ? 'Vidéo'
                                : 'Fichier'}
                          </b>
                          <small>
                            {message.message_type === 'gpx'
                              ? 'Toucher pour voir la carte'
                              : message.content.split('/').pop()?.slice(0, 42) || 'Pièce jointe'}
                          </small>
                        </span>
                        <Icon name="chevron-right" className="size-3.5 mcard-chevron" aria-hidden="true" />
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
                )}
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
        onOpenShareMenu={onOpenShareMenu}
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
  onOpenShareMenu,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  onTyping?: () => void;
  /** Ouvre la feuille de partage au niveau écran (hors overflow de la carte). */
  onOpenShareMenu?: () => void;
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
    haptic('medium');
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
        <button type="button" className="lg gbtn" onClick={() => fileInput.current?.click()} aria-label="Envoyer une photo">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="4" />
            <circle cx="8.6" cy="9.9" r="1.7" />
            <path d="M3.4 16.4l4.3-4a2.4 2.4 0 0 1 3.2 0l3.1 2.9" />
            <path d="M12.6 15.1l2.2-2a2.4 2.4 0 0 1 3.2 0l2.4 2.2" />
          </svg>
        </button>

        <div className="mfield-wrap">
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
            className="mfield-mic"
            onClick={() => setRecording(true)}
            aria-label="Enregistrer une note vocale"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2.8" width="6" height="11" rx="3" />
              <path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0" />
              <path d="M12 18.2v3" />
            </svg>
          </button>
        </div>
        <button type="button" className="lg gbtn" onClick={() => onOpenShareMenu?.()} aria-label="Partager un GPX, un équipement ou une randonnée">
          <Icon name="ellipsis" className="size-4" aria-hidden="true" />
        </button>
        <button
          type="submit"
          className={`lg gbtn msend${content.trim() ? ' on' : ''}`}
          disabled={!content.trim() || sending}
          aria-label="Envoyer le message"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.4 12h14.2" />
            <path d="M12.8 6.2 18.6 12l-5.8 5.8" />
          </svg>
        </button>
      </form>

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
  // Hauteur de la card des discussions, réglable en tirant la poignée (mémorisée).
  const SPLIT_KEY = 'lkdv:messages:split';
  const SPLIT_DEFAULT = 302;
  const [split, setSplit] = useState<number>(SPLIT_DEFAULT);
  const [splitting, setSplitting] = useState(false);
  const splitDrag = useRef<{ startY: number; startSplit: number } | null>(null);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(SPLIT_KEY));
      if (Number.isFinite(saved) && saved >= 160) setSplit(saved);
    } catch {}
  }, []);
  const clampSplit = useCallback((value: number) => {
    const total = phone.current?.getBoundingClientRect().height ?? 700;
    return Math.round(Math.min(Math.max(value, 190), Math.max(260, total - 220)));
  }, []);
  const persistSplit = (value: number) => {
    try {
      window.localStorage.setItem(SPLIT_KEY, String(value));
    } catch {}
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const { conversations, loading, error, refreshConversations } = useConversations(currentUserId ?? undefined);

  const [filter, setFilter] = useState<FilterId>('all');
  // Sens du changement de filtre : la liste glisse dans ce sens (voir CSS).
  const [filterDir, setFilterDir] = useState<'next' | 'prev'>('next');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // La frappe reste fluide : le filtrage suit avec un léger retard.
  const deferredQuery = useDeferredValue(query);
  const [searchMessages, setSearchMessages] = useState<Array<{ id: string; conversation_id: string; content: string; created_at: string }>>([]);
  const [searchPeople, setSearchPeople] = useState<Array<{ id: string; full_name: string; avatar_url?: string | null }>>([]);
  const [optionsConv, setOptionsConv] = useState<Conversation | null>(null);
  const [notifyConv, setNotifyConv] = useState<Conversation | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [attachment, setAttachment] = useState<Message | null>(null);
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
    () => filterConversations(conversations, { filter, query: deferredQuery }),
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

  const open = useCallback((conversation: Conversation) => {
    setSelectedId(conversation.id);
  }, []);

  const swipe = useCallback(async (conversation: Conversation, action: SwipeAction) => {
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
  }, [currentUserId, selectedId, refreshConversations]);

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
          <div
            className={`phone hasnext${surfaceOpen ? ' sheet-open' : ''}`}
            id="phone"
            ref={phone}
            data-splitting={splitting ? 'true' : undefined}
            style={{ '--msg-split': `${split}px` } as React.CSSProperties}
          >
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
                  onPointerEnter={() => router.prefetch('/compte')}
                  onTouchStart={() => router.prefetch('/compte')}
                  aria-label="Messages — aller au compte"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>Messages</span>
                </button>
                <div className="ig-top-r">
                  <NotificationBell userId={currentUserId ?? undefined} />
                </div>
              </div>

              <div className="card cs" id="card">
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
                        <ConversationFeedRowMemo
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
                {/* Filtre des discussions : capsule flottante en bas à droite de la card. */}
                <SubCapsuleTabs
                  items={FILTERS.map((item) => ({
                    id: item.id,
                    label: item.label,
                    badge: item.id === 'requests' && pendingCount > 0 ? pendingCount : undefined,
                  }))}
                  activeIndex={Math.max(0, FILTERS.findIndex((item) => item.id === filter))}
                  onIndexChange={(idx) => {
                    const next = FILTERS[idx];
                    if (next) changeFilter(next.id);
                  }}
                  ariaLabel="Filtrer les discussions"
                  placement="float"
                  className="mfilters"
                />
              </div>
            </section>

            <section className="mapzone" aria-label="Conversation">
              <button
                type="button"
                className="msplit"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Régler la hauteur des discussions et de la conversation"
                aria-valuenow={split}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  splitDrag.current = { startY: event.clientY, startSplit: split };
                  setSplitting(true);
                }}
                onPointerMove={(event) => {
                  const drag = splitDrag.current;
                  if (!drag) return;
                  setSplit(clampSplit(drag.startSplit + (event.clientY - drag.startY)));
                }}
                onPointerUp={() => {
                  if (!splitDrag.current) return;
                  splitDrag.current = null;
                  setSplitting(false);
                  persistSplit(split);
                }}
                onPointerCancel={() => {
                  splitDrag.current = null;
                  setSplitting(false);
                }}
                onDoubleClick={() => {
                  setSplit(SPLIT_DEFAULT);
                  persistSplit(SPLIT_DEFAULT);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  event.preventDefault();
                  const next = clampSplit(split + (event.key === 'ArrowDown' ? 24 : -24));
                  setSplit(next);
                  persistSplit(next);
                }}
              >
                <span aria-hidden="true" />
              </button>
              {offline ? (
                <div className="moffline" role="status">
                  Hors ligne — vos messages restent en brouillon local et partiront au retour du réseau.
                </div>
              ) : null}
              <div className="map" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  // Réserve la hauteur réelle de la barre du bas (barre web ou
                  // barre native iOS, plus haute) : la barre de saisie et ses
                  // actions restent toujours visibles au-dessus.
                  paddingBottom: 'calc(max(70px, var(--bottom-nav-height, 70px)) + var(--kb-inset, 0px))',
                }}>
                {selected ? (
                  <div className="mpane in" data-conversation={selected.id}>
                    <button
                      type="button"
                      className="mpill"
                      onClick={() => {
                        haptic('light');
                        setOptionsConv(selected);
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
                        onOpenShareMenu={() => setShareMenuOpen(true)}
                        onOpenPost={(postId) => router.push(`/communaute?post=${encodeURIComponent(postId)}`)}
                        onOpenAttachment={(message) => setAttachment(message)}
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

            <AttachmentDrawer message={attachment} onClose={() => setAttachment(null)} />

            {selected ? (
              <ComposerMenuSheet
                isOpen={shareMenuOpen}
                onClose={() => setShareMenuOpen(false)}
                currentUserId={currentUserId ?? ''}
                onSendGpx={async (file) => {
                  const url = await messagingService.uploadAttachment(selected.id, file);
                  if (!url) return;
                  await messagingService.sendMessage(selected.id, currentUserId as string, url, 'gpx');
                  await refreshConversations();
                  setShareMenuOpen(false);
                }}
                onSendProduct={async (meta: ProductMessageMeta) => {
                  await messagingService.sendMessage(selected.id, currentUserId as string, meta.name, 'product', undefined, meta as unknown as Record<string, unknown>);
                  await refreshConversations();
                  setShareMenuOpen(false);
                }}
                onSendTrail={async (meta: TrailMessageMeta) => {
                  await messagingService.sendMessage(selected.id, currentUserId as string, meta.name, 'trail', undefined, meta as unknown as Record<string, unknown>);
                  await refreshConversations();
                  setShareMenuOpen(false);
                }}
                onSendKit={async (meta: KitMessageMeta) => {
                  await messagingService.sendMessage(selected.id, currentUserId as string, meta.kit_name, 'kit', undefined, meta as unknown as Record<string, unknown>);
                  await refreshConversations();
                  setShareMenuOpen(false);
                }}
              />
            ) : null}

            <AccountDrawerHost
              open={notifyConv !== null}
              variant="card"
              title="Notifications"
              hideHeader
              onClose={() => setNotifyConv(null)}
            >
              <div className="mdrawer-squares">
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
