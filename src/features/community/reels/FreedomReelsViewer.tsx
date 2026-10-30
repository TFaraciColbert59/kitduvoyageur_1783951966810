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
import { bufferVideo, peekFreedomReels, warmFreedomReels } from './freedomReelsService';
import {
  isNetworkPermittingBackgroundPreload,
  isFastNetworkConnection,
  runWhenIdle,
  preloadImage,
  preloadPublicProfile,
  preloadReelComments,
} from './reelsPreloadService';
import type { FreedomReelItem as ReelModel } from './freedom-types';
import './freedom.css';

/** Nombre de vidéos chargées à l'avance devant la vidéo en cours. */
const PRELOAD_AHEAD = 5;

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

  // Liste préchauffée par la barre du bas : ouverture sans écran de chargement.
  const [reels, setReels] = useState<ReelModel[]>(() => peekFreedomReels() ?? []);
  const [loading, setLoading] = useState(() => peekFreedomReels() === null);
  const [activeIndex, setActiveIndex] = useState(() => {
    const cached = peekFreedomReels();
    const found = initialReelId && cached ? cached.findIndex((r) => r.id === initialReelId) : -1;
    return found >= 0 ? found : 0;
  });
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
    const hadCache = peekFreedomReels() !== null;
    if (!hadCache) setLoading(true);
    warmFreedomReels(user)
      .then((data) => {
        // Liste déjà affichée depuis le cache : on ne la remplace pas sous le
        // doigt, le rafraîchissement sert à l'ouverture suivante.
        if (!alive || hadCache) return;
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

  // Fenêtre glissante : à chaque vidéo regardée, les 5 suivantes sont mises en
  // mémoire tampon (indépendamment de leur montage dans le DOM).
  useEffect(() => {
    reels.slice(activeIndex + 1, activeIndex + 1 + PRELOAD_AHEAD).forEach((reel) => bufferVideo(reel.videoUrl));
  }, [activeIndex, reels]);

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

  // Background Preload (Network-aware & Idle-scheduled):
  // 1. Profil de l'auteur du reel en cours pour navigation instantanée (0ms)
  // 2. Commentaires du reel en cours pour ouverture instantanée sans spinner
  // 3. Préchargement préventif du reel suivant si connexion rapide (4G / 5G / Wi-Fi)
  useEffect(() => {
    if (!isNetworkPermittingBackgroundPreload() || reels.length === 0) return;

    const currentReel = reels[activeIndex];
    if (!currentReel) return;

    // Planifie le préchargement sur temps libre du CPU sans impacter les 60fps
    const cancelIdle = runWhenIdle(() => {
      // 1. Profil de l'auteur du reel actif
      const author = currentReel.author;
      const authorKey = author?.handle || author?.id;
      if (authorKey) {
        try {
          router.prefetch(`/profil/${authorKey}`);
        } catch {
          // ignore
        }
        void preloadPublicProfile(authorKey, {
          id: author.id,
          name: author.name,
          handle: author.handle,
          avatarUrl: author.avatarUrl,
        });
      }

      // Avatar image cache
      if (author?.avatarUrl) {
        preloadImage(author.avatarUrl);
      }

      // 2. Commentaires du reel actif
      if (currentReel.id) {
        void preloadReelComments(currentReel.id, user);
      }

      // 3. Si connexion très rapide, précharger le reel suivant de façon opportuniste
      if (isFastNetworkConnection() && activeIndex + 1 < reels.length) {
        const nextReel = reels[activeIndex + 1];
        if (nextReel) {
          const nextKey = nextReel.author?.handle || nextReel.author?.id;
          if (nextKey) {
            try {
              router.prefetch(`/profil/${nextKey}`);
            } catch {
              // ignore
            }
            void preloadPublicProfile(nextKey, {
              id: nextReel.author?.id,
              name: nextReel.author?.name,
              handle: nextReel.author?.handle,
              avatarUrl: nextReel.author?.avatarUrl,
            });
          }
          if (nextReel.author?.avatarUrl) {
            preloadImage(nextReel.author.avatarUrl);
          }
          if (nextReel.id) {
            void preloadReelComments(nextReel.id, user);
          }
        }
      }
    }, 1200);

    return () => {
      cancelIdle();
    };
  }, [activeIndex, reels, router, user]);

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

  // Navigation helpers
  const goToNextReel = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      haptic('light');
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      const el = document.getElementById(`freedom-reel-${reels[nextIdx]?.id}`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeIndex, reels, haptic]);

  const goToPrevReel = useCallback(() => {
    if (activeIndex > 0) {
      haptic('light');
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      const el = document.getElementById(`freedom-reel-${reels[prevIdx]?.id}`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeIndex, reels, haptic]);

  // Master Gesture Controller (Pointer + Touch unifiés)
  // - Swipe Gauche: Quitte Freedom Reels
  // - Swipe Droite: Ouvre le profil du créateur
  // - Swipe Haut / Bas (souris / desktop): Reel suivant / précédent
  const gestureStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isDown: boolean;
    triggered: boolean;
    pointerType?: string;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isDown: false,
    triggered: false,
  });

  const onGestureStart = (clientX: number, clientY: number, pointerType?: string) => {
    if (activeCommentsReel || activeShareReel || activeKit || activeSound) return;
    gestureStateRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      isDown: true,
      triggered: false,
      pointerType,
    };
  };

  const onGestureMove = (clientX: number, clientY: number) => {
    const s = gestureStateRef.current;
    if (!s.isDown || s.triggered) return;
    if (activeCommentsReel || activeShareReel || activeKit || activeSound) return;

    const deltaX = clientX - s.startX;
    const deltaY = clientY - s.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 1. Détection Swipe Horizontal (Inversé selon demande utilisateur) :
    // - Swipe Gauche (deltaX < 0) : Profil utilisateur créateur
    // - Swipe Droite (deltaX > 0) : Quitter Freedom (Retour communauté)
    if (absX >= 45 && absX > absY * 1.05) {
      s.triggered = true;
      if (deltaX < 0) {
        // Swipe vers la gauche: Profil utilisateur (style TikTok)
        const current = reels[activeIndex];
        if (current) handleAuthorProfile(current.author);
      } else {
        // Swipe vers la droite: Sortir d'ici / Retour communauté
        handleExit();
      }
      return;
    }

    // 2. Détection Glisser Vertical à la souris (Desktop)
    if (s.pointerType === 'mouse' && absY >= 65 && absY > absX * 1.1) {
      s.triggered = true;
      if (deltaY < 0) {
        goToNextReel();
      } else {
        goToPrevReel();
      }
    }
  };

  const onGestureEnd = (clientX: number, clientY: number) => {
    const s = gestureStateRef.current;
    if (!s.isDown) return;

    if (!s.triggered && !activeCommentsReel && !activeShareReel && !activeKit && !activeSound) {
      const deltaX = clientX - s.startX;
      const deltaY = clientY - s.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const elapsed = Date.now() - s.startTime;

      // Flick rapide (< 350ms)
      if (elapsed < 350) {
        if (absX >= 35 && absX > absY) {
          s.triggered = true;
          if (deltaX < 0) {
            // Flick vers la gauche -> Profil
            const current = reels[activeIndex];
            if (current) handleAuthorProfile(current.author);
          } else {
            // Flick vers la droite -> Quitter
            handleExit();
          }
        } else if (s.pointerType === 'mouse' && absY >= 40 && absY > absX) {
          s.triggered = true;
          if (deltaY < 0) {
            goToNextReel();
          } else {
            goToPrevReel();
          }
        }
      }
    }

    gestureStateRef.current.isDown = false;
    gestureStateRef.current.triggered = false;
  };

  const onGestureCancel = () => {
    gestureStateRef.current.isDown = false;
    gestureStateRef.current.triggered = false;
  };

  // Keyboard navigation & gestures
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeCommentsReel || activeShareReel || activeKit || activeSound) return;
      if (e.key === 'Escape') {
        handleExit();
      } else if (e.key === 'ArrowLeft') {
        const current = reels[activeIndex];
        if (current) handleAuthorProfile(current.author);
      } else if (e.key === 'ArrowRight') {
        handleExit();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextReel();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevReel();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, reels, activeCommentsReel, activeShareReel, activeKit, activeSound, handleExit, handleAuthorProfile, goToNextReel, goToPrevReel]);

  const handleOpenKitFromReel = (kitId: string, kitName?: string) => {
    haptic('medium');
    setActiveCommentsReel(null);
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

      {/* Vertical Snap Scroll Reels Container with Unified Gesture Engine */}
      <main
        ref={containerRef}
        className="freedom-reels-container"
        tabIndex={0}
        aria-label="Flux de micro-vidéos Freedom"
        onPointerDown={(e) => onGestureStart(e.clientX, e.clientY, e.pointerType)}
        onPointerMove={(e) => onGestureMove(e.clientX, e.clientY)}
        onPointerUp={(e) => onGestureEnd(e.clientX, e.clientY)}
        onPointerCancel={onGestureCancel}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            onGestureStart(e.touches[0].clientX, e.touches[0].clientY, 'touch');
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) {
            onGestureMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={(e) => {
          if (e.changedTouches.length === 1) {
            onGestureEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
          } else {
            onGestureCancel();
          }
        }}
        onTouchCancel={onGestureCancel}
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
            // Les 5 vidéos suivantes (et la précédente) se chargent en arrière-plan :
            // le temps de regarder les 4 du dessus, la 5e est prête.
            const isPreload =
              (index > activeIndex && index <= activeIndex + PRELOAD_AHEAD) || index === activeIndex - 1;

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
                onSwipeLeft={() => handleAuthorProfile(reel.author)}
                onSwipeRight={handleExit}
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
          onNavigateToProfile={(author) => {
            setActiveCommentsReel(null);
            handleAuthorProfile(author as any);
          }}
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
