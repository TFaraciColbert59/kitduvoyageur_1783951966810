'use client';
import { useEffect, useState } from 'react';

/** Fond vidéo immersif du cockpit Mon Matériel (Liquid Glass over video).
 *  Respecte prefers-reduced-motion (vidéo figée/absente). */
export function BackgroundVideo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      {mounted && (
        <video
          className="h-full w-full object-cover blur-[6px] scale-105"
          src="/materiel/background.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/images/no_image.png"
        />
      )}
      <div className="absolute inset-0 bg-[color:var(--ink-900)]/10" />
    </div>
  );
}
