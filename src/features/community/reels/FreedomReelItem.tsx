'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, MapPin, Music2, Heart } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDoubleTap } from '@/hooks/gestures';
import { FreedomActionsPill } from './FreedomActionsPill';
import type { FreedomReelItem as ReelModel } from './freedom-types';

export interface FreedomReelItemProps {
  reel: ReelModel;
  isActive: boolean;
  isPreload: boolean;
  globalMuted: boolean;
  onToggleMute?: () => void;
  onOpenComments: (reel: ReelModel) => void;
  onOpenShare: (reel: ReelModel) => void;
  onOpenKit?: (kitId: string) => void;
  onLikeChange?: (reelId: string, liked: boolean, count: number) => void;
}

export const FreedomReelItem: React.FC<FreedomReelItemProps> = ({
  reel,
  isActive,
  isPreload,
  globalMuted,
  onToggleMute: _onToggleMute,
  onOpenComments,
  onOpenShare,
  onOpenKit,
  onLikeChange,
}) => {
  const { haptic } = useHapticFeedback();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | null>(null);
  const [progress, setProgress] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [liked, setLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [following, setFollowing] = useState(Boolean(reel.author.isFollowing));
  const [heartBursts, setHeartBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const heartIdRef = useRef(0);

  // Synchronize active play/pause with high reliability and WebKit autoplay recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = globalMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // WebKit policy may require muted autoplay before first tactile interaction
            if (!video.muted) {
              video.muted = true;
              video
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
            } else {
              setIsPlaying(false);
            }
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      setProgress(0);
    }
  }, [isActive, globalMuted]);

  // Clean up media decoder when item is unmounted to free GPU resources
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, []);

  // Track progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    setProgress(pct);
  };

  // Toggle Play / Pause on single tap
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    haptic('light');
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setShowCenterIcon('play');
        setTimeout(() => setShowCenterIcon(null), 550);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setShowCenterIcon('pause');
      setTimeout(() => setShowCenterIcon(null), 550);
    }
  }, [haptic]);

  // Handle Like action
  const handleLike = useCallback(() => {
    const nextLiked = !liked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikeChange?.(reel.id, nextLiked, nextCount);
  }, [liked, likesCount, onLikeChange, reel.id]);

  // Double tap gesture with floating heart burst at tap coordinates
  const doubleTap = useDoubleTap(
    () => {
      haptic('medium');
      if (!liked) {
        handleLike();
      }
      const newBurst = {
        id: ++heartIdRef.current,
        x: window.innerWidth / 2 + (Math.random() * 60 - 30),
        y: window.innerHeight / 2 + (Math.random() * 60 - 30),
      };
      setHeartBursts((prev) => [...prev, newBurst]);
      setTimeout(() => {
        setHeartBursts((prev) => prev.filter((b) => b.id !== newBurst.id));
      }, 800);
    },
    {
      onSingleTap: handleTogglePlay,
    },
  );

  return (
    <div
      className="freedom-reel-slide"
      id={`freedom-reel-${reel.id}`}
      onClick={doubleTap.onClick}
      role="region"
      aria-label={`Reel Freedom de ${reel.author.name}`}
    >
      {/* 1. Fullscreen Video Element */}
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl || undefined}
        className="freedom-video-element"
        playsInline
        loop
        muted={globalMuted}
        preload={isActive ? 'auto' : isPreload ? 'metadata' : 'none'}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* 2. Top & Bottom gradient vignettes for perfect readability */}
      <div className="freedom-vignette-overlay" aria-hidden="true" />

      {/* 3. Center Pause / Play indicator */}
      {showCenterIcon && (
        <div className="freedom-center-state" aria-hidden="true">
          {showCenterIcon === 'play' ? <Play size={32} fill="white" /> : <Pause size={32} fill="white" />}
        </div>
      )}

      {/* 4. Double-tap floating Heart Bursts */}
      {heartBursts.map((burst) => (
        <span
          key={burst.id}
          className="freedom-heart-burst"
          style={{ left: burst.x, top: burst.y }}
          aria-hidden="true"
        >
          <Heart size={88} fill="#FF5A7A" strokeWidth={0} />
        </span>
      ))}

      {/* 5. Left-Bottom Overlay: Author info, Location, Caption, Music track */}
      <div className="freedom-bottom-meta" onClick={(e) => e.stopPropagation()}>
        {/* Author row */}
        <div className="freedom-author-row">
          <span className="freedom-author-name">@{reel.author.handle}</span>
          {reel.location && (
            <span className="freedom-location-chip">
              <MapPin size={11} />
              <span>{reel.location}</span>
            </span>
          )}
        </div>

        {/* Caption */}
        <p
          className={`freedom-caption-text${captionExpanded ? ' is-expanded' : ''}`}
          onClick={() => setCaptionExpanded(!captionExpanded)}
        >
          {reel.caption}
        </p>

        {/* Linked Kit Badge if present */}
        {reel.linkedKit && onOpenKit && (
          <div className="pt-0.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md transition active:scale-95"
              onClick={() => onOpenKit(reel.linkedKit?.id || '')}
            >
              <span>🎒 Kit : <b>{reel.linkedKit.name}</b></span>
              <span className="text-[10px] text-white/70">· Voir la liste →</span>
            </button>
          </div>
        )}

        {/* Audio Track */}
        <div className="freedom-audio-track">
          <Music2 size={13} className="animate-pulse" />
          <span className="truncate">{reel.soundTitle}</span>
        </div>
      </div>

      {/* 6. Vertical Liquid Glass Pill on Right Edge (Style TikTok) */}
      <FreedomActionsPill
        reel={reel}
        liked={liked}
        likesCount={likesCount}
        commentsCount={reel.commentsCount}
        sharesCount={reel.sharesCount}
        following={following}
        isPlaying={isPlaying}
        onLike={handleLike}
        onComment={() => onOpenComments(reel)}
        onShare={() => onOpenShare(reel)}
        onFollow={() => {
          setFollowing(true);
          haptic('medium');
        }}
        onOpenKit={
          reel.linkedKit || reel.linkedKitId
            ? () => onOpenKit?.(reel.linkedKit?.id || reel.linkedKitId || '')
            : undefined
        }
      />

      {/* 7. Subtle Video Progress Bar at the very bottom */}
      <div className="freedom-progress-bar" aria-hidden="true">
        <div className="freedom-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default FreedomReelItem;
