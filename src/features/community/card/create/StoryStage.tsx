'use client';

import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import { useObjectUrl } from './wizard/fields';

/**
 * Média de la story en grand : il prend la place du fond de la carte-drawer
 * (portail dans `.lkdv-cd`), la capsule d'onglets disparaît (voir `community-card.css`)
 * et la flèche en bas à droite est le seul bouton. Toucher le média le remplace.
 */
export function StoryStage({
  file,
  onReplace,
  onNext,
}: {
  file: File;
  onReplace: (file: File) => void;
  onNext: () => void;
}) {
  const anchor = React.useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const url = useObjectUrl(file);
  const inputId = useId();

  useEffect(() => {
    setHost(anchor.current?.closest('.lkdv-cd') ?? null);
  }, []);

  const isVideo = file.type.startsWith('video/');

  return (
    <>
      <span ref={anchor} hidden />
      {host
        ? createPortal(
            <div className="lkdv-story-stage">
              <label
                htmlFor={inputId}
                className="lkdv-story-media"
                aria-label="Changer la photo ou la vidéo"
              >
                {url ? (
                  isVideo ? (
                    <video src={url} autoPlay muted loop playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
                    <img src={url} alt="" />
                  )
                ) : null}
              </label>
              <input
                id={inputId}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                className="sr-only"
                onChange={(event) => {
                  const next = event.target.files?.[0];
                  if (next) onReplace(next);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                className="lkdv-story-next"
                aria-label="Continuer"
                onClick={onNext}
              >
                <Icon name="arrow-right" size={22} aria-hidden="true" />
              </button>
            </div>,
            host
          )
        : null}
    </>
  );
}

export default StoryStage;
