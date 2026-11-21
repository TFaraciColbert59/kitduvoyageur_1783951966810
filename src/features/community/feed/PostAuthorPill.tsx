'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Users } from 'lucide-react';
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
  contextAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    ariaLabel?: string;
  };
}

export function PostAuthorPill({ post, onClick, meta: metaOverride, badge, contextAction }: { post: FeedPost } & PostAuthorPillOverrides) {
  const author = post.author;
  const name = author?.full_name || 'Voyageur LKDV';
  const id = author?.id || post.author_id || '';
  const href = id ? `/profil/${id}` : '/communaute';
  const place = typeof post.title === 'string' ? post.title : '';
  const location = typeof author?.location === 'string' ? author.location : '';
  const meta = metaOverride ?? [location, place, timeAgo(post.created_at)].filter(Boolean).join(' · ');
  const trust = typeof author?.trust_score === 'number' ? author.trust_score : null;

  const pillEl = (
    <IdentityPill
      name={name}
      avatarUrl={author?.avatar_url}
      meta={meta || timeAgo(post.created_at)}
      trust={trust}
      badge={badge}
      href={href}
      onClick={onClick}
    />
  );

  const contextLink = post.clubContext
    ? {
        href: `/clubs/${post.clubContext.slug}`,
        label: post.clubContext.name,
        kind: 'club' as const,
      }
    : post.carnetContext
      ? {
          href: `/carnets/${post.carnetContext.id}`,
          label: post.carnetContext.title,
          kind: 'carnet' as const,
        }
      : null;

  if (!contextLink && !contextAction) return pillEl;

  return (
    <div className="lkdv-post-author-stack">
      {pillEl}
      {contextAction ? (
        <button
          type="button"
          className="lkdv-post-context-pill"
          onClick={(event) => {
            event.stopPropagation();
            contextAction.onClick();
          }}
          aria-label={contextAction.ariaLabel ?? contextAction.label}
        >
          {contextAction.icon}
          <span>{contextAction.label}</span>
        </button>
      ) : contextLink ? (
        <Link
          href={contextLink.href}
          className="lkdv-post-context-pill"
          onClick={(event) => event.stopPropagation()}
          aria-label={
            contextLink.kind === 'club'
              ? `Ouvrir le club ${contextLink.label}`
              : `Ouvrir le carnet ${contextLink.label}`
          }
        >
          {contextLink.kind === 'club' ? (
            <Users size={11} aria-hidden="true" />
          ) : (
            <BookOpen size={11} aria-hidden="true" />
          )}
          <span>{contextLink.label}</span>
        </Link>
      ) : null}
    </div>
  );
}

export function IdentityPill({ name, avatarUrl, meta, trust, badge, href, onClick, itemId }: {
  name: string;
  avatarUrl?: string | null;
  meta?: string;
  trust?: number | null;
  badge?: string;
  href?: string;
  onClick?: (element: HTMLButtonElement) => void;
  itemId?: string;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const label = `${name}${meta ? ` — ${meta}` : ''}`;
  const body = (
    <>
      {avatarUrl && avatarUrl !== failedAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant
        <img className="lkdv-post-author-av" src={avatarUrl} alt="" onError={() => setFailedAvatar(avatarUrl)} />
      ) : (
        <span className="lkdv-post-author-av pmi-author-initial" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="lkdv-post-author-txt">
        <span className="lkdv-post-author-line">
          <b>{name}</b>
          {trust != null ? (
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
        {meta && <span className="lkdv-post-author-meta">{meta}</span>}
      </span>
    </>
  );

  if (onClick) return (
    <button type="button" className={`lkdv-post-author${itemId ? ' lkdv-account-glass' : ''}`} aria-label={label} data-hub-item={itemId}
      onClick={(event) => onClick(event.currentTarget)}>{body}</button>
  );
  if (href) return <Link href={href} className="lkdv-post-author" aria-label={label}>{body}</Link>;
  return <span className="lkdv-post-author">{body}</span>;
}

export default PostAuthorPill;
