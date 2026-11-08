'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, Flag, Heart, MessageCircle, Share2 } from 'lucide-react';
import type {
  CarnetMomentEngagementItem,
  CarnetMomentItem,
} from '@/features/carnet/detail/types';
import { useMomentEngagement } from '@/features/carnet/detail/useMomentEngagement';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCarnetDialog } from './useCarnetDialog';

/**
 * État d'engagement vivant d'un moment, remonté à la fiche : il survit à la
 * fermeture du Peek et au passage Peek → post (sinon un j'aime posé dans le
 * Peek réapparaîtrait non aimé en le rouvrant, et serait inséré deux fois).
 */
export interface CarnetMomentEngagementState {
  momentId: string;
  liked: boolean;
  likesCount: number;
  saved: boolean;
  savesCount: number;
}

export interface CarnetPeekProps {
  /** Carnet du moment : socle des écritures par moment. */
  carnetId: string;
  moment: CarnetMomentItem;
  /** État serveur du moment (`detail.momentEngagement[moment.id]`). */
  initialEngagement?: CarnetMomentEngagementItem | null;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: (message: string, undo?: () => void) => void;
  onEngagementChange?: (state: CarnetMomentEngagementState) => void;
  onClose: () => void;
  onOpenPost: (mode: 'open' | 'comments') => void;
  onShare: () => void;
  onReport: () => void;
}

/**
 * Peek & Pop d'un moment (appui long 460 ms sur une tuile).
 *
 * Famille D du socle : menu contextuel ancré, verre, `aria-modal`, focus piégé,
 * Échap, clic extérieur, verrou de scroll. Le contenu est le moment réel et
 * les cinq actions sont réelles, par moment : j'aime (`carnet_moment_likes`),
 * commenter (post du moment, panneau commentaires), enregistrer
 * (`carnet_moment_saves`), partager, signaler (feuille de signalement de l'écran).
 */
export function CarnetPeek({
  carnetId,
  moment,
  initialEngagement,
  userId,
  onRequireAuth,
  onIsland,
  onEngagementChange,
  onClose,
  onOpenPost,
  onShare,
  onReport,
}: CarnetPeekProps) {
  const { haptic } = useHapticFeedback();
  const [closing, setClosing] = useState(false);

  const engagement = useMomentEngagement({
    carnetId,
    momentId: moment.id,
    initialLiked: initialEngagement?.userLiked ?? false,
    initialLikes: initialEngagement?.likesCount ?? 0,
    initialSaved: initialEngagement?.userSaved ?? false,
    initialSaves: initialEngagement?.savesCount ?? 0,
    userId,
    onRequireAuth,
    onIsland,
  });

  const { liked, likesCount, saved, savesCount } = engagement;

  useEffect(() => {
    onEngagementChange?.({ momentId: moment.id, liked, likesCount, saved, savesCount });
  }, [liked, likesCount, moment.id, onEngagementChange, saved, savesCount]);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    haptic('light');
    window.setTimeout(onClose, 180);
  }, [closing, haptic, onClose]);

  // Échap et clic extérieur passent par la sortie animée.
  const dialogRef = useCarnetDialog(true, requestClose);

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
            aria-pressed={liked}
          >
            <span>
              {liked ? 'Retirer mon j’aime' : 'J’aime'}
              {likesCount > 0 ? ` · ${likesCount}` : ''}
            </span>
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>

          {hasPost ? (
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
          ) : null}

          <button
            type="button"
            onClick={() => {
              haptic('light');
              void engagement.toggleSave();
            }}
            aria-pressed={saved}
          >
            <span>{saved ? 'Enregistré' : 'Enregistrer'}</span>
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>

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

          <button
            type="button"
            onClick={() => {
              haptic('light');
              onReport();
            }}
          >
            <span>Signaler</span>
            <Flag size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
