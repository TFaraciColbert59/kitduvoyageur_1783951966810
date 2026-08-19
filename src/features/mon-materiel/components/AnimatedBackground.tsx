'use client';

/**
 * LKDV — Mon Matériel : fond d'ambiance animé « Ken Burns » (zoom/pan lent)
 * sur une image locale du projet, voilée d'un dégradé papier clair LKDV.
 * Aucune vidéo embarquée : pas d'asset vidéo dans le dépôt (audit Phase 0.6).
 * `prefers-reduced-motion` → fond figé (accessibilité).
 */

import React from 'react';
import Image from 'next/image';

export interface AnimatedBackgroundProps {
  src?: string;
  /** Accent supérieur gauche du voile (halo). */
  veil?: boolean;
}

export function AnimatedBackground({
  src = '/assets/images/urban-vintage.jpg',
  veil = true,
}: AnimatedBackgroundProps) {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F5F3EE]" aria-hidden>
      <div
        className="absolute inset-0 will-change-transform"
        style={
          reducedMotion
            ? { transform: 'scale(1.08)' }
            : {
                transform: 'scale(1.08)',
                animation: 'lkdv-kenburns 60s ease-in-out infinite alternate',
              }
        }
      >
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          style={{ filter: 'blur(8px) saturate(1.08) brightness(1.06)' }}
        />
      </div>
      {veil && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#F5F3EE]/70 via-[#FBFAF6]/40 to-[#F5F3EE]/75" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 12%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          {/* Teinte verte LKDV très légère */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{ background: 'linear-gradient(180deg, #A3C4A3, transparent 40%)' }}
          />
        </div>
      )}
      <style>{`
        @keyframes lkdv-kenburns {
          0%   { transform: scale(1.08) translate3d(0,0,0); }
          100% { transform: scale(1.16) translate3d(-1.2%, -1%, 0); }
        }
      `}</style>
    </div>
  );
}