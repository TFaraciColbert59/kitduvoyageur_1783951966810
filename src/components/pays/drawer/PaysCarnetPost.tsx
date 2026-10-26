'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ReportSheet from '@/components/social/ReportSheet';
import { AccountActionPill } from '@/components/account/AccountActionPill';
import { PostAuthorPill } from '@/features/community/feed/PostAuthorPill';
import { AccountMoreMenu } from '@/components/account/AccountMoreMenu';
import { authorName, firstMedia, isVideoMedia, timeAgo } from '@/features/community/feed/feed-utils';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import { useToast } from '@/contexts/ToastContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePostShareTargets } from '@/features/community/feed/usePostShareTargets';
import { PostGlassPanel } from '@/features/posts/ui/PostGlassPanel';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';

export interface PaysCarnetFeedItem {
  id: string;
  title: string;
  destination: string | null;
  description: string | null;
  cover: string | null;
  likes: number;
  comments: number;
  createdAt: string;
  author?: { id: string; full_name: string | null; avatar_url: string | null; location?: string | null };
  userLiked: boolean;
  userFavorited: boolean;
}

function toFeedPost(item: PaysCarnetFeedItem): FeedPost {
  return {
    id: item.id,
    title: item.destination,
    content: item.description,
    location: item.destination,
    image_url: item.cover,
    created_at: item.createdAt,
    likes_count: item.likes,
    comments_count: item.comments,
    author: item.author
      ? { id: item.author.id, full_name: item.author.full_name, avatar_url: item.author.avatar_url, location: item.author.location ?? null }
      : undefined,
  };
}

/** Actions d'un carnet, calquées sur le post Communauté mais branchées sur les tables carnets. */
function usePaysCarnetInteractions(item: PaysCarnetFeedItem, user: { id?: string } | null | undefined) {
  const { triggerHaptic } = useHapticFeedback();
  const [liked, setLiked] = useState(item.userLiked);
  const [likesCount, setLikesCount] = useState(item.likes);
  const [saved, setSaved] = useState(item.userFavorited);
  const [busy, setBusy] = useState(false);
  const permalink = `/carnets/${item.id}`;
  const isGuest = !user?.id;

  const toggleLike = useCallback(async (): Promise<'ok' | 'error' | 'auth'> => {
    if (isGuest) return 'auth';
    if (busy) return 'error';
    setBusy(true);
    const previous = liked;
    const previousCount = likesCount;
    setLiked(!previous);
    setLikesCount(Math.max(0, previousCount + (previous ? -1 : 1)));
    triggerHaptic('light');
    const supabase = createClient();
    const { error } = previous
      ? await supabase.from('carnet_likes').delete().eq('carnet_id', item.id).eq('user_id', user!.id)
      : await supabase.from('carnet_likes').upsert({ carnet_id: item.id, user_id: user!.id, reaction: 'like' }, { onConflict: 'carnet_id,user_id' });
    setBusy(false);
    if (error) {
      setLiked(previous);
      setLikesCount(previousCount);
      return 'error';
    }
    return 'ok';
  }, [busy, isGuest, item.id, liked, likesCount, triggerHaptic, user]);

  const toggleSave = useCallback(async (): Promise<'ok' | 'error' | 'auth'> => {
    if (isGuest) return 'auth';
    const next = !saved;
    setSaved(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from('carnet_favorites').insert({ carnet_id: item.id, user_id: user!.id })
      : await supabase.from('carnet_favorites').delete().eq('carnet_id', item.id).eq('user_id', user!.id);
    if (error) {
      setSaved(!next);
      return 'error';
    }
    return 'ok';
  }, [isGuest, item.id, saved, user]);

  const shareUrl = useCallback(() => `${typeof window !== 'undefined' ? window.location.origin : ''}${permalink}`, [permalink]);

  const share = useCallback(async (): Promise<'shared' | 'copied' | 'failed'> => {
    const url = shareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
        return 'shared';
      }
    } catch {
      return 'failed';
    }
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }, [item.title, shareUrl]);

  const copyLink = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      return true;
    } catch {
      return false;
    }
  }, [shareUrl]);

  const report = useCallback(
    async (reason: string, details?: string): Promise<'ok' | 'error' | 'auth'> => {
      if (isGuest) return 'auth';
      const { error } = await createClient().from('comment_reports').insert({
        comment_id: item.id,
        reporter_id: user!.id,
        reason: details ? `${reason} — ${details}` : reason,
        table_name: 'carnets',
      });
      return error ? 'error' : 'ok';
    },
    [isGuest, item.id, user]
  );

  return { liked, saved, likesCount, busy, isGuest, toggleLike, toggleSave, share, copyLink, report, permalink };
}

