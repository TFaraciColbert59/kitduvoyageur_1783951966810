'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Heart } from 'lucide-react';
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
  onOpenKit?: (kitId: string, kitName?: string) => void;
  onLikeChange?: (reelId: string, liked: boolean, count: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
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
  onSwipeLeft,
  onSwipeRight,
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

  // Horizontal swipe detection coordinates
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

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
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setShowCenterIcon('play');
          setTimeout(() => setShowCenterIcon(null), 550);
        })
        .catch(() => {});
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

  // Horizontal Swipe Gestures
  // Swipe Left -> Exit to Communauté
  // Swipe Right -> Author's Profile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartXRef.current;
    const deltaY = endY - touchStartYRef.current;

    // Check if it's primarily a horizontal swipe (> 60px horizontal, with dominance over vertical movement)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < -60) {
        // Swipe Left: exit Freedom Reels
        haptic('light');
        onSwipeLeft?.();
      } else if (deltaX > 60) {
        // Swipe Right: go to author's profile
        haptic('light');
        onSwipeRight?.();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div
      className="freedom-reel-slide"
      id={`freedom-reel-${reel.id}`}
      onClick={doubleTap.onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
          {showCenterIcon === 'play' ? (
            <Play size={32} fill="white" />
          ) : (
            <Pause size={32} fill="white" />
          )}
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

      {/* 5. Left-Bottom Overlay: Author info, Caption, Minimal Kit Pill */}
      <div className="freedom-bottom-meta" onClick={(e) => e.stopPropagation()}>
        {/* Author row (Location removed from bottom: now displayed at top center) */}
        <div className="freedom-author-row">
          <span className="freedom-author-name">@{reel.author.handle}</span>
        </div>

        {/* Caption */}
        <p
          className={`freedom-caption-text${captionExpanded ? ' is-expanded' : ''}`}
          onClick={() => setCaptionExpanded(!captionExpanded)}
        >
          {reel.caption}
        </p>

        {/* Minimal Kit Pill: ONLY kit name, everything else removed */}
        {reel.linkedKit && onOpenKit && (
          <div className="pt-1">
            <button
              type="button"
              className="freedom-kit-minimal-pill"
              onClick={(e) => {
                e.stopPropagation();
                onOpenKit(reel.linkedKit?.id || reel.linkedKitId || '', reel.linkedKit?.name);
              }}
              aria-label={`Voir le kit ${reel.linkedKit.name}`}
            >
              {reel.linkedKit.name}
            </button>
          </div>
        )}
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
      />

      {/* 7. Subtle Video Progress Bar at the very bottom */}
      <div className="freedom-progress-bar" aria-hidden="true">
        <div className="freedom-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default FreedomReelItem;
