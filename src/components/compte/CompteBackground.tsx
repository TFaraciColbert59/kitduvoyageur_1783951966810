'use client';

import React from 'react';

/**
 * Fond immersif vidéo cinématique sans voile blanc
 * Utilise kling_20260826_VIDEO_Cinematic__5411_0.mp4 (via /mobile-cinematic-bg.mp4).
 */
export function CompteBackground() {
  return (
    <div
      className="fixed top-0 left-0 -z-10 overflow-hidden pointer-events-none"
      style={{ width: '100%', height: '100dvh' }}
      aria-hidden="true"
    >
      <video
        className="w-full h-full object-cover"
        src="/mobile-cinematic-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        suppressHydrationWarning
        style={{
          objectFit: 'cover',
          width: '100vw',
          height: '100dvh',
        }}
      />
    </div>
  );
}

export default CompteBackground;
