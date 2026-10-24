'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReportSheet from '@/components/social/ReportSheet';
import { AccountActionPill } from '@/components/account/AccountActionPill';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import { AccountMoreMenu } from '@/components/account/AccountMoreMenu';
import { authorName, firstMedia, isVideoMedia } from './feed-utils';
import { useToast } from '@/contexts/ToastContext';
import { usePostInteractions, type CommunityAuthReason } from './usePostInteractions';
import { PostDrawer } from '@/components/compte/overlay/PostDrawer';
import type { FeedPost } from './useCommunityFeed';

export interface CommunityFeedPostProps {
  post: FeedPost;
  user: any;
  onOpenComments?: (post: FeedPost) => void;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
  initialPanel?: 'comments' | 'share' | null;
  initialCommentId?: string | null;
}

/**
 * Post du fil, copie du post modal du Compte : carré 1:1, image plein cadre,
 * pastille auteur en haut à gauche, `···` en haut à droite, capsule
 * like/commentaire/partage en bas à droite. Aucune légende.
 *
 * Post sans image : fond de la carte Compte, texte par-dessus, hauteur auto
 * plafonnée à la hauteur du carré.
 */
export function CommunityFeedPost({ post, user, onRequireAuth, initialPanel = null, initialCommentId = null }: CommunityFeedPostProps) {
  const { toast } = useToast();
  const { liked, saved, toggleLike, toggleSave, share, copyLink, report } = usePostInteractions(
    post,
    user,
    onRequireAuth,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [drawerPane, setDrawerPane] = useState<'comments' | 'share' | 'post' | null>(initialPanel);
  const clickTimer = useRef<number | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const media = firstMedia(post);
  const video = isVideoMedia(media);
  const hasMedia = Boolean(media);

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
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (drawerPane) return;
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
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button,a,input')) return;
        swipeStart.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      }}
      onPointerMove={(event) => {
        const start = swipeStart.current;
        if (!start || drawerPane) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swiped.current = true;
        setMenuOpen(false);
        setDrawerPane(dx > 0 ? 'share' : 'comments');
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || drawerPane) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swiped.current = true;
        setMenuOpen(false);
        setDrawerPane(dx > 0 ? 'share' : 'comments');
      }}
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
            draggable={false}
            onClick={handleMediaClick}
          />
        )
      ) : (
        <p className="lkdv-feed-post-text">{post.content || 'Publication'}</p>
      )}

      <div className="lkdv-feed-post-top">
        <AccountAuthorPill
          name={authorName(post)}
          handle={typeof (post.author as any)?.handle === 'string' ? (post.author as any).handle : undefined}
          avatarUrl={post.author?.avatar_url ?? null}
          href={post.author?.id || post.author_id ? `/profil/${post.author?.id || post.author_id}` : '/communaute'}
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>

      <AccountMoreMenu
        open={menuOpen}
        saved={saved}
        onSave={() => {
          setMenuOpen(false);
          void toggleSave().then((result) => {
            if (result === 'ok') toast(saved ? 'Retiré des enregistrements.' : 'Enregistré.', 'success');
            if (result === 'error') toast('Impossible d’enregistrer cette publication.', 'error');
          });
        }}
        onRepublish={() => {
          setMenuOpen(false);
          void share().then((result) => {
            if (result === 'copied') toast('Lien copié.', 'success');
            if (result === 'failed') toast('Partage indisponible.', 'error');
          });
        }}
        onCopy={() => {
          setMenuOpen(false);
          void copyLink().then((ok) => {
            toast(ok ? 'Lien copié.' : 'Copie impossible.', ok ? 'success' : 'error');
          });
        }}
        onReport={() => {
          setMenuOpen(false);
          setReportOpen(true);
        }}
      />

      <AccountActionPill
        liked={liked}
        onLike={() => {
          void toggleLike().then((result) => {
            if (result === 'error') toast('Impossible d’aimer cette publication.', 'error');
          });
        }}
        onComment={() => setDrawerPane('comments')}
        onShare={() => setDrawerPane('share')}
      />

      <ReportSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={post.id}
        contentType="post"
        onSubmitReport={async (reason, details) => {
          const result = await report(reason, details);
          if (result === 'ok') {
            setReportOpen(false);
            toast('Signalement envoyé. Merci.', 'success');
          } else if (result === 'error') {
            toast('Le signalement n’a pas pu être envoyé.', 'error');
          }
        }}
      />

      {drawerPane ? (
        <PostDrawer
          postId={post.id}
          initialPane={drawerPane}
          initialCommentId={initialCommentId}
          onClose={() => setDrawerPane(null)}
          onOpenProfile={(id) => { window.location.href = `/profil/${id}`; }}
        />
      ) : null}

      {user?.id ? null : (
        <Link href="/connexion" className="sr-only">
          Se connecter pour interagir
        </Link>
      )}
    </article>
  );
}

export default CommunityFeedPost;
