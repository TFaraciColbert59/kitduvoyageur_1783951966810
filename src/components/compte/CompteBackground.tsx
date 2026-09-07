'use client';

import React from 'react';

/**
 * Fond immersif vidéo cinématique sans voile blanc
 * Utilise kling_20260826_VIDEO_Cinematic__5411_0.mp4 (via /mobile-cinematic-bg.mp4).
 */
export function CompteBackground() {
  const [shouldPlayVideo, setShouldPlayVideo] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ne pas charger la vidéo si l'utilisateur souhaite économiser ses données
    const nav = navigator as any;
    const isSaveData = Boolean(nav.connection?.saveData);
    const isSlowConnection = nav.connection?.effectiveType === '2g' || nav.connection?.effectiveType === 'slow-2g';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isSaveData && !isSlowConnection && !prefersReducedMotion) {
      setShouldPlayVideo(true);
    }
  }, []);

  return (
    <div
      className="hidden md:block fixed inset-0 overflow-hidden pointer-events-none select-none"
      style={{
        zIndex: 0,
        width: '100vw',
        height: '100dvh',
        background: 'linear-gradient(180deg, #17402C 0%, #203B2C 40%, #2E4738 75%, #142E20 100%)',
      }}
      aria-hidden="true"
    >
      {/* Fallback image poster optimisée */}
      <img
        src="/assets/images/forest-1.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
        loading="lazy"
        decoding="async"
      />

      {/* Cinematic Video Layer (chargée conditionnellement pour préserver les budgets Web Vitals) */}
      {shouldPlayVideo && (
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-85 transition-opacity duration-1000"
          src="/mobile-cinematic-bg.mp4"
          poster="/assets/images/forest-1.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          suppressHydrationWarning
          style={{
            objectFit: 'cover',
            width: '100vw',
            height: '100dvh',
            transform: 'scale(1.08)',
            transformOrigin: 'center center',
          }}
        />
      )}

      {/* Atmospheric Vignette & Depth Overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, transparent 0%, rgba(11, 31, 23, 0.45) 100%)',
        }}
      />
    </div>
  );
}

export default CompteBackground;
