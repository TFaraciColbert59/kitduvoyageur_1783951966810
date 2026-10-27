'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Flag, Heart, Link2, MessageCircle, Send, X } from 'lucide-react';
import { LensPager } from '@/components/compte/drawer/LensPager';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { PostAuthorPill } from '@/features/community/feed/PostAuthorPill';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import { CarnetSharePane } from './panes/CarnetSharePane';

type Pane = 'share' | 'post' | 'comments';
const ORDER: Pane[] = ['share', 'post', 'comments'];
const INDEX: Record<Pane, number> = { share: 0, post: 1, comments: 2 };

/** Même format de compteur que le post du Compte (`1,2 k` au-delà de 1000). */
function formatCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')} k`;
}

/**
 * Date réelle du moment : `carnets.start_date` + (jour − 1). Aucune date n'est
 * inventée quand le carnet n'a pas de date de départ.
 */
export function momentDate(startDate: string | null, dayNumber: number): string | null {
  if (!startDate) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? `${startDate}T12:00:00Z` : startDate;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Math.max(0, dayNumber - 1));
  return date.toISOString();
}

export interface CarnetPostSheetProps {
  detail: CarnetDetail;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  comments: {
    comments: CarnetComment[];
    loading: boolean;
    send: (content: string) => Promise<boolean>;
    remove: (commentId: string) => Promise<boolean>;
  };
  canWrite: boolean;
  currentUserId: string | null;
  onRequireAuth: () => void;
  onOpenViewer: (index: number) => void;
  onLike: () => void;
  /** Lien réel du carnet, partagé depuis le panneau de partage. */
  shareUrl: string;
  onCopied: () => void;
  /** Enregistrer / Signaler : les actions réelles du carnet, dans le menu ···. */
  saved: boolean;
  onSave: () => void;
  onReport: () => void;
}

/**
 * Post d'un moment du carnet, dans la forme exacte du post du Compte.
 *
 * Même feuille (`OverlaySheet` + `.lkdv-post-drawer`), même en-tête
 * (`PostAuthorPill`, `×`), mêmes marges (`.lkdv-post-pane`, média 1:1 bord à
 * bord, `.lkdv-post-media-glass` en bas à droite), mêmes transitions
 * (`LensPager`, glissement de feuille). Seul le contenu est celui du carnet :
 * l'image du moment, son jour et son heure, son lieu, sa légende, ses
 * j’aime et ses commentaires réels.
 */
