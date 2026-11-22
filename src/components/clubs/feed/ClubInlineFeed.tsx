'use client';

import React, { useMemo, useState } from 'react';
import { Eye, Layers, Pencil, Plus, Sparkles, X } from 'lucide-react';
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
  post,
  clubName,
  copied,
  onCopy,
  onFlyToSpot,
  onClose,
}: {
  post: ClubFeedPostItem;
  clubName: string;
  copied: boolean;
  onCopy: () => void;
  onFlyToSpot: (post: ClubFeedPostItem) => void;
  onClose: () => void;
}) {
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  return (
    <>
      <div className="lkdv-share-actions">
        <button type="button" className="lkdv-share-btn" onClick={onCopy}>
          <span>{copied ? 'Lien copié ✓' : 'Copier le lien'}</span>
        </button>
        <button
          type="button"
          className="lkdv-share-btn"
          onClick={() => {
            onFlyToSpot(post);
            onClose();
          }}
        >
          <span>Centrer la carte 3D</span>
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
  const [copied, setCopied] = useState(false);
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
    author: {
      onClick: () => onFlyToSpot(post),
      meta: metaParts,
      badge: post.authorRole,
      pinned: post.pinned,
    },
    menuExtras: [
      { id: 'fly', label: 'Voir en 3D', icon: <SfIcon name="map-pin" />, onSelect: () => onFlyToSpot(post) },
      ...(post.outingId
        ? [{ id: 'outing', label: 'Fiche sortie', icon: <SfIcon name="mountain" />, onSelect: () => onOpenOutingDetail(post.outingId!) }]
        : []),
    ],
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
  const [showAddPoleForm, setShowAddPoleForm] = useState(false);
  const [newPoleName, setNewPoleName] = useState('');
  const [newPoleSpecialty, setNewPoleSpecialty] = useState('');

  const selectedPoleId = activePoleId ?? internalPoleId;
  const setSelectedPoleId = (next: string) => {
    setInternalPoleId(next);
    onActivePoleChange?.(next);
  };

  const selectedPole = useMemo(
    () => (selectedPoleId === 'all' ? null : (poles.find((p) => p.id === selectedPoleId) ?? null)),
    [poles, selectedPoleId],
  );

  const filteredPosts = useMemo(() => {
    if (!selectedPole) return posts || [];
    return (posts || []).filter((post) => matchesPole(post, selectedPole));
  }, [posts, selectedPole]);

  const isLargeClubWithoutPoles = poles.length === 0 && membersCount >= 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Stories à la une du club (dans le fil d'actu, style identique à Carnet) */}
      {highlights.length > 0 || canManageStories ? (
        <div
          className="lkdv-ig-hl-row"
          role="group"
          aria-label="Stories à la une du club"
          style={{ padding: '4px 4px 6px', justifyContent: 'flex-start', gap: 10 }}
        >
          {highlights.map((hl) => (
            <div
              key={hl.id}
              style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <button
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
              {canManageStories && onEditHighlight ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditHighlight(hl.id);
                  }}
                  aria-label={`Modifier et voir les vues de ${hl.title}`}
                  title={`Gérer « ${hl.title} » · ${hl.viewsCount} vues`}
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: 2,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    border: '1.5px solid #ffffff',
                    background: '#17402c',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16, 32, 25, 0.25)',
                  }}
                >
                  <Eye size={9} aria-hidden="true" />
                  <span>{hl.viewsCount}</span>
                </button>
              ) : null}
            </div>
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

      {/* Barre de Pôles de spécialité du club (optionnelle, recommandée pour les gros clubs) */}
      {poles.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 4px 0' }}>
          <div
            role="tablist"
            aria-label="Filtrer le fil d'actualité par pôle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 2,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedPoleId === 'all'}
              onClick={() => setSelectedPoleId('all')}
              style={{
                flexShrink: 0,
                height: 28,
                padding: '0 11px',
                borderRadius: 999,
                border:
                  selectedPoleId === 'all'
                    ? '1px solid rgba(23, 64, 44, 0.25)'
                    : '1px solid rgba(23, 43, 36, 0.1)',
                background:
                  selectedPoleId === 'all'
                    ? '#17402c'
                    : 'rgba(255, 255, 255, 0.55)',
                color: selectedPoleId === 'all' ? '#ffffff' : '#172b24',
                font: '600 11.5px var(--sf)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Layers size={12} aria-hidden="true" />
              <span>Tous les pôles</span>
            </button>

            {poles.map((pole) => {
              const isCurrent = selectedPoleId === pole.id;
              return (
                <button
                  key={pole.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  title={`${pole.name} — ${pole.specialty}`}
                  onClick={() => setSelectedPoleId(isCurrent ? 'all' : pole.id)}
                  style={{
                    flexShrink: 0,
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 999,
                    border: isCurrent
                      ? '1px solid rgba(23, 64, 44, 0.25)'
                      : '1px solid rgba(23, 43, 36, 0.1)',
                    background: isCurrent
                      ? '#17402c'
                      : 'rgba(255, 255, 255, 0.55)',
                    color: isCurrent ? '#ffffff' : '#172b24',
                    font: '600 11.5px var(--sf)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>{pole.name}</span>
                </button>
              );
            })}

            {onAddPole ? (
              <button
                type="button"
                onClick={() => setShowAddPoleForm((v) => !v)}
                aria-label="Ajouter un pôle de spécialité"
                title="Ajouter un pôle de spécialité"
                style={{
                  flexShrink: 0,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: '1px dashed rgba(23, 64, 44, 0.28)',
                  background: 'rgba(255, 255, 255, 0.35)',
                  color: '#17402c',
                  font: '600 11px var(--sf)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={12} aria-hidden="true" />
                <span>Pôle</span>
              </button>
            ) : null}
          </div>

          {selectedPole ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 12,
                background: 'rgba(23, 64, 44, 0.06)',
                fontSize: 11.5,
                color: '#172b24',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <b style={{ color: '#17402c' }}>{selectedPole.name}</b>
                <span style={{ color: '#56665d' }}> · Spécialité : {selectedPole.specialty}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoleId('all')}
                aria-label="Réinitialiser le filtre de pôle"
                style={{
                  border: 0,
                  background: 'none',
                  color: '#56665d',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'inline-flex',
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {showAddPoleForm && onAddPole ? (
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
              }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.52)',
                border: '1px solid rgba(23, 43, 36, 0.1)',
              }}
            >
              <input
                type="text"
                value={newPoleName}
                onChange={(e) => setNewPoleName(e.target.value)}
                placeholder="Nom du pôle (ex : Pôle Alpinisme)"
                aria-label="Nom du pôle"
                style={{
                  flex: '1 1 130px',
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(23, 43, 36, 0.14)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  fontSize: 12,
                }}
                required
              />
              <input
                type="text"
                value={newPoleSpecialty}
                onChange={(e) => setNewPoleSpecialty(e.target.value)}
                placeholder="Spécialité (ex : Courses d’arêtes & glacier)"
                aria-label="Spécialité du pôle"
                style={{
                  flex: '1 1 150px',
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(23, 43, 36, 0.14)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  fontSize: 12,
                }}
              />
              <button
                type="submit"
                className="reseau-btn primary"
                style={{ height: 30, padding: '0 12px', fontSize: 11.5 }}
              >
                Créer le pôle
              </button>
            </form>
          ) : null}
        </div>
      ) : isLargeClubWithoutPoles && onEnableRecommendedPoles ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '7px 11px',
            margin: '2px 4px 0',
            borderRadius: 14,
            background: 'rgba(23, 64, 44, 0.06)',
            fontSize: 11.5,
            color: '#172b24',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#56665d' }}>
            <Sparkles size={13} color="#17402c" aria-hidden="true" />
            <span>Recommandé pour les grands clubs : filtrer le fil par Pôles de spécialité</span>
          </span>
          <button
            type="button"
            onClick={onEnableRecommendedPoles}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '4px 10px',
              background: '#17402c',
              color: '#fff',
              font: '600 11px var(--sf)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Activer les pôles
          </button>
        </div>
      ) : null}

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
          {filteredPosts.map((post) => (
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
      )}
    </div>
  );
}

export default ClubInlineFeed;
