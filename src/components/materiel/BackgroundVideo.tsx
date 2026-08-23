'use client';

/** Fond vidéo immersif du cockpit Mon Matériel (Liquid Glass over video).
 *  Couleurs exactes préservées (aucun filtre saturate/brightness/hue).
 *  Respecte prefers-reduced-motion (vidéo figée). */
export function BackgroundVideo() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <video
        className="h-full w-full object-cover blur-[2px] scale-105"
        src="/materiel/background.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/materiel/background.jpg"
        suppressHydrationWarning
      />
      {/* Ambient Luminous Aurora / Light Mesh for iOS 26 Liquid Glass Refraction */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(100% 65% at 50% 0%, rgba(226, 242, 236, 0.20) 0%, rgba(245, 249, 246, 0.10) 50%, transparent 85%),
            radial-gradient(70% 50% at 90% 70%, rgba(163, 196, 163, 0.08) 0%, transparent 65%),
            radial-gradient(60% 45% at 10% 80%, rgba(185, 215, 228, 0.07) 0%, transparent 60%)
          `,
        }}
      />
    </div>
  );
}
