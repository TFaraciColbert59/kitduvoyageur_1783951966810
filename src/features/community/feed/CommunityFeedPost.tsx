'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReportSheet from '@/components/social/ReportSheet';
import { AccountActionPill } from '@/components/account/AccountActionPill';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import { AccountMoreMenu } from '@/components/account/AccountMoreMenu';
import { authorHandle, authorName, firstMedia, isVideoMedia } from './feed-utils';
import { usePostInteractions } from './usePostInteractions';
import type { FeedPost } from './useCommunityFeed';

export interface CommunityFeedPostProps {
  post: FeedPost;
  user: any;
  onOpenComments: (post: FeedPost) => void;
}

/**
 * Post du fil, copie du post modal du Compte : carré 1:1, image plein cadre,
 * pastille auteur en haut à gauche, `···` en haut à droite, capsule
 * like/commentaire/partage en bas à droite. Aucune légende.
 *
 * Post sans image : fond de la carte Compte, texte par-dessus, hauteur auto
 * plafonnée à la hauteur du carré.
 */
export function CommunityFeedPost({ post, user, onOpenComments }: CommunityFeedPostProps) {
  const { liked, saved, toggleLike, toggleSave, share, copyLink, report } = usePostInteractions(post, user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const clickTimer = useRef<number | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const media = firstMedia(post);
  const video = isVideoMedia(media);
  const hasMedia = Boolean(media);
  const author = post.author;
  const authorHref = author?.id || post.author_id ? `/profil/${author?.id || post.author_id}` : '/communaute';

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (articleRef.current && !articleRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const handleMediaClick = () => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      void toggleLike();
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      void toggleLike();
    }, 220);
  };

  return (
    <article
      ref={articleRef}
      id={`feed-post-${post.id}`}
      className={hasMedia ? 'lkdv-feed-post' : 'lkdv-feed-post lkdv-feed-post--text'}
      aria-label={`Publication de ${authorName(post)}`}
    >
      {hasMedia ? (
        video ? (
          <>
            <video
              className="lkdv-feed-post-video"
              src={media!}
              muted
              loop
              playsInline
              preload="metadata"
              onClick={handleMediaClick}
              aria-label={`Vidéo de ${authorName(post)}`}
            />
            <span className="lkdv-feed-post-play" aria-hidden="true">▶</span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- média communautaire distant
          <img
            className="lkdv-feed-post-media"
            src={media!}
            alt={post.image_alt || `Publication de ${authorName(post)}`}
            loading="lazy"
            onClick={handleMediaClick}
          />
        )
      ) : (
        <p className="lkdv-feed-post-text">{post.content || 'Publication'}</p>
      )}

      <div className="lkdv-feed-post-top">
        <AccountAuthorPill
          name={authorName(post)}
          handle={authorHandle(post)}
          avatarUrl={author?.avatar_url}
          href={authorHref}
        />
      </div>

      <button
        type="button"
        className="pmi-more-pill"
        aria-label="Options de la publication"
        aria-expanded={menuOpen}
        aria-controls="pmi_options_menu"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
      >
        ···
      </button>

      <AccountMoreMenu
        open={menuOpen}
        saved={saved}
        onSave={() => {
          setMenuOpen(false);
          void toggleSave();
        }}
        onRepublish={() => {
          setMenuOpen(false);
          void share();
        }}
        onCopy={() => {
          setMenuOpen(false);
          void copyLink();
        }}
        onReport={() => {
          setMenuOpen(false);
          setReportOpen(true);
        }}
      />

      <AccountActionPill
        liked={liked}
        onLike={() => void toggleLike()}
        onComment={() => onOpenComments(post)}
        onShare={() => void share()}
      />

      <ReportSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={post.id}
        contentType="post"
        onSubmitReport={async (reason, details) => {
          await report(reason, details);
          setReportOpen(false);
        }}
      />

      {user?.id ? null : (
        <Link href="/connexion" className="sr-only">
          Se connecter pour interagir
        </Link>
      )}
    </article>
  );
}

export default CommunityFeedPost;
