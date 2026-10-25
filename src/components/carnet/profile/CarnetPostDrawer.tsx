'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetPostDrawerProps {
  detail: CarnetDetail;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  comments: {
    comments: CarnetComment[];
    loading: boolean;
    send: (content: string) => Promise<boolean>;
    remove: (commentId: string) => Promise<boolean>;
  };
  canWrite: boolean;
  currentUserId: string | null;
  onRequireAuth: () => void;
  onOpenViewer: (index: number) => void;
  onLike: () => void;
  onShare: () => void;
}

/** Post d'un moment, dans la carte : photo 1:1, navigation, actions, commentaires du carnet. */
export function CarnetPostDrawer({
  detail,
  index,
  onIndexChange,
  onClose,
  comments,
  canWrite,
  currentUserId,
  onRequireAuth,
  onOpenViewer,
  onLike,
  onShare,
}: CarnetPostDrawerProps) {
  const items = detail.photoMoments;
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const moment = items[safeIndex];

  const go = (delta: number) => {
    if (items.length === 0) return;
    onIndexChange((safeIndex + delta + items.length) % items.length);
  };

  return (
    <section className="ckp-card ckp-card--drawer ckp-card--post" role="region" aria-label="Post du carnet">
      <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau">
        <span aria-hidden="true" />
      </button>

      <div className="ckp-card-scroll ckp-drawer-body">
        <div className="ckp-post-head">
          <div className="ckp-post-author">
            {detail.author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="ckp-avatar" src={detail.author.avatarUrl} alt="" />
            ) : (
              <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                {(detail.author?.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="ckp-liker-txt">
              <b>{detail.author?.name ?? 'Auteur non renseigné'}</b>
              <small>
                {moment ? `JOUR ${moment.dayNumber}${moment.time ? ` · ${moment.time}` : ''}` : '—'}
              </small>
            </span>
          </div>
          <button type="button" className="ckp-link" onClick={onShare} aria-label="Partager le carnet">
            <Icon name="send" size={16} aria-hidden="true" />
          </button>
        </div>

        {moment ? (
          <button
            type="button"
            className="ckp-post-media"
            onClick={() => onOpenViewer(safeIndex)}
            aria-label="Agrandir la photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
            <img src={moment.imageUrl ?? ''} alt={moment.caption ?? 'Photo du carnet'} />
          </button>
        ) : null}

        <div className="ckp-post-nav">
          <button type="button" onClick={() => go(-1)} aria-label="Moment précédent" disabled={items.length < 2}>
            <Icon name="chevron-left" size={16} aria-hidden="true" />
          </button>
          <span>{safeIndex + 1}/{items.length}</span>
          <button type="button" onClick={() => go(1)} aria-label="Moment suivant" disabled={items.length < 2}>
            <Icon name="chevron-right" size={16} aria-hidden="true" />
          </button>
        </div>

        {moment?.caption ? <p className="ckp-post-caption">{moment.caption}</p> : null}
        {moment?.place || moment?.time ? (
          <p className="ckp-post-meta">
            {[moment?.place, moment?.time].filter(Boolean).join(' · ')}
          </p>
        ) : null}

        <div className="ckp-post-actions">
          <button
            type="button"
            className={detail.engagement.liked ? 'ckp-post-act is-on' : 'ckp-post-act'}
            onClick={onLike}
            aria-pressed={detail.engagement.liked}
            aria-label={`J’aime, ${detail.engagement.likes}`}
          >
            <Icon name="heart" size={18} aria-hidden="true" />
            {detail.engagement.likes}
          </button>
          <span className="ckp-post-act">
            <Icon name="message-square" size={18} aria-hidden="true" />
            {detail.engagement.comments}
          </span>
        </div>

        <div className="ckp-post-comments-title">Commentaires du carnet</div>
        <CarnetCommentsPane
          comments={comments.comments}
          loading={comments.loading}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onSend={comments.send}
          onRemove={comments.remove}
          onRequireAuth={onRequireAuth}
        />
      </div>
    </section>
  );
}

export default CarnetPostDrawer;
