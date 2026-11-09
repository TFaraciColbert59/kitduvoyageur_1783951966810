'use client';

import { useState } from 'react';
import s from './crm.module.css';
import { cx } from './cx';
import { Button } from './button';
import { IconEye } from './icons';

/**
 * Média grisé et flouté au repos, net au survol ou au focus.
 * Accessible au clavier : le bouton « Afficher » est le chemin équivalent.
 */
export function BlurredMedia({
  src,
  alt,
  width = 180,
  height = 120
}: {
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={s.rowFlexWrap} style={{ alignItems: 'flex-start' }}>
      <div
        className={s.blurBox}
        style={{ width, height }}
        onMouseEnter={() => setRevealed(true)}
        onMouseLeave={() => setRevealed(false)}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={revealed ? alt : ''}
            className={cx(s.blurImg, revealed && s.blurRevealed)}
            onFocus={() => setRevealed(true)}
            onBlur={() => setRevealed(false)}
            tabIndex={0}
            aria-label={alt}
          />
        ) : (
          <span className={cx(s.center, s.muted)} style={{ width: '100%', height: '100%', fontSize: 12 }}>
            Média non renseigné
          </span>
        )}
      </div>
      <div className={s.colGapSm} style={{ maxWidth: 320 }}>
        <strong style={{ fontSize: 13 }}>Média : grisé et flouté par défaut</strong>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Survolez-le ou utilisez le bouton pour le voir net. Ce réglage protège votre attention sur les cas difficiles.
        </span>
        <Button
          size="sm"
          tone="soft"
          icon={<IconEye size={16} />}
          aria-pressed={revealed}
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? 'Masquer le média' : 'Afficher'}
        </Button>
      </div>
    </div>
  );
}
