'use client';

/**
 * FIELD SEAL — le sceau d'empreinte (ADR-010, Lot C.3)
 * =====================================================
 * Marque générative DÉTERMINISTE : seed = hash(user_id), géométrie modulée par
 * l'empreinte (branches ~ saisons, densité ~ km, amplitude ~ D+).
 *
 * Contraintes dures :
 *  - UNIQUEMENT ink #17402C + sage-500 #5B7F55 + sage-300 #A6C1A0 sur verre —
 *    AUCUN autre token, AUCUN hex nouveau.
 *  - Lisible en niveaux de gris : la FORME suffit toujours (WCAG 1.4.1), jamais
 *    d'information portée par la couleur seule.
 *  - ABSENCE D'ORDRE : disposition radiale + symétrie → aucune branche ne se lit
 *    « plus haute » qu'une autre. Le sceau différencie, il ne hiérarchise pas.
 *  - Déterministe : même user_id → mêmes sorties SVG (testé).
 *  - Aucune donnée utilisateur injectée risquée (valeurs toutes numériques).
 */

import React from 'react';
import { fieldSealSeed, sealGeometry, type FieldSignatureRow } from '@/features/identity/fieldSignature';

const INK = '#17402C';
const SAGE_500 = '#5B7F55';
const SAGE_300 = '#A6C1A0';

interface FieldSealProps {
  userId: string;
  signature?: FieldSignatureRow | null;
  /** vue avatar (24) ou carte (240) */
  size?: number;
  ariaLabel?: string;
}

/** Petit PRNG déterministe (mulberry32) pour des jitters stables par seed. */
function mulberry32(seed: number) {
  let a = seed & 0xffffffff;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function FieldSeal({ userId, signature, size = 48, ariaLabel }: FieldSealProps) {
  const seed = fieldSealSeed(userId);
  const rnd = mulberry32(seed);
  const g = sealGeometry(signature);
  const branches = g.branches;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 1;
  const rot = rnd() * Math.PI * 2;

  const step = (Math.PI * 2) / branches;
  const spokes = Array.from({ length: branches }, (_, i) => {
    const ang = rot + step * i;
    const wave = Math.sin(ang * 3 + rot) * g.amplitude;
    const len = R * (0.45 + 0.2 * g.density) + wave;
    const x1 = cx + Math.cos(ang) * (R * 0.18);
    const y1 = cy + Math.sin(ang) * (R * 0.18);
    const x2 = cx + Math.cos(ang) * len;
    const y2 = cy + Math.sin(ang) * len;
    const w = 1 + g.density * 2.2;
    return (
      <path
        key={i}
        d={`M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`}
        stroke={i % 2 === 0 ? INK : SAGE_500}
        strokeWidth={w}
        strokeLinecap="round"
        fill="none"
      />
    );
  });

  const rings = [1, 2].map((k) => {
    const r = R * (0.28 + 0.18 * k) * (0.9 + 0.1 * g.density);
    return (
      <circle
        key={k}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={k === 1 ? SAGE_300 : SAGE_500}
        strokeWidth={1}
        opacity={0.8}
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }}
    >
      {rings}
      {spokes}
      <circle cx={cx} cy={cy} r={R * 0.14} fill={INK} opacity={0.85} />
    </svg>
  );
}