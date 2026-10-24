'use client';

import React, { useRef, useState } from 'react';
import { PostGlassPanel } from '@/features/posts/ui/PostGlassPanel';

export interface ClubFeedComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  roleBadge?: string;
  text: string;
  createdAt: string;
}

export interface ClubFeedPostItem {
  id: string;
  clubId: string;
  kind: 'media' | 'outing' | 'gpx' | 'text';
  pinned?: boolean;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  authorRole?: string;
  spot: string;
  massif: string;
  timeAgo: string;
  caption: string;
  mediaUrl?: string;
  metricsChip?: string;
  outingId?: string;
  outingSeatsLeft?: number;
  rsvpJoined?: boolean;
  lat?: number;
  lng?: number;
  kitName?: string;
  likes: number;
  liked?: boolean;
  saved?: boolean;
  comments: ClubFeedComment[];
}

export interface ClubInlineFeedProps {
  clubId: string;
  clubName: string;
  posts: ClubFeedPostItem[];
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onToggleRsvp: (postId: string, outingId?: string) => void;
  onFlyToSpot: (post: ClubFeedPostItem) => void;
  onOpenOutingDetail: (outingId: string) => void;
  onOpenCreatePost: () => void;
}

function SfIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center select-none shrink-0"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        backgroundColor: 'currentColor',
        maskImage: `url(/icons/sf/${name}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: `url(/icons/sf/${name}.svg)`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

function ClubPostCard({
  post,
  clubName,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onToggleRsvp,
  onFlyToSpot,
  onOpenOutingDetail,
}: {
  post: ClubFeedPostItem;
  clubName: string;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onToggleRsvp: (postId: string, outingId?: string) => void;
  onFlyToSpot: (post: ClubFeedPostItem) => void;
  onOpenOutingDetail: (outingId: string) => void;
}) {
  const [panel, setPanel] = useState<'comments' | 'share' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const expandedRef = useRef(false);

  const hasMedia = post.kind !== 'text' && Boolean(post.mediaUrl);

  React.useLayoutEffect(() => {
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

  const handleMediaTap = () => {
    if (panel) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (!post.liked) onToggleLike(post.id);
      setShowHeartPop(true);
      window.setTimeout(() => setShowHeartPop(false), 700);
    }
    lastTapRef.current = now;
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = commentDraft.trim();
    if (!clean) return;
    onAddComment(post.id, clean);
    setCommentDraft('');
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/clubs/${encodeURIComponent(post.clubId)}?post=${encodeURIComponent(post.id)}`;
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <article
      ref={articleRef}
      id={`club-feed-post-${post.id}`}
      className={hasMedia ? 'lkdv-feed-post club-inline-post' : 'lkdv-feed-post lkdv-feed-post--text club-inline-post'}
      aria-label={`Publication de ${post.authorName} dans ${clubName}`}
      style={{
        touchAction: 'pan-y',
        ...(panel && !hasMedia ? { aspectRatio: '1 / 1', minHeight: 340 } : {}),
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button,a,input,form')) return;
        swipeStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (panel) {
          if (dy > 60) {
            setPanel(null);
            return;
          }
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            setPanel(panel === 'comments' ? 'share' : 'comments');
          }
          return;
        }
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        setMenuOpen(false);
        setPanel(dx < 0 ? 'comments' : 'share');
      }}
    >
      {showHeartPop ? (
        <span className="club-heart-pop" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="#e0245e" stroke="#fff" strokeWidth="1.5">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </span>
      ) : null}

      {hasMedia ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.mediaUrl}
          alt={post.caption}
          className="lkdv-feed-post-media"
          draggable={false}
          loading="eager"
          onClick={handleMediaTap}
        />
      ) : (
        <div className="club-text-post-body" onClick={handleMediaTap}>
          {post.metricsChip ? (
            <span className="club-post-kind-pill">{post.metricsChip}</span>
          ) : null}
          <p className="lkdv-feed-post-text">{post.caption}</p>
        </div>
      )}

      {/* Header toujours visible et non recouvert par PostGlassPanel (z-index 30) */}
      <div ref={headerRef} className="lkdv-feed-post-top">
        <button
          type="button"
          className="lkdv-post-author"
          onClick={() => onFlyToSpot(post)}
          aria-label={`${post.authorName} · Localiser ${post.spot} sur la carte 3D`}
        >
          <span className="lkdv-post-author-av pmi-author-initial">
            {post.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.authorAvatar} alt="" loading="eager" />
            ) : (
              post.authorName.charAt(0).toUpperCase()
            )}
          </span>
          <span className="lkdv-post-author-txt">
            <span className="lkdv-post-author-line">
              <b>{post.authorName}</b>
              {post.authorRole ? <span className="lkdv-post-author-badge">{post.authorRole}</span> : null}
              {post.pinned ? (
                <span className="lkdv-post-author-badge" title="Épinglé par le club" aria-label="Épinglé">
                  <SfIcon name="pin" size={11} />
                </span>
              ) : null}
            </span>
            <span className="lkdv-post-author-meta">
              {post.spot} · {post.timeAgo}
            </span>
          </span>
        </button>
      </div>

      {/* Bouton ··· / Fermer 34x34 en haut à droite */}
      <button
        type="button"
        className={`pmi-more-pill ${panel ? 'is-close' : ''}`}
        aria-label={panel ? 'Fermer le panneau' : 'Options de la publication'}
        aria-expanded={Boolean(panel || menuOpen)}
        onClick={() => {
          if (panel) {
            setPanel(null);
          } else {
            setMenuOpen((v) => !v);
          }
        }}
      >
        {panel ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        )}
      </button>

      {menuOpen ? (
        <div className="pmi-options-menu" role="group" aria-label="Options de la publication">
          <button
            type="button"
            onClick={() => {
              onFlyToSpot(post);
              setMenuOpen(false);
            }}
          >
            <SfIcon name="map-pin" />
            <span>Voir en 3D</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleSave(post.id);
              setMenuOpen(false);
            }}
          >
            <SfIcon name="bookmark" />
            <span>{post.saved ? 'Retirer' : 'Enregistrer'}</span>
          </button>
          {post.outingId ? (
            <button
              type="button"
              onClick={() => {
                onOpenOutingDetail(post.outingId!);
                setMenuOpen(false);
              }}
            >
              <SfIcon name="mountain" />
              <span>Fiche sortie</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleCopyLink();
              setMenuOpen(false);
            }}
          >
            <SfIcon name="link" />
            <span>{copied ? 'Lien copié' : 'Copier le lien'}</span>
          </button>
        </div>
      ) : null}

      {/* Bandeau bas-gauche : Légende courte + Chip Trace GPX / Sortie 1-Tap RSVP */}
      {!panel ? (
        <div className="club-post-bottom-left">
          {post.metricsChip ? (
            <button
              type="button"
              className="club-post-chip-btn"
              onClick={() => {
                if (post.outingId) onOpenOutingDetail(post.outingId);
                else onFlyToSpot(post);
              }}
            >
              <span>{post.metricsChip}</span>
            </button>
          ) : null}
          {hasMedia && post.caption ? (
            <div className="club-post-caption-glass">
              <span>{post.caption}</span>
            </div>
          ) : null}
          {post.kind === 'outing' ? (
            <button
              type="button"
              className={`club-post-rsvp-pill ${post.rsvpJoined ? 'joined' : ''}`}
              onClick={() => onToggleRsvp(post.id, post.outingId)}
              aria-pressed={Boolean(post.rsvpJoined)}
            >
              {post.rsvpJoined
                ? 'Inscrit à la cordée ✓'
                : `Je viens (${post.outingSeatsLeft ?? 3} pl.)`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Capsule d'actions verre 116x40 en bas à droite (3 boutons ronds 34x34) */}
      {!panel ? (
        <div className="pmi-post-actions" role="group" aria-label="Actions sur la publication">
          <button
            type="button"
            className={`pmi-post-btn ${post.liked ? 'liked' : ''}`}
            aria-label={`J'aime (${post.likes})`}
            aria-pressed={Boolean(post.liked)}
            onClick={() => onToggleLike(post.id)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={post.liked ? '#e0245e' : 'none'}
              stroke={post.liked ? '#e0245e' : 'currentColor'}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>
          <button
            type="button"
            className="pmi-post-btn"
            aria-label={`Commentaires (${post.comments.length})`}
            aria-expanded={false}
            onClick={() => setPanel('comments')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </button>
          <button
            type="button"
            className="pmi-post-btn"
            aria-label="Partager à la cordée"
            aria-expanded={false}
            onClick={() => setPanel('share')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Panneau verre en place PostGlassPanel (Commentaires ↔ Partage, top: 60px) */}
      {panel ? (
        <PostGlassPanel
          side={panel}
          headerRef={headerRef}
          onClose={() => setPanel(null)}
          onSwitch={setPanel}
        >
          {panel === 'comments' ? (
            <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Commentaires de la publication">
              <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>
              <div className="lkdv-post-panel-body">
                {post.comments.length === 0 ? (
                  <div className="lkdv-comments-empty">
                    <b>Sois le premier de la cordée à répondre.</b>
                    <p>Pose une question sur l’itinéraire, la météo ou le matériel.</p>
                  </div>
                ) : (
                  <div className="lkdv-comments-list">
                    {post.comments.map((c) => (
                      <div key={c.id} className="lkdv-comment lkdv-comment-row">
                        <span className="lkdv-comment-av" aria-hidden="true">
                          {c.authorAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.authorAvatar} alt="" loading="lazy" />
                          ) : (
                            c.authorName.charAt(0).toUpperCase()
                          )}
                        </span>
                        <div className="lkdv-comment-body">
                          <div className="lkdv-comment-head lkdv-comment-meta">
                            <b className="lkdv-comment-name">{c.authorName}</b>
                            {c.roleBadge ? (
                              <span className="club-comment-badge">{c.roleBadge}</span>
                            ) : null}
                            <span className="lkdv-comment-time">{c.createdAt}</span>
                          </div>
                          <p className="lkdv-comment-text">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lkdv-post-panel-foot">
                <form className="lkdv-comments-composer lkdv-comments-form" onSubmit={handleSubmitComment}>
                  <input
                    type="text"
                    className="lkdv-comments-input"
                    placeholder={`Répondre dans ${clubName}…`}
                    aria-label="Ajouter un commentaire"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="lkdv-comments-send"
                    aria-label="Envoyer le commentaire"
                    disabled={!commentDraft.trim()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Partager la publication">
              <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>
              <div className="lkdv-post-panel-body">
                <div className="lkdv-share-actions">
                  <button
                    type="button"
                    className="lkdv-share-btn"
                    onClick={() => void handleCopyLink()}
                  >
                    <span>{copied ? 'Lien copié ✓' : 'Copier le lien'}</span>
                  </button>
                  <button
                    type="button"
                    className="lkdv-share-btn"
                    onClick={() => {
                      onFlyToSpot(post);
                      setPanel(null);
                    }}
                  >
                    <span>Centrer la carte 3D</span>
                  </button>
                </div>

                <div className="club-share-cordee-list">
                  {[
                    { id: 'canal', name: `Canal ${clubName}`, sub: 'Toute la tribu · Direct' },
                    { id: 'lea', name: 'Léa Fontaine', sub: '@lea.fontaine · Guide référente' },
                    { id: 'marc', name: 'Marc Vercors', sub: '@marc_alpi · Covoiturage' },
                  ].map((dest) => {
                    const isSent = sharedTo === dest.id;
                    return (
                      <div key={dest.id} className="club-share-row">
                        <div className="club-share-meta">
                          <b>{dest.name}</b>
                          <small>{dest.sub}</small>
                        </div>
                        <button
                          type="button"
                          className={`reseau-btn ${isSent ? 'active' : 'primary'}`}
                          onClick={() => setSharedTo(dest.id)}
                        >
                          {isSent ? 'Envoyé ✓' : 'Envoyer'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </PostGlassPanel>
      ) : null}
    </article>
  );
}

export function ClubInlineFeed({
  clubId,
  clubName,
  posts,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onToggleRsvp,
  onFlyToSpot,
  onOpenOutingDetail,
  onOpenCreatePost,
}: ClubInlineFeedProps) {
  if (!posts || posts.length === 0) {
    return (
      <div className="lkdv-feed-empty" style={{ padding: '28px 16px', borderRadius: 22 }}>
        <b style={{ font: '600 14px var(--sf)', color: 'var(--label)' }}>
          Le fil de {clubName} est calme
        </b>
        <p style={{ font: '400 12px/1.4 var(--sf)', color: 'var(--label2)', margin: '4px 0 10px' }}>
          Partage une sortie, une trace GPX, une photo de reconnaissance ou une proposition de covoiturage.
        </p>
        <button
          type="button"
          className="reseau-btn primary"
          style={{ height: 34, padding: '0 16px', borderRadius: 999 }}
          onClick={onOpenCreatePost}
        >
          + Publier dans le club
        </button>
      </div>
    );
  }

  return (
    <div className="lkdv-feed-list club-card-feed-list" role="feed" aria-label={`Fil d'actualité de ${clubName}`}>
      {posts.map((post) => (
        <ClubPostCard
          key={post.id}
          post={post}
          clubName={clubName}
          onToggleLike={onToggleLike}
          onToggleSave={onToggleSave}
          onAddComment={onAddComment}
          onToggleRsvp={onToggleRsvp}
          onFlyToSpot={onFlyToSpot}
          onOpenOutingDetail={onOpenOutingDetail}
        />
      ))}
    </div>
  );
}

export default ClubInlineFeed;