function CarnetCommentsPanel({ item, user, onClose }: { item: PaysCarnetFeedItem; user: { id: string } | null; onClose: () => void }) {
  const { comments, loading, error, send, remove } = useCarnetComments({ carnetId: item.id, user });
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const canWrite = Boolean(user?.id);

  const submit = async () => {
    if (!draft.trim() || busy) return;
    if (!canWrite) {
      toast('Connectez-vous pour commenter.', 'error');
      return;
    }
    setBusy(true);
    const ok = await send(draft);
    if (ok) setDraft('');
    else toast('Envoi impossible.', 'error');
    setBusy(false);
  };

  return (
    <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Commentaires du carnet">
      <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>
      <div className="lkdv-post-panel-body">
        {loading ? <p className="py-6 text-center text-[12px] text-[#56665D]">Chargement…</p> : null}
        {error ? <p className="py-6 text-center text-[12px] text-[#7A241C]" role="alert">{error}</p> : null}
        {!loading && !error && comments.length === 0 ? <p className="py-6 text-center text-[12px] text-[#56665D]">Sois le premier à répondre.</p> : null}
        {comments.map((comment) => (
          <div key={comment.id} className="lkdv-comment">
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="lkdv-comment-av" src={comment.authorAvatar} alt="" />
            ) : (
              <span className="lkdv-comment-av pmi-author-initial" aria-hidden="true">
                {(comment.authorName || 'V').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="lkdv-comment-body">
              <div className="lkdv-comment-head">
                <span className="lkdv-comment-name">{comment.authorName}</span>
                <span className="lkdv-comment-time">{timeAgo(comment.createdAt)}</span>
              </div>
              <p className="lkdv-comment-text">{comment.content}</p>
              {user?.id === comment.authorId ? (
                <div className="lkdv-comment-actions">
                  <button type="button" onClick={() => void remove(comment.id)}>Supprimer</button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {canWrite ? (
        <div className="lkdv-post-panel-foot">
          <PostReplyComposer value={draft} onChange={setDraft} onSend={() => void submit()} placeholder="Ajouter un commentaire…" inputLabel="Ajouter un commentaire" ariaLabel="Publier le commentaire" busy={busy} />
        </div>
      ) : (
        <div className="lkdv-comments-gate">
          <p>Connectez-vous pour commenter.</p>
          <Link href="/connexion">Se connecter</Link>
        </div>
      )}
      <button type="button" className="sr-only" onClick={onClose}>Fermer</button>
    </div>
  );
}

function CarnetSharePanel({ item, user, onClose }: { item: PaysCarnetFeedItem; user: { id: string } | null; onClose: () => void }) {
  const { toast } = useToast();
  const { conversations, loading, sending, send } = usePostShareTargets(user?.id);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = conversations.filter((conversation) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${conversation.title || ''} ${conversation.name || ''}`.toLowerCase().includes(text);
  });
  const permalink = `/carnets/${item.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${permalink}`);
      setCopied(true);
      toast('Lien copié.', 'success');
    } catch {
      toast('Copie impossible.', 'error');
    }
  };

  const shareNative = async () => {
    if (!user?.id) {
      toast('Connectez-vous pour partager.', 'error');
      return;
    }
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: `${window.location.origin}${permalink}` });
      else await copy();
    } catch {
      /* annulé */
    }
  };

  return (
    <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Partager le carnet">
      <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>
      <div className="lkdv-post-panel-body">
        <div className="lkdv-search-box">
          <Icon name="search" size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une personne ou un groupe…" aria-label="Rechercher un destinataire" />
        </div>
        <div className="lkdv-share-actions">
          <button type="button" className="lkdv-share-action" onClick={() => document.getElementById(`share-carnet-${item.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
            <span className="ico"><Icon name="send" size={18} aria-hidden="true" /></span>
            Envoyer
          </button>
          <button type="button" className="lkdv-share-action" onClick={() => void copy()}>
            <span className="ico"><Icon name="link" size={18} aria-hidden="true" /></span>
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button type="button" className="lkdv-share-action" onClick={() => void shareNative()}>
            <span className="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
              </svg>
            </span>
            Partager
          </button>
        </div>
        <div id={`share-carnet-${item.id}`} className="mt-1">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#56665D]">Envoyer en message</p>
          {!user?.id ? (
            <p className="lkdv-section-empty">Connectez-vous pour envoyer.</p>
          ) : loading ? (
            <p className="lkdv-section-loading">Chargement des conversations…</p>
          ) : filtered.length === 0 ? (
            <p className="lkdv-section-empty">Aucun destinataire trouvé.</p>
          ) : (
            filtered.map((conversation) => {
              const title = conversation.title || conversation.name || 'Conversation';
              return (
                <div key={conversation.id} className="lkdv-share-conv">
                  {conversation.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                    <img src={conversation.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ddebd8] text-[11px] font-bold text-[#17402C]">
                      {title.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <b>{title}</b>
                    <small>{conversation.type === 'group' ? 'Groupe' : 'Message privé'}</small>
                  </div>
                  <button
                    type="button"
                    disabled={sending === conversation.id}
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/carnets/share', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ carnetId: item.id, conversationId: conversation.id }),
                        });
                        const ok = response.ok;
                        toast(ok ? 'Carnet envoyé.' : 'Envoi impossible.', ok ? 'success' : 'error');
                        if (ok) onClose();
                      } catch {
                        toast('Envoi impossible.', 'error');
                      }
                    }}
                  >
                    {sending === conversation.id ? '…' : 'Envoyer'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Post carnet du pays : même bloc visuel que le fil Communauté
 * (média plein cadre, pastille auteur, `···`, capsule like / message / partage),
 * branché sur les tables `carnet_*` et l’URL `/carnets/:id`.
 */
export function PaysCarnetPost({ item, user }: { item: PaysCarnetFeedItem; user: { id: string } | null }) {
  const { toast } = useToast();
  const post = toFeedPost(item);
  const { liked, saved, toggleLike, toggleSave, share, copyLink, report } = usePaysCarnetInteractions(item, user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [panel, setPanel] = useState<'comments' | 'share' | null>(null);
  const clickTimer = useRef<number | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const expandedRef = useRef(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const media = firstMedia(post);
  const video = isVideoMedia(media);
  const hasMedia = Boolean(media);

  useLayoutEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    if (panel && !expandedRef.current) {
      expandedRef.current = true;
      const from = el.getBoundingClientRect().height;
      const to = el.offsetWidth;
      el.style.overflow = 'hidden';
      el.style.transition = 'none';
      el.style.height = `${from}px`;
      window.requestAnimationFrame(() => {
        el.style.transition = 'height .4s cubic-bezier(.22,1,.36,1)';
        el.style.height = `${to}px`;
      });
    } else if (!panel && expandedRef.current) {
      expandedRef.current = false;
      const from = el.getBoundingClientRect().height;
      el.style.transition = 'none';
      el.style.height = 'auto';
      const to = el.getBoundingClientRect().height;
      el.style.height = `${from}px`;
      window.requestAnimationFrame(() => {
        el.style.transition = 'height .4s cubic-bezier(.22,1,.36,1)';
        el.style.height = `${to}px`;
        window.setTimeout(() => {
          el.style.height = '';
          el.style.transition = '';
          el.style.overflow = '';
        }, 420);
      });
    }
  }, [panel]);

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
      void toggleLike().then((result) => {
        if (result === 'error') toast('Impossible d’aimer ce carnet.', 'error');
        if (result === 'auth') toast('Connectez-vous pour aimer.', 'error');
      });
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      void toggleLike().then((result) => {
        if (result === 'error') toast('Impossible d’aimer ce carnet.', 'error');
        if (result === 'auth') toast('Connectez-vous pour aimer.', 'error');
      });
    }, 220);
  };

  return (
    <article
      ref={articleRef}
      id={`pays-carnet-${item.id}`}
      className={hasMedia ? 'lkdv-feed-post' : 'lkdv-feed-post lkdv-feed-post--text'}
      aria-label={`Carnet de ${authorName(post)}`}
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
        video ? (
          <>
            <video className="lkdv-feed-post-video" src={media!} muted loop playsInline preload="metadata" onClick={handleMediaClick} aria-label={`Vidéo de ${authorName(post)}`} />
            <span className="lkdv-feed-post-play" aria-hidden="true">▶</span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- média réel du carnet
          <img className="lkdv-feed-post-media" src={media!} alt={item.title} loading="lazy" draggable={false} onClick={handleMediaClick} />
        )
      ) : (
        <p className="lkdv-feed-post-text">{item.description || item.title}</p>
      )}

      <div ref={headerRef} className="lkdv-feed-post-top">
        <PostAuthorPill post={post} />
      </div>

      <button
        type="button"
        className="pmi-more-pill"
        aria-label="Options du carnet"
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
            if (result === 'error') toast('Impossible d’enregistrer ce carnet.', 'error');
            if (result === 'auth') toast('Connectez-vous pour enregistrer.', 'error');
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
            if (result === 'error') toast('Impossible d’aimer ce carnet.', 'error');
            if (result === 'auth') toast('Connectez-vous pour aimer.', 'error');
          });
        }}
        onComment={() => setPanel('comments')}
        onShare={() => setPanel('share')}
      />

      <ReportSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={item.id}
        contentType="carnet"
        onSubmitReport={async (reason, details) => {
          const result = await report(reason, details);
          if (result === 'ok') {
            setReportOpen(false);
            toast('Signalement envoyé. Merci.', 'success');
          } else if (result === 'error') {
            toast('Le signalement n’a pas pu être envoyé.', 'error');
          } else {
            toast('Connectez-vous pour signaler.', 'error');
          }
        }}
      />

      {panel === 'comments' ? (
        <PostGlassPanel side="comments" headerRef={headerRef} onClose={() => setPanel(null)} onSwitch={(next) => setPanel(next)}>
          <CarnetCommentsPanel item={item} user={user} onClose={() => setPanel(null)} />
        </PostGlassPanel>
      ) : null}
      {panel === 'share' ? (
        <PostGlassPanel side="share" headerRef={headerRef} onClose={() => setPanel(null)} onSwitch={(next) => setPanel(next)}>
          <CarnetSharePanel item={item} user={user} onClose={() => setPanel(null)} />
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

export default PaysCarnetPost;
