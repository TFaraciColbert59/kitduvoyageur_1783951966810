import React, { useId } from 'react';

/**
 * Illustration de repli quand un jour, un moment ou le carnet n'a aucune photo :
 * la scène « alps » de la maquette (ciel, soleil, quatre plans de montagne, neige),
 * peinte avec les jetons sauge / pierre — jamais une photo inventée.
 */
export function CarnetArt({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sage-200)" />
          <stop offset="1" stopColor="var(--lkv-stone-100)" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${gradient})`} />
      <circle cx="310" cy="70" r="34" fill="var(--lkv-warning)" opacity="0.45" />
      <path d="M0 150 L70 90 L120 125 L190 60 L260 120 L310 85 L400 140 V300 H0z" fill="var(--sage-300)" />
      <path d="M0 195 L90 140 L160 175 L250 120 L330 170 L400 150 V300 H0z" fill="var(--sage-400)" />
      <path d="M0 240 L110 200 L210 225 L300 190 L400 220 V300 H0z" fill="var(--sage-600)" />
      <path d="M0 275 L120 255 L240 270 L400 250 V300 H0z" fill="var(--sage-800)" />
      <path d="M178 72 L190 60 L204 80 L196 76 L190 84 L184 76z" fill="var(--lkv-stone-50)" opacity="0.9" />
    </svg>
  );
}