export function CarnetPostSheet({
  detail,
  index,
  onIndexChange,
  onClose,
  comments,
  canWrite,
  currentUserId,
  onRequireAuth,
  onOpenViewer,
  onLike,
  shareUrl,
  onCopied,
  saved,
  onSave,
  onReport,
}: CarnetPostSheetProps) {
  const items = detail.photoMoments;
  const safeIndex = items.length === 0 ? 0 : Math.max(0, Math.min(index, items.length - 1));
  const moment = items[safeIndex] ?? null;

  const [pane, setPane] = useState<Pane>('post');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [likePulse, setLikePulse] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [grabbing, setGrabbing] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);
  const panelStart = useRef<{ x: number; y: number } | null>(null);

  const author = detail.author;
  const createdAt = moment ? momentDate(detail.startDate, moment.dayNumber) : null;

  /* Le post du Compte se construit depuis un `FeedPost` : on lui donne la
     donnée réelle du carnet, jamais une valeur de remplissage. */
  const feedPost = useMemo<FeedPost>(
    () => ({
      id: moment?.id ?? detail.id,
      content: moment?.caption ?? detail.description ?? '',
      title: moment?.place ?? detail.destination ?? null,
      created_at: createdAt ?? undefined,
      likes_count: detail.engagement.likes,
      comments_count: detail.engagement.comments,
      author_id: author?.id ?? null,
      author: author
        ? {
            id: author.id,
            full_name: author.name,
            avatar_url: author.avatarUrl,
            handle: author.handle,
            trust_score: author.trustScore,
          }
        : undefined,
    }),
    [author, createdAt, detail.description, detail.destination, detail.engagement.comments, detail.engagement.likes, detail.id, moment],
  );

  const go = (delta: number) => {
    if (items.length === 0) return;
    onIndexChange((safeIndex + delta + items.length) % items.length);
  };

  const burstLike = () => {
    setBurst((value) => value + 1);
    if (!detail.engagement.liked) onLike();
  };

  const haptic = (pattern: number | number[] = 8) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* optionnel */
    }
  };

  const like = () => {
    setLikePulse((value) => value + 1);
    haptic(detail.engagement.liked ? 6 : 12);
    onLike();
  };

  /* Un tap ouvre la photo, deux taps aiment : le second annule l'ouverture. */
  const onMediaPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    tapStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const onMediaPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      if (tapTimerRef.current !== null) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      burstLike();
      return;
    }
    lastTapRef.current = now;
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null;
      onOpenViewer(safeIndex);
    }, 320);
  };

  const onPanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
    panelStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPanelPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panelStart.current;
    panelStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (pane === 'comments' && dx < 0) setPane('share');
      if (pane === 'share' && dx > 0) setPane('comments');
      return;
    }
    const body = (event.target as HTMLElement).closest('.lkdv-post-panel-body') as HTMLElement | null;
    if (dy > 70 && dy > Math.abs(dx) && (!body || body.scrollTop <= 0)) setPane('post');
  };

  const startGrab = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    didDragRef.current = false;
    setGrabbing(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* optionnel */
    }
  };
  const moveGrab = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const distance = Math.max(0, event.clientY - dragStartY.current);
    if (distance > 4) didDragRef.current = true;
    setDragY(distance);
  };
  const endGrab = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const distance = Math.max(0, event.clientY - dragStartY.current);
    dragStartY.current = null;
    setGrabbing(false);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* optionnel */
    }
    if (distance > 70) {
      setDragY(520);
      window.setTimeout(onClose, 300);
    } else {
      setDragY(0);
    }
  };

  const meta = useMemo(() => {
    if (!moment) return null;
    const parts = [
      moment.dayNumber > 0 ? `Jour ${moment.dayNumber}` : null,
      moment.time,
      moment.place,
      createdAt
        ? new Date(createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [createdAt, moment]);

  return (
    <OverlaySheet
      title={author?.name ?? 'Moment du carnet'}
      onClose={onClose}
      className="lkdv-post-drawer lkdv-post-glass-sheet ckp-post-sheet"
      heading={<PostAuthorPill post={feedPost} />}
      dragY={dragY}
      dragActive={grabbing}
      headerRight={
        <button
          type="button"
          className={`lkdv-post-options-trigger${optionsOpen ? ' is-open' : ''}`}
          aria-label={optionsOpen ? 'Fermer le menu' : 'Options'}
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((value) => !value)}
        >
          {optionsOpen ? <X size={18} /> : <MoreHorizontalIcon />}
        </button>
      }
    >
      <button
        type="button"
        className="lkdv-post-grab"
        aria-label="Fermer la publication"
        onPointerDown={startGrab}
        onPointerMove={moveGrab}
        onPointerUp={endGrab}
        onPointerCancel={() => {
          dragStartY.current = null;
          setDragY(0);
        }}
        onClick={() => {
          if (!didDragRef.current) onClose();
          didDragRef.current = false;
        }}
      />

      {optionsOpen ? (
        <div className="lkdv-post-options-menu" role="menu" aria-label="Options du moment">
          <button
            type="button"
            role="menuitem"
            aria-label={saved ? 'Retirer des enregistrements' : 'Enregistrer'}
            title={saved ? 'Retirer des enregistrements' : 'Enregistrer'}
            onClick={() => {
              setOptionsOpen(false);
              onSave();
            }}
          >
            <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Copier le lien"
            title="Copier le lien"
            onClick={() => {
              setOptionsOpen(false);
              void navigator.clipboard?.writeText(shareUrl).then(onCopied).catch(() => {});
            }}
          >
            <Link2 size={17} />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Partager"
            title="Partager"
            onClick={() => {
              setOptionsOpen(false);
              setPane('share');
            }}
          >
            <Send size={17} />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Signaler"
            title="Signaler"
            onClick={() => {
              setOptionsOpen(false);
              onReport();
            }}
          >
            <Flag size={17} />
          </button>
        </div>
      ) : null}

      <div className="lkdv-post-swipe">
        <LensPager
          index={INDEX[pane]}
          count={3}
          onIndexChange={(next) => setPane(ORDER[next] ?? 'post')}
          label="Panneaux du moment"
        >
          <div className="lkdv-lens-pane lkdv-post-pane">
            {pane === 'share' ? (
              <div
                className="lkdv-community-panel-slot"
                data-side="share"
                onPointerDown={onPanelPointerDown}
                onPointerUp={onPanelPointerUp}
                onPointerCancel={() => {
                  panelStart.current = null;
                }}
              >
                <button
                  type="button"
                  className="lkdv-post-panel-close"
                  onClick={() => setPane('post')}
                  aria-label="Retour à la photo"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Partager le moment">
                  <div className="lkdv-panel-grab" aria-hidden="true">
                    <span />
                  </div>
                  <div className="lkdv-post-panel-body">
                    <CarnetSharePane url={shareUrl} title={detail.title} onCopied={onCopied} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lkdv-lens-pane lkdv-post-pane">
            <div className="lkdv-post-main">
              {moment?.imageUrl ? (
                <div className="lkdv-post-media-wrap">
                  <div
                    className="lkdv-post-media"
                    role="button"
                    tabIndex={0}
                    aria-label="Agrandir la photo"
                    onPointerDown={onMediaPointerDown}
                    onPointerUp={onMediaPointerUp}
                    onDoubleClick={burstLike}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenViewer(safeIndex);
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
                    <img src={moment.imageUrl} alt={moment.caption ?? ''} draggable={false} />
                    {burst > 0 ? (
                      <span key={burst} className="lkdv-post-heart-burst" aria-hidden="true">
                        <Heart size={82} fill="currentColor" />
                      </span>
                    ) : null}
                  </div>

                  {items.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="lkdv-post-media-nav is-left"
                        aria-label="Moment précédent"
                        onClick={() => go(-1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="lkdv-post-media-nav is-right"
                        aria-label="Moment suivant"
                        onClick={() => go(1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                      <span className="lkdv-post-media-count">
                        {safeIndex + 1}/{items.length}
                      </span>
                    </>
                  ) : null}

                  <div className="lkdv-post-media-glass">
                    <button
                      type="button"
                      className={detail.engagement.liked ? 'on' : ''}
                      onClick={like}
                      aria-label={`Aimer (${detail.engagement.likes})`}
                      aria-pressed={detail.engagement.liked}
                    >
                      <Heart key={likePulse} className={likePulse > 0 ? 'is-pop' : ''} size={16} fill={detail.engagement.liked ? 'currentColor' : 'none'} />
                      <span className="lkdv-post-action-count">{formatCount(detail.engagement.likes)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setPane('comments');
                      }}
                      aria-label={`Commenter (${detail.engagement.comments})`}
                    >
                      <MessageCircle size={16} />
                      <span className="lkdv-post-action-count">{formatCount(detail.engagement.comments)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic(6);
                        setPane('share');
                      }}
                      aria-label="Partager"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {meta ? <p className="lkdv-post-likes">{meta}</p> : null}
            {moment?.caption ? <p className="lkdv-post-caption">{moment.caption}</p> : null}
          </div>

          <div className="lkdv-lens-pane lkdv-post-pane">
            {pane === 'comments' ? (
              <div
                className="lkdv-community-panel-slot"
                data-side="comments"
                onPointerDown={onPanelPointerDown}
                onPointerUp={onPanelPointerUp}
                onPointerCancel={() => {
                  panelStart.current = null;
                }}
              >
                <button
                  type="button"
                  className="lkdv-post-panel-close"
                  onClick={() => setPane('post')}
                  aria-label="Retour à la photo"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Commentaires du moment">
                  <div className="lkdv-panel-grab" aria-hidden="true">
                    <span />
                  </div>
                  <div className="lkdv-post-panel-body">
                    <CarnetCommentsPane
                      comments={comments.comments}
                      loading={comments.loading}
                      canWrite={canWrite}
                      currentUserId={currentUserId}
                      onSend={comments.send}
                      onRemove={comments.remove}
                      onRequireAuth={onRequireAuth}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </LensPager>
      </div>
    </OverlaySheet>
  );
}

/** Les trois points de l'en-tête, dessinés comme dans le post du Compte. */
function MoreHorizontalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default CarnetPostSheet;
