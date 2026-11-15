'use client';

import React from 'react';
import { Flag, MessageCircle, Send } from 'lucide-react';
import LikeIcon from '@/components/social-kit/LikeIcon';
import AppImage from '@/components/ui/AppImage';
import type { SportActivityCardVM } from '@/features/community/g01/activityProjection';
import type { VideoPreferences } from '@/features/community/g01/videoPlayback';
import { formatEngagementCount } from '@/components/social-kit/EngagementBar';
import { G01VideoPlayer } from './G01VideoPlayer';
import { SportStatsRow } from './SportStatsRow';
import styles from './g01.module.css';

export interface SportActivityCardVideo {
  src: string;
  poster?: string | null;
  preferences: VideoPreferences | unknown;
}

export interface SportActivityCardProps {
  item: SportActivityCardVM;
  video?: SportActivityCardVideo | null;
  onOpen?: (item: SportActivityCardVM) => void;
  onLike?: (item: SportActivityCardVM) => void;
  onComment?: (item: SportActivityCardVM) => void;
  onShare?: (item: SportActivityCardVM) => void;
  onReport?: (item: SportActivityCardVM) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function cardDate(item: SportActivityCardVM): string | null {
  const source = item.sessionDate ?? item.createdAt;
  const time = Date.parse(source);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(time));
}

/**
 * Carte d'activité du fil. Elle ne lit jamais `hike_sessions` et ne reçoit
 * qu'un VM déjà filtré par la politique G01. Les actions indisponibles sont
 * désactivées, jamais masquées derrière un bouton qui échouerait ensuite.
 */
export function SportActivityCard({
  item,
  video = null,
  onOpen,
  onLike,
  onComment,
  onShare,
  onReport,
}: SportActivityCardProps) {
  const titleId = React.useId();
  const date = cardDate(item);
  const likeDisabled = !item.canLike || !onLike;
  const commentDisabled = !item.canComment || !onComment;
  const shareDisabled = !item.canShare || !onShare;

  return (
    <article className={styles.card} aria-labelledby={titleId} data-g01-sport={item.sport}>
      <header className={styles.header}>
        {item.author.avatarUrl ? (
          <AppImage
            src={item.author.avatarUrl}
            alt=""
            width={40}
            height={40}
            className={styles.avatar}
            fallbackSrc="/assets/images/no_image.png"
          />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {initials(item.author.name)}
          </span>
        )}
        <div className={styles.identity}>
          <p className={styles.authorName}>{item.author.name}</p>
          <p className={styles.metaLine}>
            {item.author.handle ? <span>@{item.author.handle}</span> : null}
            {date ? <span>{date}</span> : null}
          </p>
        </div>
        <span className={styles.badge}>{item.sportLabel}</span>
        {item.isOwner ? <span className={styles.ownerBadge}>Ta sortie</span> : null}
      </header>

      <h3 id={titleId} className={styles.title}>
        {item.title}
      </h3>
      <p className={styles.subline}>
        {item.audienceLabel} · {item.visibilityLabel}
      </p>

      <SportStatsRow stats={item.stats} records={item.records} />

      {video ? (
        <G01VideoPlayer
          src={video.src}
          poster={video.poster ?? item.coverUrl ?? undefined}
          preferences={video.preferences}
          audienceAllowed={item.canShare}
          ariaLabel={`Vidéo de la sortie ${item.title}`}
        />
      ) : item.coverUrl ? (
        <div className={styles.mediaFrame}>
          <AppImage
            src={item.coverUrl}
            alt={`Couverture de ${item.title}`}
            fill
            sizes="(max-width: 768px) 100vw, 406px"
            className={styles.media}
          />
        </div>
      ) : null}

      <div className={styles.actions} role="group" aria-label="Actions de la sortie">
        <button
          type="button"
          className={[styles.action, item.likedByMe ? styles.actionOn : ''].filter(Boolean).join(' ')}
          onClick={() => onLike?.(item)}
          disabled={likeDisabled}
          aria-pressed={item.likedByMe}
          aria-label={item.canLike ? `Aimer la sortie (${item.likesCount})` : 'Like indisponible'}
        >
          <LikeIcon size={18} active={item.likedByMe} />
          <span aria-hidden="true">{formatEngagementCount(item.likesCount)}</span>
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => onComment?.(item)}
          disabled={commentDisabled}
          aria-label={
            item.canComment ? `Commenter la sortie (${item.commentsCount})` : 'Commentaires indisponibles'
          }
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span aria-hidden="true">{formatEngagementCount(item.commentsCount)}</span>
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => onShare?.(item)}
          disabled={shareDisabled}
          aria-label={item.canShare ? 'Partager la sortie' : 'Partage indisponible'}
        >
          <Send size={18} aria-hidden="true" />
        </button>
        {onReport ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => onReport(item)}
            aria-label="Signaler la publication"
          >
            <Flag size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {onOpen ? (
        <button type="button" className={styles.openLink} onClick={() => onOpen(item)}>
          Voir la sortie
        </button>
      ) : null}
    </article>
  );
}

export default SportActivityCard;
