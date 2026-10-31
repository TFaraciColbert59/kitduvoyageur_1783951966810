'use client';

import React, { useMemo, useState } from 'react';
import { CommentItem, type SocialComment } from '@/components/social-kit';
import { useAuth } from '@/contexts/AuthContext';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { PostSource } from '@/features/community/feed/postSource';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';

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
      meta: `${post.spot} · ${post.timeAgo}`,
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
