'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReportSheet from '@/components/social/ReportSheet';
import { AccountActionPill } from '@/components/account/AccountActionPill';
import { PostAuthorPill } from './PostAuthorPill';
import { AccountMoreMenu } from '@/components/account/AccountMoreMenu';
import { authorName, firstMedia, isVideoMedia } from './feed-utils';
import { CommunityPostSoundtrack } from './CommunityPostSoundtrack';
import { Bookmark, Flag, Link2, MoreHorizontal, Repeat2, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { PostGlassPanel } from '@/features/posts/ui/PostGlassPanel';
import { CommunityPostMedia } from './CommunityPostMedia';
import { PostCommentsPanel } from './PostCommentsPanel';
import { PostSharePanel } from './PostSharePanel';
import { usePostInteractions, type CommunityAuthReason } from './usePostInteractions';
import type { FeedPost } from './useCommunityFeed';

export interface CommunityFeedPostProps {
  post: FeedPost;
  user: any;
  onOpenComments?: (post: FeedPost) => void;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
  initialPanel?: 'comments' | 'share' | null;
  initialCommentId?: string | null;
  /** Les deux premières cartes chargent leur image sans attendre le scroll. */
  mediaPriority?: boolean;
  /** Rendu dans un message : le panneau ne verrouille pas la page et ne la
   *  rescrolle pas (le fil de discussion gère son propre défilement). */
  embedded?: boolean;
}

/**
 * Post du fil : carte 406×541, image plein cadre, pastille auteur, `···` 44 et
 * capsule d’actions 44. Panneaux commentaires/partage plein cadre, Échap,
 * focus rendu au déclencheur, composer au-dessus du clavier.
 */
export function CommunityFeedPost({
  post,
  user,
  onRequireAuth,
  initialPanel = null,
  initialCommentId = null,
  mediaPriority = false,
  embedded = false,
}: CommunityFeedPostProps) {
  const { toast } = useToast();
  const { liked, saved, toggleLike, toggleSave, share, copyLink, report } = usePostInteractions(
    post,
    user,
    onRequireAuth,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const headerPost = {
    ...post,
    title: null,
    author: post.author ? { ...post.author, location: null, trust_score: null } : post.author,
  };
  const [counts, setCounts] = useState({
    likes: post.likes_count ?? 0,
    comments: post.comments_count ?? 0,
    shares: post.shares_count ?? 0,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [panel, setPanel] = useState<'comments' | 'share' | null>(initialPanel);
  const panelScrollRef = useRef(0);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const media = firstMedia(post);
  const video = isVideoMedia(media);
  const hasMedia = Boolean(media);
  const optionsId = `feed-options-${post.id}`;

  const openPanel = (next: 'comments' | 'share') => {
    panelScrollRef.current = window.scrollY;
    panelTriggerRef.current = document.activeElement as HTMLElement | null;
    setMenuOpen(false);
    setPanel(next);
  };

  const closePanel = useCallback(() => {
    setPanel(null);
    window.requestAnimationFrame(() => {
      panelTriggerRef.current?.focus?.({ preventScroll: true });
      panelTriggerRef.current = null;
    });
  }, []);

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

  /* Échap : ferme d’abord le menu, puis le panneau. */
  useEffect(() => {
    if (!menuOpen && !panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      closePanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closePanel, menuOpen, panel]);

  /* Verrou du fond (sans lutter contre le clavier virtuel) + remontée du
     panneau au-dessus du clavier via le visual viewport. Dans la Communauté,
     la page est déjà figée (seul le fil défile) : rien à verrouiller ni à
     replacer, ce qui évite les sauts du fil pendant les gestes. */
  useEffect(() => {
    if (!panel || embedded) return;
    const y = panelScrollRef.current;
    const article = articleRef.current;
    const pageLocked = document.documentElement.classList.contains('lkdv-no-page-scroll');
    const previous = document.body.style.overflow;
    if (!pageLocked) document.body.style.overflow = 'hidden';
    const restore = () => {
      const viewport = window.visualViewport;
      if (viewport && viewport.height < window.innerHeight - 80) return;
      window.scrollTo(0, y);
    };
    const frame = pageLocked ? 0 : window.requestAnimationFrame(restore);
    const interval = pageLocked ? 0 : window.setInterval(restore, 32);
    const viewport = window.visualViewport;
    const updateKeyboard = () => {
      if (!article || !viewport) return;
      const inset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
      const capped = Math.min(inset, 180);
      article.style.setProperty('--lkdv-keyboard-offset', `${capped}px`);
      if (capped > 8) article.dataset.keyboard = 'true';
      else delete article.dataset.keyboard;
    };
    updateKeyboard();
    viewport?.addEventListener('resize', updateKeyboard);
    viewport?.addEventListener('scroll', updateKeyboard);
    return () => {
      if (!pageLocked) {
        window.cancelAnimationFrame(frame);
        window.clearInterval(interval);
        document.body.style.overflow = previous;
        window.scrollTo(0, y);
      }
      viewport?.removeEventListener('resize', updateKeyboard);
      viewport?.removeEventListener('scroll', updateKeyboard);
      if (article) {
        article.style.removeProperty('--lkdv-keyboard-offset');
        delete article.dataset.keyboard;
      }
    };
  }, [panel, embedded]);

  /* Si le panneau initial vient d’un lien profond, poser le focus dedans. */
  useEffect(() => {
    if (!panel) return;
    const timer = window.setTimeout(() => {
      articleRef.current
        ?.querySelector<HTMLElement>(
          '.lkdv-post-panel input, .lkdv-post-panel button',
        )
        ?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [panel]);

  /* Dans un message, le panneau ne doit jamais déplacer le fil : on épingle la
     position du conteneur défilant pendant toute la durée d'ouverture (le
     navigateur la déplace sinon pour amener le focus du panneau à l'écran). */
  useEffect(() => {
    if (!panel || !embedded) return;
    const scroller = articleRef.current?.closest('.mthread') as HTMLElement | null;
    if (!scroller) return;
    const pinned = scroller.scrollTop;
    const pin = () => {
      if (Math.abs(scroller.scrollTop - pinned) > 1) scroller.scrollTop = pinned;
    };
    const interval = window.setInterval(pin, 16);
    const stop = window.setTimeout(() => window.clearInterval(interval), 700);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      pin();
    };
  }, [panel, embedded]);

  return (
    <article
      ref={articleRef}
      id={`feed-post-${post.id}`}
      className={hasMedia ? 'lkdv-feed-post' : 'lkdv-feed-post lkdv-feed-post--text'}
      aria-label={`Publication de ${authorName(post)}`}
      data-keyboard="false"
      style={{ touchAction: 'pan-y' }}
      /* Trois volets côte à côte : partage ← photo → messages. Depuis la photo,
         glisser vers la gauche ouvre les messages, vers la droite le partage ;
         le panneau se referme par le geste inverse (géré par PostGlassPanel).
         Un seul geste = une seule bascule : le doigt est oublié dès qu'elle a lieu. */
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (panel || target.closest('button,a,input,textarea,.lkdv-post-panel-slot')) {
          swipeStart.current = null;
          return;
        }
        swipeStart.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      }}
      onPointerMove={(event) => {
        const start = swipeStart.current;
        if (!start || panel) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swipeStart.current = null;
        swiped.current = true;
        setMenuOpen(false);
        openPanel(dx > 0 ? 'share' : 'comments');
      }}
      onPointerUp={() => {
        swipeStart.current = null;
      }}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      {hasMedia && media ? (
        <CommunityPostMedia
          media={media}
          isVideo={video}
          poster={post.media_urls?.find((url) => !isVideoMedia(url)) ?? undefined}
          alt={post.image_alt ?? null}
          priority={mediaPriority}
          likesCount={counts.likes}
          commentsCount={counts.comments}
          sharesCount={counts.shares}
          liked={liked}
          inert={Boolean(panel)}
          shouldIgnoreClick={() => {
            if (!swiped.current) return false;
            swiped.current = false;
            return true;
          }}
          onLike={() => {
            setCounts((value) => ({ ...value, likes: Math.max(0, value.likes + (liked ? -1 : 1)) }));
            void toggleLike().then((result) => {
              if (result === 'error') {
                setCounts((value) => ({
                  ...value,
                  likes: Math.max(0, value.likes + (liked ? 1 : -1)),
                }));
              }
            });
          }}
          onComment={() => openPanel('comments')}
          onShare={() => openPanel('share')}
        />
      ) : (
        <p className="lkdv-feed-post-text">{post.content || 'Publication'}</p>
      )}

      {post.soundtrack_url ? (
        <div className="absolute bottom-3 left-3 z-20 max-w-[65%]" onPointerDown={(event) => event.stopPropagation()}>
          <CommunityPostSoundtrack
            url={post.soundtrack_url}
            title={post.soundtrack_title}
            creator={post.soundtrack_creator}
            sourceUrl={post.soundtrack_source_url}
          />
        </div>
      ) : null}

      <div ref={headerRef} className="lkdv-feed-post-top">
        <PostAuthorPill post={post} />
      <div
        ref={headerRef}
        className="lkdv-feed-post-top"
        inert={Boolean(panel)}
        aria-hidden={panel ? true : undefined}
      >
        <PostAuthorPill post={headerPost} />
      </div>

      {/* Seul contrôle posé sur la photo : les trois points, en haut à droite.
          Aucune croix — un panneau se referme par le geste inverse ou Échap. */}
      {panel ? null : (
        <button
          type="button"
          className="pmi-more-pill lkdv-feed-post-options"
          aria-label="Options de la publication"
          aria-expanded={menuOpen}
          aria-controls={optionsId}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      )}

      {menuOpen ? (
        <div id={optionsId} className="lkdv-feed-options-rail" role="menu" aria-label="Options de la publication">
          <button
            type="button"
            role="menuitem"
            aria-label={saved ? 'Retirer des enregistrements' : 'Enregistrer'}
            onClick={() => {
              setMenuOpen(false);
              void toggleSave();
            }}
          >
            <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Copier le lien"
            onClick={() => {
              setMenuOpen(false);
              void copyLink().then((ok) =>
                toast(
                  ok ? 'Lien copié.' : 'Copie impossible.',
                  ok ? 'success' : 'error',
                ),
              );
            }}
          >
            <Link2 size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Republier"
            onClick={() => {
              setMenuOpen(false);
              void share();
            }}
          >
            <Repeat2 size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Signaler"
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            <Flag size={19} aria-hidden="true" />
          </button>
          {user?.id === post.author_id ? (
            <button
              type="button"
              role="menuitem"
              aria-label="Supprimer"
              className="is-danger"
              onClick={() => setMenuOpen(false)}
            >
              <Trash2 size={19} aria-hidden="true" />
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
        <PostGlassPanel side="comments" headerRef={headerRef} onClose={closePanel} onSwitch={setPanel}>
          <div className="lkdv-feed-panel-surface">
            <PostCommentsPanel
              post={post}
              user={user}
              onClose={closePanel}
              onRequireAuth={onRequireAuth}
              focusCommentId={initialCommentId}
            />
          </div>
        </PostGlassPanel>
      ) : null}
      {panel === 'share' ? (
        <PostGlassPanel side="share" headerRef={headerRef} onClose={closePanel} onSwitch={setPanel}>
          <div className="lkdv-feed-panel-surface">
            <PostSharePanel
              post={post}
              user={user}
              onClose={closePanel}
              onRequireAuth={onRequireAuth}
            />
          </div>
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
