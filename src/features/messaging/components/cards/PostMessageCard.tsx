'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { PostMessageMeta } from '../../types/messaging.types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface PostMessageCardProps {
  meta: PostMessageMeta;
  isMine: boolean;
}

/**
 * Carte inline d'une publication de la communauté partagée en conversation.
 * Même langage de verre que ProductCard / TrailCard, format compact :
 * vignette 160 × 100, auteur, titre (ou extrait) et lien vers la publication.
 */
export const PostMessageCard: React.FC<PostMessageCardProps> = ({ meta, isMine }) => {
  const href = meta.post_url || `/communaute?post=${meta.post_id}`;
  const title = meta.title?.trim() || 'Publication partagée';
  const imageUrl = meta.image_url?.trim() || null;
  const authorName = meta.author_name?.trim() || null;
  const authorInitial = (authorName || 'Voyageur').charAt(0).toUpperCase();

  return (
    <Link
      href={href}
      className={`mt-[var(--space-2)] flex w-[280px] max-w-full overflow-hidden rounded-[var(--lkv-radius-md)] border shadow-elevation-1 transition-transform active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      <div
        data-testid="post-message-card-media"
        className="relative h-[100px] w-40 shrink-0 overflow-hidden bg-[color:var(--glass-bg-medium)]"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="160px"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
            }}
          />
        ) : (
          <div
            data-testid="post-message-card-image-fallback"
            className={`flex h-full w-full items-center justify-center ${
              isMine
                ? 'text-[color:var(--lkv-text-inverted)]/45'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            <LKDVIcon name="galerie" size={20} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-[var(--space-1)] p-[var(--space-2)]">
        <p
          className={`line-clamp-2 break-words text-[length:var(--lkv-text-caption)] font-bold leading-snug ${
            isMine
              ? 'text-[color:var(--lkv-text-inverted)]'
              : 'text-[color:var(--lkv-text-primary)]'
          }`}
        >
          {title}
        </p>

        <div className="flex min-w-0 items-center gap-[var(--space-1)]">
          {meta.author_avatar ? (
            <span
              data-testid="post-message-card-avatar"
              className="relative size-4 shrink-0 overflow-hidden rounded-full bg-[color:var(--glass-bg-medium)] ring-1 ring-[color:var(--glass-border)]"
            >
              <Image
                src={meta.author_avatar}
                alt={authorName || 'Auteur'}
                fill
                className="object-cover"
                sizes="16px"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                }}
              />
            </span>
          ) : (
            <span
              data-testid="post-message-card-avatar-fallback"
              aria-hidden="true"
              className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] font-bold ${
                isMine
                  ? 'bg-[color:var(--lkv-text-inverted)]/15 text-[color:var(--lkv-text-inverted)]'
                  : 'bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-secondary)]'
              }`}
            >
              {authorInitial}
            </span>
          )}
          <span
            className={`truncate text-[length:var(--lkv-text-caption-2)] font-medium ${
              isMine
                ? 'text-[color:var(--lkv-text-inverted)]/75'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            {authorName || 'Voyageur LKDV'}
          </span>
        </div>

        <span
          className={`text-[length:var(--lkv-text-caption-2)] font-semibold ${
            isMine
              ? 'text-[color:var(--lkv-text-inverted)]/90'
              : 'text-[color:var(--lkv-forest-700)]'
          }`}
        >
          Voir la publication <span aria-hidden="true"><LKDVIcon name="suivant" size="1em" className="lkdv-icon-inline" /></span>
        </span>
      </div>
    </Link>
  );
};
