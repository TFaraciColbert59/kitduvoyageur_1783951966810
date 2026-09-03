"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Conversation } from '../types/messaging.types';
import { formatConversationTimestamp } from '../lib/messagingUtils';
import { Users, BellOff, Bell, Archive, Check, X, ArchiveRestore } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useLongPress } from '@/hooks/gestures';

export type SwipeAction = 'accept' | 'decline' | 'archive' | 'mute';

interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
  onLongPress?: (conversation: Conversation) => void;
  onSwipeAction?: (conversation: Conversation, action: SwipeAction) => void;
}

const REVEAL_WIDTH = 128;

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isSelected,
  onSelect,
  onLongPress,
  onSwipeAction,
}) => {
  const { haptic } = useHapticFeedback();
  const router = useRouter();
  const [dx, setDx] = useState(0);
  const [snappedOpen, setSnappedOpen] = useState(false);
  // Miroir de dx en ref : le décision de snap au touchend lit une valeur
  // à jour (le state est asynchrone et pouvait être obsolète → bug d'affichage).
  const dxRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const didSwipeRef = useRef(false);
  const suppressClickRef = useRef(false);

  // Long-press unifié (mission gestes, Phase 3) — remplace le
  // `longPressTimer` inline (même timing 450ms, même annulation au
  // déplacement >8px incluse dans le hook). Le swipe-reveal iOS Mail
  // existant est conservé tel quel (cf. MISSION_LOG D2).
  const longPress = useLongPress(() => {
    if (!onLongPress) return; // comportement historique : sans handler, aucun effet ni haptique
    suppressClickRef.current = true;
    haptic('medium');
    onLongPress(conversation);
  });

  const isGroup = conversation.type === 'group';
  const isPending = conversation.status === 'pending';
  const title = conversation.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/assets/images/no_image.png';
  const lastMsg = conversation.last_message;
  const unreadCount = conversation.unread_count || 0;

  // Photo de profil / nom -> fiche profil (convention app : /profil/<id>).
  // span role=link + router.push : le parent est un <button>, un <Link>
  // imbriqué serait du HTML invalide.
  const profileId = conversation.other_member?.id || null;
  const openProfile = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!profileId) return;
    haptic('light');
    router.push(`/profil/${profileId}`);
  };

  let lastMessageDisplay = 'Aucun message';
  if (lastMsg) {
    if (lastMsg.message_type === 'image') lastMessageDisplay = '📷 Image';
    else if (lastMsg.message_type === 'audio') lastMessageDisplay = '🎤 Note vocale';
    else if (lastMsg.message_type === 'gpx') lastMessageDisplay = '📍 Tracé GPX';
    else if (lastMsg.message_type === 'file') lastMessageDisplay = '📎 Fichier';
    else if (lastMsg.message_type === 'product') lastMessageDisplay = '📦 Équipement';
    else if (lastMsg.message_type === 'trail') lastMessageDisplay = '🥾 Randonnée';
    else lastMessageDisplay = lastMsg.content;
  }

  const fire = (action: SwipeAction) => {
    haptic('medium');
    setDx(0);
    setSnappedOpen(false);
    onSwipeAction?.(conversation, action);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = 'none';
    dxRef.current = snappedOpen ? -REVEAL_WIDTH : 0;
    suppressClickRef.current = false;
    longPress.onTouchStart(e);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const ddx = e.touches[0].clientX - startX.current;
    const ddy = e.touches[0].clientY - startY.current;
    if (axis.current === 'none' && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (axis.current === 'x') {
      // Glissement gauche → révèle les actions ; droite → referme.
      const base = snappedOpen ? -REVEAL_WIDTH : 0;
      dxRef.current = Math.max(-REVEAL_WIDTH, Math.min(base + ddx, 0));
      setDx(dxRef.current);
    }
    // Le hook annule lui-même le long-press au-delà de 8px de déplacement.
    longPress.onTouchMove(e);
  };

  const onTouchEnd = () => {
    // Tout mouvement (horizontal OU vertical) empêche le click d'ouvrir la
    // conversation : seul un tap sans déplacement sélectionne.
    didSwipeRef.current = axis.current !== 'none';
    longPress.onTouchEnd();
    if (axis.current === 'x') {
      if (dxRef.current < -REVEAL_WIDTH * 0.4) {
        dxRef.current = -REVEAL_WIDTH;
        setDx(-REVEAL_WIDTH);
        setSnappedOpen(true);
      } else {
        dxRef.current = 0;
        setDx(0);
        setSnappedOpen(false);
      }
    } else {
      dxRef.current = snappedOpen ? -REVEAL_WIDTH : 0;
      setDx(dxRef.current);
    }
    axis.current = 'none';
  };

  return (
    <div className="relative w-full shrink-0 overflow-hidden rounded-2xl">
      {/* Actions révélées par le glissement (pattern iOS Mail).
          Rendu conditionnel : hors geste, la couche n'existe pas dans le DOM —
          elle ne peut donc pas transparaître derrière la carte translucide. */}
      {(dx < 0 || snappedOpen) && (
      <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: REVEAL_WIDTH }}>
        <div className="flex-1 flex items-center justify-center gap-0">
          {isPending ? (
            <>
              <button
                type="button"
                onClick={() => fire('accept')}
                aria-label="Accepter la demande"
                className="h-full flex-1 bg-[#2D6B4A] text-white flex flex-col items-center justify-center gap-1 active:opacity-85"
              >
                <Check className="w-5 h-5" />
                <span className="text-[9px] font-bold">Accepter</span>
              </button>
              <button
                type="button"
                onClick={() => fire('decline')}
                aria-label="Refuser la demande"
                className="h-full flex-1 bg-[#8A241B] text-white flex flex-col items-center justify-center gap-1 active:opacity-85"
              >
                <X className="w-5 h-5" />
                <span className="text-[9px] font-bold">Refuser</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fire('archive')}
                aria-label={conversation.is_archived ? 'Désarchiver' : 'Archiver'}
                className="h-full flex-1 bg-[#17402C] text-white flex flex-col items-center justify-center gap-1 active:opacity-85"
              >
                {conversation.is_archived ? (
                  <ArchiveRestore className="w-5 h-5" />
                ) : (
                  <Archive className="w-5 h-5" />
                )}
                <span className="text-[9px] font-bold">
                  {conversation.is_archived ? 'Restaurer' : 'Archiver'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => fire('mute')}
                aria-label={conversation.is_muted ? 'Réactiver les notifications' : 'Masquer les notifications'}
                className="h-full flex-1 bg-[#C89A3B] text-white flex flex-col items-center justify-center gap-1 active:opacity-85"
              >
                {conversation.is_muted ? (
                  <Bell className="w-5 h-5" />
                ) : (
                  <BellOff className="w-5 h-5" />
                )}
                <span className="text-[9px] font-bold">
                  {conversation.is_muted ? 'Son' : 'Muet'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Carte de la conversation (se translate) */}
      <button
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          if (suppressClickRef.current || snappedOpen) {
            suppressClickRef.current = false;
            if (snappedOpen) {
              setDx(0);
              setSnappedOpen(false);
            }
            return;
          }
          haptic('light');
          onSelect(conversation);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label={`${title}${
          unreadCount > 0
            ? `, ${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}`
            : ''
        }`}
        className={`w-full min-h-[76px] text-left p-3.5 rounded-2xl flex items-center gap-3.5 relative border active:scale-[0.985] ${
          isSelected
            ? 'bg-[#17402C]/10 border-[#17402C]/30 shadow-xs ring-1 ring-[#17402C]/20'
            : unreadCount > 0
            ? // Conversation avec messages non lus : ombre portée douce (pas de compteur).
              'bg-white/95 border-white/90 shadow-[0_10px_26px_-8px_rgba(23,64,44,0.32),0_2px_6px_-2px_rgba(23,64,44,0.14)]'
            : 'bg-white/95 border-white/85 shadow-2xs'
        }`}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: dx === 0 ? 'transform 220ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
        <div className="relative shrink-0">
          <span
            role={profileId ? 'link' : undefined}
            tabIndex={profileId ? 0 : undefined}
            onClick={profileId ? openProfile : undefined}
            onKeyDown={
              profileId
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') openProfile(e);
                  }
                : undefined
            }
            title={profileId ? `Voir le profil de ${title}` : undefined}
            aria-label={profileId ? `Voir le profil de ${title}` : undefined}
            className="block w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-white/90 shadow-xs bg-stone-100"
          >
            <Image
              src={avatarUrl}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          </span>
          {isGroup && (
            <span className="absolute -bottom-1 -right-1 bg-[#17402C] text-white rounded-full p-1 shadow-xs border border-white">
              <Users className="w-3 h-3" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h4
              className={`text-[15px] truncate text-[#17402C] ${
                unreadCount > 0 ? 'font-bold' : 'font-semibold'
              }`}
            >
              <span
                role={profileId ? 'link' : undefined}
                tabIndex={profileId ? 0 : undefined}
                onClick={profileId ? openProfile : undefined}
                onKeyDown={
                  profileId
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') openProfile(e);
                      }
                    : undefined
                }
                className={profileId ? 'cursor-pointer hover:underline decoration-[#A3C4A3] underline-offset-2' : ''}
              >
                {title}
              </span>
            </h4>
            <span className="text-[12px] text-[#5A574E] shrink-0 font-medium font-mono tabular-nums">
              {formatConversationTimestamp(conversation.last_message_at)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs truncate leading-snug ${
                unreadCount > 0 ? 'text-[#14140F] font-semibold' : 'text-[#5A574E]'
              }`}
            >
              {isGroup && lastMsg?.sender_name ? `${lastMsg.sender_name.split(' ')[0]} : ` : ''}
              {lastMessageDisplay}
            </p>

            <span className="flex items-center gap-1.5 shrink-0">
              {conversation.is_muted && <BellOff className="w-3.5 h-3.5 text-[#8C8779]" />}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};