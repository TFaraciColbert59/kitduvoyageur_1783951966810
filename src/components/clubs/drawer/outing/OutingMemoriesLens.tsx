'use client';

import React, { useMemo } from 'react';
import { Camera, Heart, MapPin, MessageCircle, Play, Sparkles } from 'lucide-react';
import type { ClubOutingData, ClubPostData } from '../ClubDrawerTypes';
import { cleanOutingTitle } from './outingUtils';

export interface OutingStoryItem {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  mediaUrl: string;
  caption?: string | null;
  spot?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string | null;
}

export interface OutingMemoriesLensProps {
  outing: ClubOutingData;
  stories: OutingStoryItem[];
  posts: ClubPostData[];
  onFlyToCoords?: (lat: number, lng: number, label?: string) => void;
  onOpenStory?: (story: OutingStoryItem) => void;
  onCreatePost?: () => void;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function OutingMemoriesLens({
  outing,
  stories,
  posts,
  onFlyToCoords,
  onOpenStory,
  onCreatePost,
}: OutingMemoriesLensProps) {
  const outingPosts = useMemo(() => {
    const cleanTitle = norm(cleanOutingTitle(outing.title));
    const massifNorm = norm(outing.massif);
    return posts.filter((p) => {
      if (p.outingId && p.outingId === outing.id) return true;
      const pText = norm(`${p.spot ?? ''} ${p.caption ?? ''} ${p.massif ?? ''}`);
      if (cleanTitle.length >= 6 && pText.includes(cleanTitle.slice(0, 14))) return true;
      if (massifNorm.length >= 4 && p.massif && norm(p.massif).includes(massifNorm)) return true;
      return false;
    });
  }, [outing.id, outing.massif, outing.title, posts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      {/* 1. STORIES FILMÉES PENDANT LA SORTIE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#17402c" />
            Stories de la sortie ({stories.length})
          </span>
        </div>

        {stories.length === 0 ? (
          <div
            style={{
              padding: '14px 12px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.72)',
              border: '0.5px dashed rgba(23, 64, 44, 0.2)',
              fontSize: 12,
              color: '#56665d',
              textAlign: 'center',
            }}
          >
            Aucune story enregistrée sur cette sortie pour le moment.
          </div>
        ) : (
          <div
            data-hscroll="true"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 2,
            }}
          >
            {stories.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (onOpenStory) onOpenStory(st);
                  else if (onFlyToCoords && st.lat && st.lng) {
                    onFlyToCoords(st.lat, st.lng, st.spot || st.authorName);
                  }
                }}
                style={{
                  flex: 'none',
                  width: 112,
                  height: 158,
                  borderRadius: 18,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid rgba(255, 255, 255, 0.85)',
                  padding: 0,
                  background: '#172b24',
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(23, 43, 36, 0.14)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={st.mediaUrl}
                  alt={st.caption || st.spot || 'Story'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, transparent 45%, rgba(12,24,18,0.84) 100%)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Play size={10} fill="#fff" />
                </span>
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 8,
                    textAlign: 'left',
                    color: '#fff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {st.authorName.split(' ')[0]}
                  </div>
                  {st.spot ? (
                    <div style={{ fontSize: 9.5, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.spot}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. POSTS & RÉCITS LIÉS À LA SORTIE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={14} color="#17402c" />
            Posts & récits ({outingPosts.length})
          </span>
          {onCreatePost ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 28, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}
              onClick={onCreatePost}
            >
              + Partager
            </button>
          ) : null}
        </div>

        {outingPosts.length === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.72)',
              border: '0.5px dashed rgba(23, 64, 44, 0.2)',
              fontSize: 12,
              color: '#56665d',
              textAlign: 'center',
            }}
          >
            Aucun post encore rattaché à cette sortie. Partage tes photos ou ton retour terrain !
          </div>
        ) : (
          outingPosts.map((post) => {
            const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
            return (
              <div
                key={post.id}
                className="club-glass-card"
                style={{
                  borderRadius: 18,
                  overflow: 'hidden',
                }}
              >
                {post.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.mediaUrl}
                    alt={post.spot || post.authorName}
                    style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                ) : null}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {post.authorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#17402c',
                            color: '#fff',
                            fontSize: 10.5,
                            fontWeight: 700,
                            display: 'inline-grid',
                            placeItems: 'center',
                            flex: 'none',
                          }}
                        >
                          {post.authorName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.authorName}
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, color: '#56665d', flex: 'none' }}>{post.timeAgo}</span>
                  </div>

                  {post.spot ? (
                    <strong style={{ fontSize: 13, color: '#172b24', lineHeight: 1.25 }}>{post.spot}</strong>
                  ) : null}

                  {post.caption ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: '#24362e', lineHeight: 1.45 }}>
                      {post.caption}
                    </p>
                  ) : null}

                  {post.metricsChip ? (
                    <span
                      className="club-badge-sage"
                      style={{ alignSelf: 'flex-start', fontSize: 10.5 }}
                    >
                      {post.metricsChip}
                    </span>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2, fontSize: 11, color: '#56665d' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Heart size={12} /> {post.likes}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MessageCircle size={12} /> {commentsCount}
                    </span>
                    {post.massif ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                        <MapPin size={11} /> {post.massif}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
