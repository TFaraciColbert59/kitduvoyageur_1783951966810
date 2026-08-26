'use client';

import React from 'react';

/**
 * BackgroundVideo — Fond vidéo immersif direct sans aucun voile blanc
 * Utilise kling_20260826_VIDEO_Cinematic__5411_0.mp4 (via /mobile-cinematic-bg.mp4).
 */
export function BackgroundVideo() {
  return (
    <div
      className="fixed top-0 left-0 -z-10 overflow-hidden pointer-events-none"
      style={{ width: '100%', height: '100dvh' }}
      aria-hidden="true"
    >
      <video
        className="h-full w-full object-cover"
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

export default BackgroundVideo;