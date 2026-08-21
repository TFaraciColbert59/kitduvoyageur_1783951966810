'use client';
import { useEffect, useState } from 'react';

/** Fond vidéo immersif du cockpit Mon Matériel (Liquid Glass over video).
 *  Respecte prefers-reduced-motion (vidéo figée/absente). */
export function BackgroundVideo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {mounted && (
        <video
          className="h-full w-full object-cover blur-[4px] scale-105 brightness-[1.08] saturate-[1.2]"
          src="/materiel/background.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/images/hero-misty.jpg"
        />
      )}
      {/* Ambient Luminous Aurora / Light Mesh for iOS 26 Liquid Glass Refraction */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(100% 65% at 50% 0%, rgba(226, 242, 236, 0.75) 0%, rgba(245, 249, 246, 0.45) 50%, transparent 85%),
            radial-gradient(70% 50% at 90% 70%, rgba(163, 196, 163, 0.35) 0%, transparent 65%),
            radial-gradient(60% 45% at 10% 80%, rgba(185, 215, 228, 0.30) 0%, transparent 60%)
          `,
        }}
      />
    </div>
  );
}
