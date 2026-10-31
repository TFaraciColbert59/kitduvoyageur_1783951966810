'use client';

import React from 'react';
import Link from 'next/link';
import type { FeedPost } from './useCommunityFeed';
import { timeAgo } from './feed-utils';

/**
 * Pillule auteur du post (screen 2) : avatar 32, nom, badge de confiance,
 * méta `lieu · spot · temps`. Même verre que le reste.
 */
export interface PostAuthorPillOverrides {
  /** Remplace le lien profil par une action (ex. centrer la carte). */
  onClick?: () => void;
  meta?: string;
  badge?: string;
}

export function PostAuthorPill({ post, onClick, meta: metaOverride, badge }: { post: FeedPost } & PostAuthorPillOverrides) {
  const author = post.author;
  const name = author?.full_name || 'Voyageur LKDV';
  const id = author?.id || post.author_id || '';
  const href = id ? `/profil/${id}` : '/communaute';
  const place = typeof post.title === 'string' ? post.title : '';
  const location = typeof author?.location === 'string' ? author.location : '';
  const meta = metaOverride ?? [location, place, timeAgo(post.created_at)].filter(Boolean).join(' · ');
  const trust = typeof author?.trust_score === 'number' ? author.trust_score : null;

  const label = `${name}${meta ? ` — ${meta}` : ''}`;
  const body = (
    <>
      {author?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant
        <img className="lkdv-post-author-av" src={author.avatar_url} alt="" />
      ) : (
        <span className="lkdv-post-author-av pmi-author-initial" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="lkdv-post-author-txt">
        <span className="lkdv-post-author-line">
          <b>{name}</b>
          {trust !== null ? (
            <span className="lkdv-post-author-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.4-2.8 7.6-7 9-4.2-1.4-7-4.6-7-9V6l7-3Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              {Math.round(trust)}
            </span>
          ) : null}
          {badge ? <span className="lkdv-post-author-badge">{badge}</span> : null}
        </span>
        <span className="lkdv-post-author-meta">{meta || timeAgo(post.created_at)}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="lkdv-post-author" aria-label={label} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <Link href={href} className="lkdv-post-author" aria-label={label}>
      {body}
    </Link>
  );
}

export default PostAuthorPill;
