'use client';

import React from 'react';

/**
 * Fond immersif vidéo cinématique sans voile blanc
 * Utilise kling_20260826_VIDEO_Cinematic__5411_0.mp4 (via /mobile-cinematic-bg.mp4).
 */
export function CompteBackground() {
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
      {/* Fallback image poster */}
      <img
        src="/assets/images/forest-1.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
        loading="eager"
      />

      {/* Cinematic Video Layer */}
      <video
        className="absolute inset-0 w-full h-full object-cover opacity-85"
        src="/mobile-cinematic-bg.mp4"
        poster="/assets/images/forest-1.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        suppressHydrationWarning
        style={{
          objectFit: 'cover',
          width: '100vw',
          height: '100dvh',
          transform: 'scale(1.08)',
          transformOrigin: 'center center',
        }}
      />

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
