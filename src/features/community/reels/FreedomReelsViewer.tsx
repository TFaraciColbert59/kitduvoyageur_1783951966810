'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { FreedomReelItem } from './FreedomReelItem';
import { FreedomCommentsDrawer } from './FreedomCommentsDrawer';
import { FreedomShareDrawer } from './FreedomShareDrawer';
import { FreedomKitDrawer } from './FreedomKitDrawer';
import { FreedomSoundDrawer } from './FreedomSoundDrawer';
import { fetchFreedomReels } from './freedomReelsService';
import type { FreedomReelItem as ReelModel } from './freedom-types';
import './freedom.css';

export interface FreedomReelsViewerProps {
  initialReelId?: string | null;
  onClose?: () => void;
}

export const FreedomReelsViewer: React.FC<FreedomReelsViewerProps> = ({
  initialReelId,
  onClose,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { haptic } = useHapticFeedback();

  const [reels, setReels] = useState<ReelModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCommentsReel, setActiveCommentsReel] = useState<ReelModel | null>(null);
  const [activeShareReel, setActiveShareReel] = useState<ReelModel | null>(null);
  const [activeKit, setActiveKit] = useState<{ id: string; name?: string } | null>(null);
  const [activeSound, setActiveSound] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Hide global navigation and native bottom bar for 100% immersive experience
  useEffect(() => {
    document.body.dataset.freedomOpen = 'true';
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.tb, nav[aria-label="Navigation principale"], .account-bottom-bar, [data-account-bottom-bar]',
      ),
    );
    const previousDisplays = nodes.map((n) => n.style.display);
    nodes.forEach((n) => {
      n.style.display = 'none';
      n.setAttribute('aria-hidden', 'true');
    });

    return () => {
      delete document.body.dataset.freedomOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
      nodes.forEach((n, i) => {
        n.style.display = previousDisplays[i] ?? '';
        n.removeAttribute('aria-hidden');
      });
    };
  }, []);

  // Fetch reels
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFreedomReels(user)
      .then((data) => {
        if (!alive) return;
        setReels(data);
        if (initialReelId) {
          const idx = data.findIndex((r) => r.id === initialReelId);
          if (idx >= 0) setActiveIndex(idx);
        }
      })
      .catch((e) => {
        console.error('[Freedom] Error loading reels:', e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user, initialReelId]);

  // Observer to track which reel is currently visible in the snap viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reels.length === 0) return;

    const slides = Array.from(container.querySelectorAll<HTMLElement>('.freedom-reel-slide'));
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = slides.indexOf(entry.target as HTMLElement);
            if (index >= 0) {
              setActiveIndex(index);
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.6,
      },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [reels]);

  // Handle Exit (Swipe Left or Escape)
  const handleExit = useCallback(() => {
    haptic('light');
    if (onClose) {
      onClose();
    } else {
      router.push('/communaute');
    }
  }, [haptic, onClose, router]);

  // Handle author profile navigation (Swipe Right or click on avatar/handle)
  const handleAuthorProfile = useCallback(
    (author: ReelModel['author']) => {
      haptic('light');
      if (author.handle) {
        router.push(`/profil/${author.handle}`);
      } else if (author.id) {
        router.push(`/profil/${author.id}`);
      } else {
        router.push('/compte');
      }
    },
    [haptic, router],
  );

  // Keyboard navigation & gestures
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeCommentsReel || activeShareReel || activeKit || activeSound) return;
      if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        handleExit();
      } else if (e.key === 'ArrowRight') {
        const current = reels[activeIndex];
        if (current) handleAuthorProfile(current.author);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(reels.length - 1, activeIndex + 1);
        const el = document.getElementById(`freedom-reel-${reels[next]?.id}`);
        el?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, activeIndex - 1);
        const el = document.getElementById(`freedom-reel-${reels[prev]?.id}`);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, reels, activeCommentsReel, activeShareReel, activeKit, activeSound, handleExit, handleAuthorProfile]);

  const handleOpenKitFromReel = (kitId: string, kitName?: string) => {
    haptic('medium');
    setActiveKit({ id: kitId, name: kitName });
  };

  const handleSelectReelFromSound = (reelId: string) => {
    const idx = reels.findIndex((r) => r.id === reelId);
    if (idx >= 0) {
      setActiveIndex(idx);
      const el = document.getElementById(`freedom-reel-${reelId}`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const currentReel = reels[activeIndex];

  return (
    <div className="freedom-reels-viewport">
      {/* Top Center Location Header (Volume, page name, back arrow and plus button removed) */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-center px-4 pt-[max(14px,var(--safe-top,14px))] pointer-events-none">
        {currentReel?.location && (
          <button
            type="button"
            onClick={() => {
              haptic('light');
              router.push(`/explorer?q=${encodeURIComponent(currentReel.location || '')}`);
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-xl transition active:scale-95"
            aria-label={`Explorer le lieu ${currentReel.location}`}
          >
            <MapPin size={12} className="text-[#64D2FF]" />
            <span className="max-w-[260px] truncate">{currentReel.location}</span>
          </button>
        )}
      </header>

      {/* Vertical Snap Scroll Reels Container */}
      <main
        ref={containerRef}
        className="freedom-reels-container"
        tabIndex={0}
        aria-label="Flux de micro-vidéos Freedom"
      >
        {loading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white">
            <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="text-xs font-semibold tracking-wider text-white/70">
              IMMERSION FREEDOM…
            </span>
          </div>
        ) : (
          reels.map((reel, index) => {
            const isActive = index === activeIndex;
            const isPreload = Math.abs(index - activeIndex) <= 1;

            return (
              <FreedomReelItem
                key={reel.id}
                reel={reel}
                isActive={isActive}
                isPreload={isPreload}
                globalMuted={false}
                onOpenComments={(r) => setActiveCommentsReel(r)}
                onOpenShare={(r) => setActiveShareReel(r)}
                onOpenKit={handleOpenKitFromReel}
                onOpenSound={(snd) => setActiveSound(snd)}
                onAuthorClick={() => handleAuthorProfile(reel.author)}
                onSwipeLeft={handleExit}
                onSwipeRight={() => handleAuthorProfile(reel.author)}
                onLikeChange={(id, nextLiked, nextCount) => {
                  setReels((prev) =>
                    prev.map((item) =>
                      item.id === id
                        ? { ...item, isLiked: nextLiked, likesCount: nextCount }
                        : item,
                    ),
                  );
                }}
              />
            );
          })
        )}
      </main>

      {/* Kit Drawer */}
      {activeKit && (
        <FreedomKitDrawer
          isOpen={Boolean(activeKit)}
          kitId={activeKit.id}
          initialName={activeKit.name}
          onClose={() => setActiveKit(null)}
        />
      )}

      {/* Sound Drawer (50% max height avec grille de posts à l'identique de la page compte) */}
      {activeSound && (
        <FreedomSoundDrawer
          isOpen={Boolean(activeSound)}
          soundTitle={activeSound}
          allReels={reels}
          onClose={() => setActiveSound(null)}
          onSelectReel={handleSelectReelFromSound}
        />
      )}

      {/* Half-Screen Comments Drawer */}
      {activeCommentsReel && (
        <FreedomCommentsDrawer
          isOpen={Boolean(activeCommentsReel)}
          reelId={activeCommentsReel.id}
          currentUser={user}
          onClose={() => setActiveCommentsReel(null)}
          onOpenKit={handleOpenKitFromReel}
          onCommentsCountChange={(count) => {
            setReels((prev) =>
              prev.map((r) =>
                r.id === activeCommentsReel.id ? { ...r, commentsCount: count } : r,
              ),
            );
          }}
        />
      )}

      {/* Half-Screen Share Drawer (max 50% height, style des posts) */}
      {activeShareReel && (
        <FreedomShareDrawer
          isOpen={Boolean(activeShareReel)}
          reel={activeShareReel}
          currentUser={user}
          onClose={() => setActiveShareReel(null)}
          onShared={() => {
            setReels((prev) =>
              prev.map((r) =>
                r.id === activeShareReel.id ? { ...r, sharesCount: r.sharesCount + 1 } : r,
              ),
            );
          }}
        />
      )}
    </div>
  );
};

export default FreedomReelsViewer;
