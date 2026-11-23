'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, Eye, Layers, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { CommentItem, type SocialComment } from '@/components/social-kit';
import { useAuth } from '@/contexts/AuthContext';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { PostSource } from '@/features/community/feed/postSource';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
import type { ClubPoleItem } from '../drawer/ClubDrawerTypes';

export interface ClubStoryViewerEntry {
  id: string;
  name: string;
  handle: string;
  role?: string;
  avatarUrl?: string;
  viewedAt: string;
}

export interface ClubStoryHighlight {
  id: string;
  title: string;
  coverUrl: string;
  subtitle?: string;
  createdAtLabel?: string;
  slides: Array<{
    id: string;
    image: string;
    caption?: string;
  }>;
  viewsCount: number;
  viewers: ClubStoryViewerEntry[];
}

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
  poleId?: string;
  poleName?: string;
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
  poles?: ClubPoleItem[];
  highlights?: ClubStoryHighlight[];
  canManageStories?: boolean;
  onOpenHighlight?: (highlightId: string) => void;
  onEditHighlight?: (highlightId: string) => void;
  onAddHighlight?: () => void;
  membersCount?: number;
  activePoleId?: string;
  onActivePoleChange?: (poleId: string) => void;
  onAddPole?: (pole: { name: string; specialty: string }) => void;
  onEnableRecommendedPoles?: () => void;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onToggleRsvp: (postId: string, outingId?: string) => void;
  onFlyToSpot: (post: ClubFeedPostItem) => void;
  onOpenOutingDetail: (outingId: string) => void;
  onOpenCreatePost: (poleId?: string) => void;
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

function ClubCommentsPanel({
  post,
  clubName,
  onAddComment,
}: {
  post: ClubFeedPostItem;
  clubName: string;
  onAddComment: (postId: string, text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const comments: SocialComment[] = post.comments.map((c) => ({
    id: c.id,
    authorName: c.authorName,
    authorHandle: c.authorHandle,
    authorAvatarUrl: c.authorAvatar ?? null,
    authorBadge: c.roleBadge ?? null,
    content: c.text,
    timeLabel: c.createdAt,
    likes: 0,
    liked: false,
    isOwner: false,
  }));
  const send = () => {
    const clean = draft.trim();
    if (!clean) return;
    onAddComment(post.id, clean);
    setDraft('');
  };
  return (
    <>
      <div className="lkdv-post-panel-body">
        {comments.length === 0 ? (
          <div className="lkdv-comments-empty">
            <b>Sois le premier de la cordée à répondre.</b>
            <p>Pose une question sur l’itinéraire, la météo ou le matériel.</p>
          </div>
        ) : (
          <div className="lkdv-comments-list">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} canInteract={false} />
            ))}
          </div>
        )}
      </div>
      <div className="lkdv-post-panel-foot">
        <PostReplyComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          placeholder={`Répondre dans ${clubName}…`}
          inputLabel="Ajouter un commentaire"
          ariaLabel="Envoyer le commentaire"
        />
      </div>
    </>
  );
}

