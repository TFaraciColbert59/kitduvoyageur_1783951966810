'use client';

import React from 'react';
import Link from 'next/link';
import type { FeedPost } from './useCommunityFeed';
import { timeAgo } from './feed-utils';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Pillule auteur du post (screen 2) : avatar 32, nom, badge de confiance,
 * méta `lieu · spot · temps`. Même verre que le reste.
 */
export function PostAuthorPill({ post }: { post: FeedPost }) {
  const author = post.author;
  const name = author?.full_name || 'Voyageur LKDV';
  const id = author?.id || post.author_id || '';
  const href = id ? `/profil/${id}` : '/communaute';
  const place = typeof post.title === 'string' ? post.title : '';
  const location = typeof author?.location === 'string' ? author.location : '';
  const meta = [location, place, timeAgo(post.created_at)].filter(Boolean).join(' · ');
  const trust = typeof author?.trust_score === 'number' ? author.trust_score : null;

  return (
    <Link href={href} className="lkdv-post-author" aria-label={`${name}${meta ? ` — ${meta}` : ''}`}>
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
              <LKDVIcon name="securite" size={10} aria-hidden="true" />
              {Math.round(trust)}
            </span>
          ) : null}
        </span>
        <span className="lkdv-post-author-meta">{meta || timeAgo(post.created_at)}</span>
      </span>
    </Link>
  );
}

export default PostAuthorPill;
