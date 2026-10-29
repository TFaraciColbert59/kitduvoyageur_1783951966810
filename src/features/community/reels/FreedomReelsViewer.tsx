'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Volume2, VolumeX, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useKitSheet } from '@/features/kits/KitSheetContext';
import { FreedomReelItem } from './FreedomReelItem';
import { FreedomCommentsDrawer } from './FreedomCommentsDrawer';
import { FreedomShareDrawer } from './FreedomShareDrawer';
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
  const { openKit } = useKitSheet();

  const [reels, setReels] = useState<ReelModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [activeCommentsReel, setActiveCommentsReel] = useState<ReelModel | null>(null);
  const [activeShareReel, setActiveShareReel] = useState<ReelModel | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Hide global navigation and native iOS bar for 100% immersion
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

  // Handle Exit
  const handleExit = useCallback(() => {
    haptic('light');
    if (onClose) {
      onClose();
    } else {
      router.push('/communaute');
    }
  }, [haptic, onClose, router]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeCommentsReel || activeShareReel) return;
      if (e.key === 'Escape') {
        handleExit();
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
      } else if (e.key === 'm' || e.key === 'M') {
        setGlobalMuted((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, reels, activeCommentsReel, activeShareReel, handleExit]);

  const handleOpenKitFromReel = (kitId: string) => {
    haptic('medium');
    openKit(kitId, 'messaging');
  };

  return (
    <div className="freedom-reels-viewport">
      {/* Top Floating Navigation Header */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3.5 pt-[max(12px,var(--safe-top,12px))] pointer-events-none">
        {/* Left: Back Button */}
        <button
          type="button"
          onClick={handleExit}
          className="pointer-events-auto grid size-10 place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md transition active:scale-90"
          aria-label="Retour à la communauté"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Center: Brand Badge "Freedom" */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3.5 py-1.5 backdrop-blur-md">
          <Sparkles size={14} className="text-[#64D2FF]" />
          <span className="text-xs font-extrabold tracking-wide text-white">
            FREEDOM
          </span>
          <span className="text-[10px] font-semibold text-white/70">· Outdoor</span>
        </div>

        {/* Right: Sound toggle and Create reel */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              haptic('selection');
              setGlobalMuted(!globalMuted);
            }}
            className="grid size-10 place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md transition active:scale-90"
            aria-label={globalMuted ? 'Activer le son' : 'Couper le son'}
          >
            {globalMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          <button
            type="button"
            onClick={() => {
              haptic('light');
              router.push('/communaute?create=story');
            }}
            className="grid size-10 place-items-center rounded-full bg-[#17402C] text-white shadow-lg transition active:scale-90"
            aria-label="Créer une micro-vidéo"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
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
                globalMuted={globalMuted}
                onToggleMute={() => setGlobalMuted(!globalMuted)}
                onOpenComments={(r) => setActiveCommentsReel(r)}
                onOpenShare={(r) => setActiveShareReel(r)}
                onOpenKit={handleOpenKitFromReel}
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

      {/* Half-Screen Comments Drawer */}
      {activeCommentsReel && (
        <FreedomCommentsDrawer
          isOpen={Boolean(activeCommentsReel)}
          reelId={activeCommentsReel.id}
          currentUser={user}
          onClose={() => setActiveCommentsReel(null)}
          onCommentsCountChange={(count) => {
            setReels((prev) =>
              prev.map((r) =>
                r.id === activeCommentsReel.id ? { ...r, commentsCount: count } : r,
              ),
            );
          }}
        />
      )}

      {/* Half-Screen Share Drawer */}
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
