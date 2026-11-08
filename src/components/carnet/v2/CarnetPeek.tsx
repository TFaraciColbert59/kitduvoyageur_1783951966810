'use client';

import React, { useCallback, useState } from 'react';
import { ArrowUpRight, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { useMomentEngagement } from '@/features/carnet/detail/useMomentEngagement';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCarnetDialog } from './useCarnetDialog';

export interface CarnetPeekProps {
  detail: CarnetDetail;
  moment: CarnetMomentItem;
  currentUserId: string | null;
  onRequireAuth: () => void;
  onClose: () => void;
  onOpenPost: (mode: 'open' | 'comments') => void;
  onShare: () => void;
  onIsland: (message: string, undo?: () => void) => void;
}

/**
 * Peek & Pop d'un moment (appui long 460 ms sur une tuile).
 *
 * Famille D du socle : menu contextuel ancré, verre, `aria-modal`, focus piégé,
 * Échap, clic extérieur, verrou de scroll. Le contenu est le moment réel ;
 * aucune action n'est affichée si elle n'a pas de backend (pas d'enregistrer
 * ni de signaler par moment).
 */
export function CarnetPeek({
  detail,
  moment,
  currentUserId,
  onRequireAuth,
  onClose,
  onOpenPost,
  onShare,
  onIsland,
}: CarnetPeekProps) {
  const { haptic } = useHapticFeedback();
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    haptic('light');
    window.setTimeout(onClose, 180);
  }, [closing, haptic, onClose]);

  // Échap et clic extérieur passent par la sortie animée.
  const dialogRef = useCarnetDialog(true, requestClose);

  const initial = detail.momentEngagement?.[moment.id];
  const engagement = useMomentEngagement({
    carnetId: detail.id,
    momentId: moment.id,
    initialLikes: initial?.likesCount ?? 0,
    initialLiked: initial?.userLiked ?? false,
    userId: currentUserId,
    onRequireAuth,
    onIsland,
  });

  const hasPost = Boolean(moment.imageUrl);
  const title =
    moment.place || moment.title || (moment.dayNumber > 0 ? `Jour ${moment.dayNumber}` : 'Moment');
  const meta = [
    moment.dayNumber > 0 ? `Jour ${moment.dayNumber}` : null,
    moment.time,
    moment.place && moment.place !== title ? moment.place : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`lkdv-peek${closing ? ' closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        className="lkdv-peek-box"
        role="dialog"
        aria-modal="true"
        aria-label={`Moment ${moment.title || moment.caption || ''}`.trim()}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lkdv-peek-preview">
          {moment.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={moment.imageUrl} alt={moment.caption || ''} loading="lazy" decoding="async" />
          ) : (
            <span className="lkdv-peek-fallback">{moment.title || 'Moment'}</span>
          )}
          <div className="lkdv-peek-meta">
            <b>{title}</b>
            {meta ? <span>{meta}</span> : null}
          </div>
        </div>

        <div className="lkdv-peek-menu">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              void engagement.toggleLike();
            }}
            aria-pressed={engagement.liked}
          >
            <span>
              {engagement.liked ? 'Retirer mon j’aime' : 'J’aime'}
              {engagement.likesCount > 0 ? ` · ${engagement.likesCount}` : ''}
            </span>
            <Heart size={18} fill={engagement.liked ? 'currentColor' : 'none'} />
          </button>

          {hasPost ? (
            <>
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  onOpenPost('comments');
                }}
              >
                <span>Commenter</span>
                <MessageCircle size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  onOpenPost('open');
                }}
              >
                <span>Ouvrir le moment</span>
                <ArrowUpRight size={18} />
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => {
              haptic('light');
              onShare();
            }}
          >
            <span>Partager</span>
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
