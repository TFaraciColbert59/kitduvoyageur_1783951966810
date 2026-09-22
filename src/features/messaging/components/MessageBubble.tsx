'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, Card, Chip, IconButton, Spinner } from '@/components/ui';
import type { Message } from '../types/messaging.types';
import { formatMessageDate } from '../lib/messagingUtils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSwipe } from '@/hooks/useSwipe';
import { useDoubleTap, useLongPress } from '@/hooks/gestures';
import { OpenGraphCard } from './OpenGraphCard';
import { AudioPlayerBubble } from './AudioPlayerBubble';
import { GPXPreviewCard } from './GPXPreviewCard';
import { ProductCard } from './ProductCard';
import { TrailCard } from './TrailCard';
import { KitCard } from './KitCard';
import type {
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from '../types/messaging.types';

// Les six réactions d'iMessage (Compose intégration pomme).
const REACTION_PALETTE = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

export type BubbleGroupPosition = 'single' | 'first' | 'middle' | 'last';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentUserId?: string;
  showSenderHeader?: boolean;
  groupPosition?: BubbleGroupPosition;
  isReadByRecipient?: boolean;
  readByCount?: number;
  readByNames?: string[];
  onReply?: (message: Message) => void;
  onToggleReaction?: (messageId: string, reactionValue: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  onForward?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  currentUserId,
  showSenderHeader,
  groupPosition = 'single',
  isReadByRecipient,
  readByCount,
  readByNames,
  onReply,
  onToggleReaction,
  onScrollToMessage,
  onForward,
}) => {
  const { haptic } = useHapticFeedback();
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Swipe à droite sur un message reçu → répondre (comme Instagram DM)
  const swipeHandlers = useSwipe(
    {
      onSwipeRight: () => {
        if (!isMine) {
          haptic('light');
          onReply?.(message);
        }
      },
    },
    { threshold: 60 }
  );

  const senderName = message.sender_profile?.full_name || 'Voyageur';
  const avatarUrl = message.sender_profile?.avatar_url || '/assets/images/no_image.png';

  // Double-tap for ❤️ — hook partagé (mission gestes, Phase 3) ;
  // comportement identique à l'ancien inline (fenêtre 300ms).
  const doubleTap = useDoubleTap(() => {
    haptic('light');
    if (onToggleReaction) {
      onToggleReaction(message.id, '❤️');
    }
  });

  // Long press for action menu on touch devices — hook partagé (Phase 3) ;
  // l'annulation au touchmove (>8px, scroll de la liste) est incluse
  // dans le hook (cf. audit 1.4).
  const longPress = useLongPress(() => {
    haptic('medium');
    setShowActionMenu(true);
  });

  // Fermeture du menu au clic extérieur et au scroll
  useEffect(() => {
    if (!showActionMenu) return;
    const close = () => setShowActionMenu(false);
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [showActionMenu]);

  // URL matching for OpenGraph
  const urls = message.content ? message.content.match(URL_REGEX) || [] : [];
  const firstUrl = urls[0] || null;

  // Group reactions by emoji
  const reactionsGrouped = React.useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map = new Map<string, { emoji: string; count: number; userReacted: boolean }>();

    message.reactions.forEach((r) => {
      const existing = map.get(r.reaction_value);
      const isMe = r.user_id === currentUserId;
      if (existing) {
        existing.count += 1;
        if (isMe) existing.userReacted = true;
      } else {
        map.set(r.reaction_value, {
          emoji: r.reaction_value,
          count: 1,
          userReacted: isMe,
        });
      }
    });

    return Array.from(map.values());
  }, [message.reactions, currentUserId]);

  const marginClass =
    groupPosition === 'first'
      ? 'mt-[var(--space-2)] mb-0.5'
      : groupPosition === 'middle'
        ? 'my-0.5'
        : groupPosition === 'last'
          ? 'mt-0.5 mb-[var(--space-2)]'
          : 'my-1.5';

  const bubbleRadiusClass = isMine
    ? groupPosition === 'first'
      ? 'rounded-[var(--lkv-radius-md)] rounded-tr-xs rounded-br-[var(--lkv-radius-xs)]'
      : groupPosition === 'middle'
        ? 'rounded-[var(--lkv-radius-md)] rounded-tr-[var(--lkv-radius-xs)] rounded-br-[var(--lkv-radius-xs)]'
        : groupPosition === 'last'
          ? 'rounded-[var(--lkv-radius-md)] rounded-tr-[var(--lkv-radius-xs)] rounded-br-xs'
          : 'rounded-[var(--lkv-radius-md)] rounded-tr-xs'
    : groupPosition === 'first'
      ? 'rounded-[var(--lkv-radius-md)] rounded-tl-xs rounded-bl-[var(--lkv-radius-xs)]'
      : groupPosition === 'middle'
        ? 'rounded-[var(--lkv-radius-md)] rounded-tl-[var(--lkv-radius-xs)] rounded-bl-[var(--lkv-radius-xs)]'
        : groupPosition === 'last'
          ? 'rounded-[var(--lkv-radius-md)] rounded-tl-[var(--lkv-radius-xs)] rounded-bl-xs'
          : 'rounded-[var(--lkv-radius-md)] rounded-tl-xs';

  const showAvatar = !isMine && (groupPosition === 'last' || groupPosition === 'single');
  const showHeader =
    !isMine && showSenderHeader && (groupPosition === 'first' || groupPosition === 'single');

  return (
    <div
      id={`msg-bubble-${message.id}`}
      {...swipeHandlers}
      className={`group relative flex items-end gap-[var(--space-2)] ${marginClass} transition-all ${
        isMine ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {!isMine &&
        (showAvatar ? (
          <Link
            href={`/profil/${message.sender_profile?.id || ''}`}
            className="relative mb-0.5 size-8 shrink-0 cursor-pointer overflow-hidden rounded-full bg-[color:var(--btn-tint)] shadow-elevation-1 ring-1 ring-[color:var(--glass-border)] transition-shadow hover:ring-2 hover:ring-[color:var(--lkv-secondary)]"
            title={`Voir le profil de ${senderName}`}
            aria-label={`Voir le profil de ${senderName}`}
          >
            <Image
              src={avatarUrl}
              alt={senderName}
              fill
              className="object-cover"
              sizes="32px"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          </Link>
        ) : (
          <div className="w-8 shrink-0" aria-hidden="true" />
        ))}

      <div
        className={`flex max-w-[78%] flex-col sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}
      >
        {showHeader && (
          <Link
            href={`/profil/${message.sender_profile?.id || ''}`}
            className="mb-[var(--space-1)] ml-[var(--space-1)] block cursor-pointer text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-muted)] transition-colors hover:text-[color:var(--lkv-text-primary)]"
          >
            {senderName}
          </Link>
        )}

        {/* Action Menu overlay */}
        {showActionMenu && (
          <Card
            className={`animate-scale-in z-[var(--z-dropdown)] mb-[var(--space-2)] flex items-center gap-[var(--space-1)] p-[var(--space-1)] shadow-elevation-3 ${
              isMine ? 'origin-bottom-right' : 'origin-bottom-left'
            }`}
          >
            {REACTION_PALETTE.map((emoji) => (
              <IconButton
                key={emoji}
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  haptic('light');
                  onToggleReaction?.(message.id, emoji);
                  setShowActionMenu(false);
                }}
                className="text-xl active:scale-125"
                aria-label={`Réagir avec ${emoji}`}
              >
                {emoji}
              </IconButton>
            ))}
            <div className="mx-[var(--space-1)] h-5 w-px bg-[color:var(--lkv-border)]" />
            <IconButton
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                haptic('light');
                onReply?.(message);
                setShowActionMenu(false);
              }}
              className="text-[length:var(--lkv-text-caption)] font-semibold shadow-elevation-1"
              title="Répondre"
              aria-label="Répondre"
            >
              <Icon name="reply" className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                haptic('light');
                onForward?.(message);
                setShowActionMenu(false);
              }}
              className="text-[length:var(--lkv-text-caption)] font-semibold shadow-elevation-1"
              title="Transférer"
              aria-label="Transférer"
            >
              <Icon name="share2" className="size-3.5" aria-hidden="true" />
            </IconButton>
          </Card>
        )}

        <div className="group/bubble relative flex items-center gap-[var(--space-1)]">
          {/* Action trigger button on hover / focus / first-of-group */}
          {/*
            Boutons d'action masqués sur tactile : sur mobile le long-press et
            le swipe-droite suffisent, et max-md:opacity-100 volait ~70px de
            largeur utile (cf. audit 1.4).
          */}
          <div
            className={`hidden items-center gap-[var(--space-1)] opacity-0 transition-opacity focus-within:opacity-100 group-hover/bubble:opacity-100 md:flex ${
              isMine ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <IconButton
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                haptic('light');
                setShowActionMenu(!showActionMenu);
              }}
              aria-label="Réagir"
              className="text-[color:var(--lkv-text-secondary)] shadow-elevation-1 hover:text-[color:var(--lkv-text-primary)]"
              title="Réagir"
            >
              <Icon name="smile" className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                haptic('light');
                onReply?.(message);
              }}
              aria-label="Répondre"
              className="text-[color:var(--lkv-text-secondary)] shadow-elevation-1 hover:text-[color:var(--lkv-text-primary)]"
              title="Répondre"
            >
              <Icon name="reply" className="size-3.5" aria-hidden="true" />
            </IconButton>
          </div>

          <div
            onClick={doubleTap.onClick}
            {...longPress}
            className={`relative cursor-pointer select-none px-[var(--space-4)] py-[var(--space-3)] transition-all ${bubbleRadiusClass} ${
              isMine ? 'msg-bubble--mine' : 'msg-bubble text-[color:var(--lkv-text-primary)]'
            }`}
          >
            {/* Quoted Message */}
            {message.reply_to_message && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (message.reply_to_message?.id && onScrollToMessage) {
                    onScrollToMessage(message.reply_to_message.id);
                  }
                }}
                className={`mb-[var(--space-2)] cursor-pointer rounded-[var(--lkv-radius-sm)] border-l-2 px-[var(--space-3)] py-1.5 text-[length:var(--lkv-text-caption)] transition-opacity hover:opacity-90 ${
                  isMine
                    ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]/90'
                    : 'border-[color:var(--lkv-primary)]/60 bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-primary)]'
                }`}
              >
                <p className="text-[length:var(--lkv-text-caption-2)] font-bold">{message.reply_to_message.sender_name}</p>
                <p className="truncate text-[length:var(--lkv-text-caption-2)]">{message.reply_to_message.content}</p>
              </div>
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-[var(--space-2)] space-y-[var(--space-2)]">
                {message.attachments.map((att) => {
                  const isGpx = att.file_name?.endsWith('.gpx') || att.file_type?.includes('gpx');
                  const isAudio = att.file_type?.startsWith('audio/');

                  if (isAudio) {
                    return (
                      <AudioPlayerBubble key={att.id} audioUrl={att.file_url} isMine={isMine} />
                    );
                  }

                  if (isGpx) {
                    return (
                      <GPXPreviewCard
                        key={att.id}
                        gpxUrl={att.file_url}
                        fileName={att.file_name}
                        isMine={isMine}
                      />
                    );
                  }

                  return (
                    <div
                      key={att.id}
                      className="max-w-sm overflow-hidden rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)]"
                    >
                      {att.file_type.startsWith('image/') ? (
                        <div className="relative h-48 w-64">
                          <Image
                            src={att.file_url}
                            alt={att.file_name || 'Image'}
                            fill
                            className="cursor-pointer object-cover transition-opacity hover:opacity-95"
                          />
                        </div>
                      ) : (
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-[var(--space-2)] text-[length:var(--lkv-text-caption)] transition-colors hover:brightness-[1.05]"
                        >
                          <Icon name="file-text" className="size-4" aria-hidden="true" />
                          <span className="truncate underline">
                            {att.file_name || 'Télécharger le fichier'}
                          </span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audio Message Type */}
            {message.message_type === 'audio' && (
              <AudioPlayerBubble audioUrl={message.content} isMine={isMine} />
            )}

            {/* GPX Message Type */}
            {message.message_type === 'gpx' && (
              <GPXPreviewCard gpxUrl={message.content} isMine={isMine} />
            )}

            {/* Image Message Type — envoi Photo : l'URL (signee ou blob) est
                portee par content. <img> natif : compatible blob: et hotlinks,
                contrairement a next/image. */}
            {message.message_type === 'image' && message.content && (
              <a
                href={message.content}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-[var(--space-1)] block overflow-hidden rounded-[var(--lkv-radius-md)] border ${
                  isMine ? 'border-[color:var(--glass-border)]' : 'border-[color:var(--lkv-border)]'
                }`}
                title="Ouvrir l'image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: et URLs signees non supportees par next/image */}
                <img
                  src={message.content}
                  alt="Photo partagée"
                  loading="lazy"
                  className="block max-h-72 w-full max-w-[260px] cursor-zoom-in object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                  }}
                />
              </a>
            )}

            {/* Product / Trail — cartes cliquables portées par metadata */}
            {message.message_type === 'product' && message.metadata && (
              <ProductCard
                meta={message.metadata as unknown as ProductMessageMeta}
                isMine={isMine}
              />
            )}
            {message.message_type === 'trail' && message.metadata && (
              <TrailCard meta={message.metadata as unknown as TrailMessageMeta} isMine={isMine} />
            )}
            {message.message_type === 'kit' && message.metadata && (
              <KitCard meta={message.metadata as unknown as KitMessageMeta} isMine={isMine} />
            )}

            {/* Message Content */}
            {message.message_type !== 'audio' &&
              message.message_type !== 'gpx' &&
              message.message_type !== 'image' &&
              message.message_type !== 'product' &&
              message.message_type !== 'trail' &&
              message.message_type !== 'kit' && (
                <p className="whitespace-pre-wrap break-words text-[length:var(--lkv-text-subheadline)] font-normal leading-[1.45]">
                  {message.content}
                </p>
              )}

            {/* OpenGraph Card Preview */}
            {firstUrl &&
              message.message_type !== 'audio' &&
              message.message_type !== 'gpx' &&
              message.message_type !== 'image' && <OpenGraphCard url={firstUrl} isMine={isMine} />}

            {/* Footer timestamp & status / read receipts */}
            <div className="mt-1.5 flex items-center justify-end gap-[var(--space-1)]">
              <span
                className={`text-[length:var(--lkv-text-caption-2)] font-medium ${
                  isMine ? 'text-[color:var(--lkv-text-inverted)]/80' : 'text-[color:var(--lkv-text-secondary)]'
                }`}
              >
                {formatMessageDate(message.created_at)}
              </span>

              {isMine && (
                <span className="flex items-center gap-[var(--space-1)]">
                  {message.status === 'sending' ? (
                    <Spinner size="sm" tone="current" label="Envoi en cours" />
                  ) : message.status === 'error' ? (
                    <Badge tone="danger">! Échec</Badge>
                  ) : isReadByRecipient || (readByCount && readByCount > 0) ? (
                    <span
                      className="flex items-center gap-0.5 text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-forest-100)]"
                      title={
                        readByNames && readByNames.length > 0
                          ? `Lu par : ${readByNames.join(', ')}`
                          : 'Vu'
                      }
                    >
                      <Icon name="check-check" className="inline size-3.5 text-[color:var(--lkv-forest-100)]" aria-hidden="true" />
                      <span>{readByCount && readByCount > 1 ? `Vu par ${readByCount}` : 'Vu'}</span>
                    </span>
                  ) : (
                    <Icon name="check" className="inline size-3.5" aria-hidden="true" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reaction Pills below bubble */}
        {reactionsGrouped.length > 0 && (
          <div className={`mt-[var(--space-1)] flex flex-wrap gap-[var(--space-1)] ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactionsGrouped.map((item) => (
              <Chip
                key={item.emoji}
                selected={item.userReacted}
                onClick={() => {
                  haptic('light');
                  onToggleReaction?.(message.id, item.emoji);
                }}
              >
                <span>{item.emoji}</span>
                {item.count > 1 && <span className="tabular-nums">{item.count}</span>}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
