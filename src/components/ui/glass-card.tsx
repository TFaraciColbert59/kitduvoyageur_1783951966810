import React from 'react';

/**
 * LKDV — Liquid Glass Card (visionOS light, palette LKDV).
 * v2 : plus transparent, blur plus puissant, reflets plus fins.
 * opacity par défaut abaissée à 0.32 pour laisser respirer la vidéo de fond.
 */
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Rayon de coin (px). */
  radius?: number;
  /** Intensité de la surface (0.25 → 0.6). */
  opacity?: number;
}

export default function GlassCard({
  children,
  className = '',
  radius = 28,
  opacity = 0.32,
  style,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        border: '1px solid rgba(255,255,255,0.45)',
        background: `linear-gradient(
          160deg,
          rgba(255,255,255,${Math.min(1, opacity + 0.18)}) 0%,
          rgba(255,255,255,${opacity}) 45%,
          rgba(163,196,163,${opacity * 0.5}) 100%
        )`,
        backdropFilter: 'blur(52px) saturate(1.8) brightness(1.04)',
        WebkitBackdropFilter: 'blur(52px) saturate(1.8) brightness(1.04)',
        boxShadow: [
          `0 32px 72px -28px rgba(11,31,23,0.18)`,
          `0 2px 12px rgba(11,31,23,0.04)`,
          `inset 0 1px 0 0 rgba(255,255,255,0.9)`,
          `inset 0 0 0 1px rgba(255,255,255,0.14)`,
        ].join(', '),
        ...style,
      }}
      {...rest}
    >
      {/* Reflet supérieur fin */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
        }}
      />
      {/* Liseré lumineux masqué */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          padding: 1,
          borderRadius: radius,
          background:
            'linear-gradient(140deg, rgba(255,255,255,0.9), rgba(255,255,255,0.2) 40%, rgba(163,196,163,0.15) 75%)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative h-full flex flex-col">{children}</div>
    </div>
  );
}
