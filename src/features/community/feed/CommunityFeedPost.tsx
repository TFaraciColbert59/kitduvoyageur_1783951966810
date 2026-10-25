'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReportSheet from '@/components/social/ReportSheet';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import { PostCardSurface } from '@/components/compte/overlay/PostCardSurface';
import { PostAuthorPill } from './PostAuthorPill';
import { Bookmark, Flag, Link2, MoreHorizontal, Repeat2, Trash2, X } from 'lucide-react';
import { authorName, firstMedia, isVideoMedia } from './feed-utils';
import { useToast } from '@/contexts/ToastContext';
import { usePostInteractions, type CommunityAuthReason } from './usePostInteractions';
import { PostGlassPanel } from '@/features/posts/ui/PostGlassPanel';
import { PostCommentsPanel } from './PostCommentsPanel';
import { PostSharePanel } from './PostSharePanel';
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
  const headerPost = { ...post, title: null, author: post.author ? { ...post.author, location: null, trust_score: null } : post.author };
  const [counts, setCounts] = useState({
    likes: post.likes_count ?? 0,
    comments: post.comments_count ?? 0,
    shares: post.shares_count ?? 0,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [panel, setPanel] = useState<'comments' | 'share' | null>(initialPanel);
  const clickTimer = useRef<number | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
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
    if (panel) return;
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
        if (!start || panel) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swiped.current = true;
        setMenuOpen(false);
        setPanel(dx > 0 ? 'share' : 'comments');
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || panel) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swiped.current = true;
        setMenuOpen(false);
        setPanel(dx > 0 ? 'share' : 'comments');
      }}
    >
      {hasMedia ? (
        <PostCardSurface
          mediaUrls={media ? [media] : []}
          mediaIndex={0}
          onMediaIndexChange={() => {}}
          likesCount={counts.likes}
          commentsCount={counts.comments}
          sharesCount={counts.shares}
          liked={liked}
          onLike={() => {
            setCounts((value) => ({ ...value, likes: Math.max(0, value.likes + (liked ? -1 : 1)) }));
            void toggleLike().then((result) => {
              if (result === 'error') setCounts((value) => ({ ...value, likes: Math.max(0, value.likes + (liked ? 1 : -1)) }));
            });
          }}
          onComment={() => setPanel('comments')}
          onShare={() => setPanel('share')}
          onMediaDoubleClick={() => void toggleLike()}
          isVideo={video}
        />
      ) : (
        <p className="lkdv-feed-post-text">{post.content || 'Publication'}</p>
      )}

      <div ref={headerRef} className="lkdv-feed-post-top">
        <PostAuthorPill post={headerPost} />
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
        {menuOpen ? <X size={18} aria-hidden="true" /> : <MoreHorizontal size={18} aria-hidden="true" />}
      </button>

      {panel ? (
        <button type="button" className="lkdv-feed-post-close" aria-label="Fermer la publication" onClick={() => setPanel(null)}>
          <X size={18} aria-hidden="true" />
        </button>
      ) : null}

      {menuOpen ? (
        <div className="lkdv-feed-options-rail" role="menu" aria-label="Options de la publication">
          <button type="button" role="menuitem" aria-label={saved ? 'Retirer des enregistrements' : 'Enregistrer'} onClick={() => { setMenuOpen(false); void toggleSave(); }}>
            <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button type="button" role="menuitem" aria-label="Copier le lien" onClick={() => { setMenuOpen(false); void copyLink().then((ok) => toast(ok ? 'Lien copié.' : 'Copie impossible.', ok ? 'success' : 'error')); }}>
            <Link2 size={17} />
          </button>
          <button type="button" role="menuitem" aria-label="Republier" onClick={() => { setMenuOpen(false); void share(); }}>
            <Repeat2 size={17} />
          </button>
          <button type="button" role="menuitem" aria-label="Signaler" onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
            <Flag size={17} />
          </button>
          {user?.id === post.author_id ? (
            <button type="button" role="menuitem" aria-label="Supprimer" className="is-danger" onClick={() => setMenuOpen(false)}>
              <Trash2 size={17} />
            </button>
          ) : null}
        </div>
      ) : null}

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

      {panel === 'comments' ? (
        <PostGlassPanel
          side="comments"
          headerRef={headerRef}
          onClose={() => setPanel(null)}
          onSwitch={(next) => setPanel(next)}
        >
          <PostCommentsPanel
            post={post}
            user={user}
            onClose={() => setPanel(null)}
            onRequireAuth={onRequireAuth}
            focusCommentId={initialCommentId}
          />
        </PostGlassPanel>
      ) : null}
      {panel === 'share' ? (
        <PostGlassPanel
          side="share"
          headerRef={headerRef}
          onClose={() => setPanel(null)}
          onSwitch={(next) => setPanel(next)}
        >
          <PostSharePanel
            post={post}
            user={user}
            onClose={() => setPanel(null)}
            onRequireAuth={onRequireAuth}
          />
        </PostGlassPanel>
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
