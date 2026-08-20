'use client';

/**
 * LKDV — Mon Matériel : fond d'ambiance animé.
 * Vidéo locale (`public/assets/videos/mm-ambient.mp4`) en `object-cover`,
 * `autoPlay muted loop playsInline` avec image de secours (`poster` + fallback
 * sur src), voilée d'un dégradé papier clair LKDV et d'une teinte forest douce
 * (`--mm-forest-soft`). `prefers-reduced-motion` → fond figé sur le poster.
 */

import React from 'react';
import Image from 'next/image';

export interface AnimatedBackgroundProps {
  /** Source vidéo (boucle animée). */
  videoSrc?: string;
  /** Image de secours / poster (fond animé antérieur Ken Burns). */
  src?: string;
}

export function AnimatedBackground({
  videoSrc = '/assets/videos/mm-ambient.mp4',
  src = '/assets/images/urban-vintage.jpg',
}: AnimatedBackgroundProps) {
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // En cas de vidéo indisponible / non lisible → repli sur l'image Ken Burns.
  const renderVideo = !reducedMotion && !videoFailed;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F5F3EE]" aria-hidden>
      {renderVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          poster={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 will-change-transform" style={{ transform: 'scale(1.08)' }}>
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
      )}
    </div>
  );
}