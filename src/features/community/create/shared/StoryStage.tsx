'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import './story-stage.css';

/**
 * Média de la story en grand : il prend la place du fond du drawer (portail dans la feuille),
 * la capsule d'onglets et la barre d'étapes disparaissent (voir `story-stage.css`) et la flèche
 * en bas à droite est le seul bouton. Toucher le média le retire pour en choisir un autre.
 */
export function StoryStage({
  src,
  isVideo,
  onNext,
  onReplace,
}: {
  src: string;
  isVideo: boolean;
  onNext: () => void;
  onReplace: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    setHost(anchor.current?.closest('[role="dialog"]') ?? null);
  }, []);

  return (
    <>
      <span ref={anchor} hidden />
      {host
        ? createPortal(
            <div className="lkdv-story-stage">
              <div
                className="lkdv-story-media"
                role="presentation"
                onClick={onReplace}
              >
                {isVideo ? (
                  <video src={src} autoPlay muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou média téléversé
                  <img src={src} alt="" />
                )}
              </div>
              <button type="button" className="lkdv-story-next" aria-label="Continuer" onClick={onNext}>
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </div>,
            host,
          )
        : null}
    </>
  );
}

export default StoryStage;
