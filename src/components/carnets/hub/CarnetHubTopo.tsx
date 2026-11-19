import React from 'react';

/**
 * Fond topographique dessiné — couverture d'un carnet sans photo (proposition
 * n° 5 : « sans photo du tout, carte topographique du tracé (courbes de niveau)
 * au lieu de l'initiale »). Les courbes sont décoratives ; l'initiale est
 * accompagnée du mot « Carnet » et le titre reste écrit sur le voile : jamais
 * une initiale seule.
 */
export interface CarnetHubTopoProps {
  /** Initiale du carnet ; absente (vignette de bande), seules les courbes restent. */
  initial?: string | null;
}

const HORIZONTAL_CONTOURS = [
  'M-10 108 C 8 96 18 104 32 92 S 54 74 72 82 S 96 72 110 62',
  'M-10 96 C 12 84 20 92 36 80 S 60 62 78 70 S 98 60 112 50',
  'M-10 84 C 14 72 24 80 40 68 S 64 50 82 58 S 100 48 114 38',
  'M-10 72 C 16 60 28 68 44 56 S 68 40 86 46 S 102 38 116 28',
  'M-10 60 C 18 48 32 56 48 44 S 72 28 90 34 S 104 28 118 18',
] as const;

const VERTICAL_CONTOURS = [
  'M18 -8 C 26 12 20 24 32 34 S 54 48 50 62 S 66 82 60 96 S 74 112 68 132',
  'M34 -8 C 42 10 36 26 48 38 S 68 50 64 66 S 80 84 74 100 S 88 114 82 132',
  'M50 -8 C 58 12 52 28 64 40 S 84 52 80 68 S 96 86 90 102 S 104 116 98 132',
] as const;

export function CarnetHubTopo({ initial }: CarnetHubTopoProps) {
  const letter = (initial ?? '').trim().charAt(0).toUpperCase();

  return (
    <>
      <svg
        className="lkdh-topo"
        viewBox="0 0 100 125"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <g className="lkdh-topo-contours">
          {HORIZONTAL_CONTOURS.map((d) => (
            <path key={d} className="lkdh-topo-line" d={d} />
          ))}
          {VERTICAL_CONTOURS.map((d) => (
            <path key={d} className="lkdh-topo-line" d={d} />
          ))}
        </g>
      </svg>
      {letter ? (
        <span className="lkdh-seal" aria-hidden="true">
          <b>{letter}</b>
          <small>Carnet</small>
        </span>
      ) : null}
    </>
  );
}

export default CarnetHubTopo;
