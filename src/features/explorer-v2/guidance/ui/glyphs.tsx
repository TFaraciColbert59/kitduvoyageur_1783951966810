'use client';

/**
 * Lot N01 — Glyphes de manœuvre et rosace de boussole.
 *
 * Les flèches sont dessinées localement (aucune police ni image) et tournées
 * selon l'angle signé de la manœuvre : négatif = gauche, positif = droite.
 */

import React from 'react';
import type { ManeuverKind } from '@/features/navigation';

const ROTATION_BY_KIND: Readonly<Record<ManeuverKind, number>> = {
  depart: 0,
  straight: 0,
  'slight-left': -35,
  'turn-left': -90,
  'sharp-left': -135,
  'slight-right': 35,
  'turn-right': 90,
  'sharp-right': 135,
  'u-turn': 180,
  waypoint: 0,
  arrive: 0,
};

export function ManeuverGlyph({
  kind,
  size = 30,
  title,
}: {
  kind: ManeuverKind;
  size?: number;
  /** Titre accessible ; sans titre le glyphe est décoratif. */
  title?: string;
}) {
  const rotation = ROTATION_BY_KIND[kind] ?? 0;
  const isFlag = kind === 'arrive' || kind === 'depart';
  const isWaypoint = kind === 'waypoint';

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {isFlag ? (
        <>
          <path d="M6 21V4" />
          <path d="M6 4h11l-2 4 2 4H6" />
          {kind === 'arrive' ? <path d="M6 18h6" /> : null}
        </>
      ) : isWaypoint ? (
        <>
          <path d="M12 21s-6-5.7-6-10.2a6 6 0 0 1 12 0C18 15.3 12 21 12 21z" />
          <circle cx="12" cy="10.5" r="2.1" />
        </>
      ) : (
        <g transform={`rotate(${rotation} 12 12)`}>
          <path d="M12 20V5" />
          <path d="M6.8 10.2 12 5l5.2 5.2" />
        </g>
      )}
    </svg>
  );
}

/** Rosace graduée : la rotation de la rose est compensée par le cap carte. */
export function CompassRose({ rotationDeg }: { rotationDeg: number }) {
  const ticks = Array.from({ length: 24 });
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <g transform={`rotate(${rotationDeg} 50 50)`}>
        {ticks.map((_, index) => {
          const angle = index * 15;
          const major = index % 6 === 0;
          return (
            <line
              key={angle}
              x1="50"
              y1={major ? 8 : 5}
              x2="50"
              y2="11"
              stroke="currentColor"
              strokeWidth={major ? 1.6 : 0.8}
              opacity={major ? 0.55 : 0.28}
              transform={`rotate(${angle} 50 50)`}
            />
          );
        })}
        <path
          d="M50 16 55 48 50 44 45 48Z"
          fill="currentColor"
          opacity="0.9"
          transform="rotate(0 50 50)"
        />
      </g>
    </svg>
  );
}