function ClubSharePanel({
  clubName,
  copied,
  onCopy,
}: {
  post: ClubFeedPostItem;
  clubName: string;
  copied: boolean;
  onCopy: () => void;
  onFlyToSpot?: (post: ClubFeedPostItem) => void;
  onClose: () => void;
}) {
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  return (
    <>
      <div className="lkdv-share-actions">
        <button type="button" className="lkdv-share-btn" onClick={onCopy}>
          <span>{copied ? 'Lien copié ✓' : 'Copier le lien'}</span>
        </button>
      </div>

      <div className="club-share-cordee-list">
        {[
          { id: 'canal', name: `Canal ${clubName}`, sub: 'Tout le club · Direct' },
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
    </>
  );
}

/** Post de club : le bloc `CommunityFeedPost` du fil, alimenté par les données du club (`PostSource`). */
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
  const { user } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const hasMedia = post.kind !== 'text' && Boolean(post.mediaUrl);

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/clubs/${encodeURIComponent(post.clubId)}?post=${encodeURIComponent(post.id)}`;
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  };

  const feedPost = useMemo<FeedPost>(
    () => ({
      id: post.id,
      content: post.caption,
      image_url: hasMedia ? (post.mediaUrl ?? null) : null,
      image_alt: post.caption,
      likes_count: post.likes,
      comments_count: post.comments.length,
      author: {
        id: post.authorHandle,
        full_name: post.authorName,
        avatar_url: post.authorAvatar ?? null,
        handle: post.authorHandle,
      },
    }),
    [hasMedia, post.authorAvatar, post.authorHandle, post.authorName, post.caption, post.comments.length, post.id, post.likes, post.mediaUrl],
  );

  const metaParts = [post.poleName, post.spot, post.timeAgo].filter(Boolean).join(' · ');

  const source: PostSource = {
    liked: Boolean(post.liked),
    saved: Boolean(post.saved),
    likes: post.likes,
    comments: post.comments.length,
    onToggleLike: () => onToggleLike(post.id),
    onToggleSave: () => onToggleSave(post.id),
    onCopyLink: copyLink,
    onRepost: () => {
      void copyLink();
    },
    onReport: () => {
      if (!reported) setReported(true);
    },
    author: {
      onClick: () => {
        const handle = (post.authorHandle || '').replace(/^@/, '').trim();
        if (!handle) return;
        const href = `/u/${encodeURIComponent(handle)}`;
        try {
          router.push(href);
        } catch {
          window.location.assign(href);
        }
      },
      meta: metaParts,
      badge: post.authorRole,
      pinned: post.pinned,
    },
    overlay: (
      <div className="club-post-bottom-left">
        {post.poleName ? (
          <span className="club-post-chip-btn" style={{ pointerEvents: 'none' }}>
            <span>{post.poleName}</span>
          </span>
        ) : null}
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
        {post.kind === 'outing' ? (
          <button
            type="button"
            className={`club-post-rsvp-pill ${post.rsvpJoined ? 'joined' : ''}`}
            onClick={() => onToggleRsvp(post.id, post.outingId)}
            aria-pressed={Boolean(post.rsvpJoined)}
          >
            {post.rsvpJoined ? 'Inscrit à la cordée ✓' : `Je viens (${post.outingSeatsLeft ?? 3} pl.)`}
          </button>
        ) : null}
      </div>
    ),
    renderComments: () => <ClubCommentsPanel post={post} clubName={clubName} onAddComment={onAddComment} />,
    renderShare: ({ onClose }) => (
      <ClubSharePanel
        post={post}
        clubName={clubName}
        copied={copied}
        onCopy={() => void copyLink()}
        onFlyToSpot={onFlyToSpot}
        onClose={onClose}
      />
    ),
  };

  return (
    <div className="club-inline-post" id={`club-feed-post-${post.id}`}>
      <CommunityFeedPost
        embedded
        post={feedPost}
        user={user ? { id: user.id, is_anonymous: Boolean(user.is_anonymous) } : null}
        source={source}
      />
    </div>
  );
}

function matchesPole(post: ClubFeedPostItem, pole: ClubPoleItem): boolean {
  if (post.poleId && post.poleId === pole.id) return true;
  if (post.poleName && post.poleName.toLowerCase() === pole.name.toLowerCase()) return true;
  const hay = `${post.spot || ''} ${post.caption || ''} ${post.metricsChip || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const words = `${pole.name} ${pole.specialty}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && w !== 'pole');
  return words.some((w) => hay.includes(w));
}

export function ClubInlineFeed({
  clubName,
  posts,
  poles = [],
  highlights = [],
  canManageStories = false,
  onOpenHighlight,
  onEditHighlight,
  onAddHighlight,
  membersCount = 0,
  activePoleId,
  onActivePoleChange,
  onAddPole,
  onEnableRecommendedPoles,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onToggleRsvp,
  onFlyToSpot,
  onOpenOutingDetail,
  onOpenCreatePost,
}: ClubInlineFeedProps) {
  const [internalPoleId, setInternalPoleId] = useState<string>('all');
  const [polesMenuOpen, setPolesMenuOpen] = useState(false);
  const [showAddPoleForm, setShowAddPoleForm] = useState(false);
  const [newPoleName, setNewPoleName] = useState('');
  const [newPoleSpecialty, setNewPoleSpecialty] = useState('');
  const [cardHost, setCardHost] = useState<HTMLElement | null>(null);
  const polesDockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!polesMenuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (polesDockRef.current && !polesDockRef.current.contains(e.target as Node)) {
        setPolesMenuOpen(false);
        setShowAddPoleForm(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPolesMenuOpen(false);
        setShowAddPoleForm(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [polesMenuOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setCardHost(document.getElementById('card'));
  }, [posts.length, poles.length]);

  const selectedPoleId = activePoleId ?? internalPoleId;
  const setSelectedPoleId = (next: string) => {
    setInternalPoleId(next);
    onActivePoleChange?.(next);
  };

  const selectedPole = useMemo(
    () => (selectedPoleId === 'all' ? null : (poles.find((p) => p.id === selectedPoleId) ?? null)),
    [poles, selectedPoleId],
  );

  const [visiblePostCount, setVisiblePostCount] = useState(18);
  const filteredPosts = useMemo(() => {
    if (!selectedPole) return posts || [];
    return (posts || []).filter((post) => matchesPole(post, selectedPole));
  }, [posts, selectedPole]);

  useEffect(() => {
    setVisiblePostCount(18);
  }, [selectedPoleId, posts.length]);

  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, visiblePostCount),
    [filteredPosts, visiblePostCount],
  );
  const remainingPostCount = Math.max(0, filteredPosts.length - visiblePosts.length);

  const isLargeClubWithoutPoles = poles.length === 0 && membersCount >= 10;

  const polesBottomRightDock =
    poles.length > 0 || (isLargeClubWithoutPoles && onEnableRecommendedPoles) ? (
      <div
        ref={polesDockRef}
        className={cardHost ? 'club-poles-float' : 'club-poles-float club-poles-float--inline'}
        aria-label="Filtres de pôles du club"
      >
        {polesMenuOpen ? (
          <div
            className="club-poles-popover"
            role="tablist"
            aria-label="Filtrer le fil d'actualité par pôle"
          >
            {poles.length > 0 ? (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedPoleId === 'all'}
                  className={`club-poles-option${selectedPoleId === 'all' ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedPoleId('all');
                    setPolesMenuOpen(false);
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <b>Tous les pôles</b>
                    <small>Fil complet du club</small>
                  </div>
                  {selectedPoleId === 'all' ? <Check size={14} aria-hidden="true" /> : null}
                </button>

                {poles.map((pole) => {
                  const isCurrent = selectedPoleId === pole.id;
                  return (
                    <button
                      key={pole.id}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      className={`club-poles-option${isCurrent ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedPoleId(isCurrent ? 'all' : pole.id);
                        setPolesMenuOpen(false);
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <b>{pole.name}</b>
                        <small>{pole.specialty}</small>
                      </div>
                      {isCurrent ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  );
                })}

                {onAddPole ? (
                  showAddPoleForm ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newPoleName.trim()) return;
                        onAddPole({
                          name: newPoleName.trim(),
                          specialty: newPoleSpecialty.trim() || 'Spécialité terrain du club',
                        });
                        setNewPoleName('');
                        setNewPoleSpecialty('');
                        setShowAddPoleForm(false);
                        setPolesMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: 8,
                        borderRadius: 12,
                        background: 'rgba(23, 64, 44, 0.05)',
                      }}
                    >
                      <input
                        type="text"
                        value={newPoleName}
                        onChange={(e) => setNewPoleName(e.target.value)}
                        placeholder="Nom du pôle (ex : Pôle Alpinisme)"
                        aria-label="Nom du pôle"
                        className="club-glass-input"
                        required
                      />
                      <input
                        type="text"
                        value={newPoleSpecialty}
                        onChange={(e) => setNewPoleSpecialty(e.target.value)}
                        placeholder="Spécialité (ex : Courses d’arêtes)"
                        aria-label="Spécialité du pôle"
                        className="club-glass-input"
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="reseau-btn active"
                          style={{ flex: 1, height: 28, fontSize: 11 }}
                          onClick={() => setShowAddPoleForm(false)}
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="reseau-btn primary"
                          style={{ flex: 1, height: 28, fontSize: 11 }}
                        >
                          Créer
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="club-poles-add-btn"
                      onClick={() => setShowAddPoleForm(true)}
                    >
                      <Plus size={13} aria-hidden="true" />
                      <span>Ajouter un pôle</span>
                    </button>
                  )
                ) : null}
              </>
            ) : isLargeClubWithoutPoles && onEnableRecommendedPoles ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
                <div style={{ fontSize: 11.5, color: '#172b24', lineHeight: 1.35 }}>
                  <b style={{ display: 'block', marginBottom: 2 }}>Pôles recommandés</b>
                  <span style={{ color: '#56665d' }}>
                    Organisez les grands clubs par spécialité pour filtrer le fil d’actualité.
                  </span>
                </div>
                <button
                  type="button"
                  className="reseau-btn primary"
                  style={{ height: 30, fontSize: 11.5, width: '100%' }}
                  onClick={() => {
                    onEnableRecommendedPoles();
                    setPolesMenuOpen(false);
                  }}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  <span>Activer les pôles</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className={`club-poles-trigger${selectedPole ? ' is-filtered' : ''}`}
          aria-expanded={polesMenuOpen}
          aria-label={selectedPole ? `Filtre actif : ${selectedPole.name}` : 'Filtrer par pôle'}
          title={selectedPole ? `${selectedPole.name} · ${selectedPole.specialty}` : 'Filtrer le fil par pôle'}
          onClick={() => setPolesMenuOpen((v) => !v)}
        >
          <Layers size={14} aria-hidden="true" />
          <span>{selectedPole ? selectedPole.name.replace(/^Pôle\s+/i, '') : 'Pôles'}</span>
        </button>
      </div>
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {polesBottomRightDock && cardHost ? createPortal(polesBottomRightDock, cardHost) : polesBottomRightDock}
      {/* Stories à la une du club (dans le fil d'actu, style identique à Carnet) */}
      {highlights.length > 0 || canManageStories ? (
        <div
          className="lkdv-ig-hl-row"
          role="group"
          aria-label="Stories à la une du club"
          style={{ padding: '4px 4px 6px', justifyContent: 'flex-start', gap: 10 }}
        >
          {highlights.map((hl) => (
            <button
              key={hl.id}
              type="button"
              className="lkdv-ig-hl"
              onClick={() => onOpenHighlight?.(hl.id)}
              onContextMenu={(e) => {
                if (!canManageStories) return;
                e.preventDefault();
                onEditHighlight?.(hl.id);
              }}
              aria-label={`Story à la une ${hl.title}`}
              style={{ flex: '0 0 auto' }}
            >
              <div className="lkdv-ig-hl-ring">
                <div className="lkdv-ig-hl-thumb">
                  {hl.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hl.coverUrl} alt="" loading="lazy" decoding="async" />
                  ) : null}
                </div>
              </div>
              <span className="lkdv-ig-hl-label">{hl.title}</span>
            </button>
          ))}

          {canManageStories && onAddHighlight ? (
            <button
              type="button"
              className="lkdv-ig-hl"
              onClick={onAddHighlight}
              aria-label="Ajouter une story à la une"
              style={{ flex: '0 0 auto' }}
            >
              <div className="lkdv-ig-hl-ring">
                <div
                  className="lkdv-ig-hl-thumb"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#17402c',
                  }}
                >
                  <Plus size={18} aria-hidden="true" />
                </div>
              </div>
              <span className="lkdv-ig-hl-label">+ À la une</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Fil d'actualité */}

      {!filteredPosts || filteredPosts.length === 0 ? (
        <div
          className="lkdv-feed-empty"
          style={{
            padding: '28px 16px',
            borderRadius: 22,
            background: 'transparent',
            boxShadow: 'none',
            border: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          <b style={{ font: '600 14px var(--sf)', color: 'var(--label)' }}>
            {selectedPole
              ? `Le fil du ${selectedPole.name} est calme`
              : `Le fil de ${clubName} est calme`}
          </b>
          <p style={{ font: '400 12px/1.4 var(--sf)', color: 'var(--label2)', margin: '4px 0 10px' }}>
            {selectedPole
              ? `Spécialité : ${selectedPole.specialty}. Partage une sortie, une trace GPX ou une photo de reconnaissance dans ce pôle.`
              : 'Partage une sortie, une trace GPX, une photo de reconnaissance ou une proposition de covoiturage.'}
          </p>
          <button
            type="button"
            className="reseau-btn primary"
            style={{ height: 34, padding: '0 16px', borderRadius: 999 }}
            onClick={() => onOpenCreatePost(selectedPole?.id)}
          >
            {selectedPole ? `+ Publier dans ${selectedPole.name}` : '+ Publier dans le club'}
          </button>
        </div>
      ) : (
        <div className="lkdv-feed-list club-card-feed-list" role="feed" aria-label={`Fil d'actualité de ${clubName}`}>
          {visiblePosts.map((post) => (
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
          {remainingPostCount > 0 ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              onClick={() => setVisiblePostCount((c) => c + 20)}
            >
              Afficher 20 publications de plus ({remainingPostCount} restantes)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ClubInlineFeed;
