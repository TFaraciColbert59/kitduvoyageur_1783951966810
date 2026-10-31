'use client';

import React from 'react';
import { Heart } from 'lucide-react';

export interface LikeIconProps {
  /** Aimé : cœur plein, teinte « like ». */
  active?: boolean;
  size?: number;
  className?: string;
  /** Rejoue l'animation « pop » à chaque changement de cette clé. */
  pulseKey?: number;
  /** Cœur plein sans état « aimé » (rafale du double-tap, décor). */
  plain?: boolean;
}

/**
 * Icône « j'aime » UNIQUE de l'application (cœur lucide, trait 2).
 * Toute surface (fil, Freedom, Compte, Carnet, Club, Sortie, commentaire)
 * passe par ce composant : jamais de `<Heart>` direct ailleurs.
 * La teinte vient du CSS (`.lkdv-like.on`, token `--lkdv-like`).
 */
export function LikeIcon({ active = false, size = 18, className, pulseKey = 0, plain = false }: LikeIconProps) {
  return (
    <Heart
      key={pulseKey}
      size={size}
      aria-hidden="true"
      className={['lkdv-like', active && !plain ? 'on' : '', pulseKey > 0 ? 'is-pop' : '', className].filter(Boolean).join(' ')}
      fill={active || plain ? 'currentColor' : 'none'}
    />
  );
}

export default LikeIcon;
