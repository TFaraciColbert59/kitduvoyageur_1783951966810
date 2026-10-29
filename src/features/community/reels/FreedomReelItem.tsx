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
  onOpenSound?: (soundTitle: string) => void;
  onLikeChange?: (reelId: string, liked: boolean, count: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onAuthorClick?: () => void;
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
  onOpenSound,
  onLikeChange,
  onSwipeLeft,
  onSwipeRight,
  onAuthorClick,
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

  // Synchronize active play/pause with WebKit autoplay recovery
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

  // Clean up media decoder when unmounted
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

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    setProgress(pct);
  };

  // Toggle Play / Pause on single tap: soft, épuré, icon max 15px sans background
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
          setTimeout(() => setShowCenterIcon(null), 400);
        })
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setShowCenterIcon('pause');
      setTimeout(() => setShowCenterIcon(null), 400);
    }
  }, [haptic]);

  const handleLike = useCallback(() => {
    const nextLiked = !liked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikeChange?.(reel.id, nextLiked, nextCount);
  }, [liked, likesCount, onLikeChange, reel.id]);

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

      {/* 2. Top & Bottom subtle vignettes */}
      <div className="freedom-vignette-overlay" aria-hidden="true" />

      {/* 3. Center Pause / Play indicator: ÉPURÉ, SANS BACKGROUND, 15PX MAX */}
      {showCenterIcon && (
        <div className="freedom-center-state" aria-hidden="true">
          {showCenterIcon === 'play' ? (
            <Play size={15} fill="white" strokeWidth={0} />
          ) : (
            <Pause size={15} fill="white" strokeWidth={0} />
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
        {/* Author row (Clic redirige vers le profil) */}
        <div className="freedom-author-row">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic('light');
              onAuthorClick?.();
            }}
            className="freedom-author-name text-left hover:underline focus:outline-none"
          >
            @{reel.author.handle}
          </button>
        </div>

        {/* Caption */}
        <p
          className={`freedom-caption-text${captionExpanded ? ' is-expanded' : ''}`}
          onClick={() => setCaptionExpanded(!captionExpanded)}
        >
          {reel.caption}
        </p>

        {/* Minimal Kit Pill: ONLY kit name */}
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

      {/* 6. Vertical Translucent Liquid Glass Pill on Right Edge */}
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
          setFollowing(!following);
          haptic('medium');
        }}
        onAuthorClick={onAuthorClick}
        onOpenSound={() => onOpenSound?.(reel.soundTitle)}
      />

      {/* 7. Subtle Video Progress Bar at the very bottom */}
      <div className="freedom-progress-bar" aria-hidden="true">
        <div className="freedom-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default FreedomReelItem;
