import React from 'react';

/**
 * LKDV — Liquid Glass Card (visionOS light, palette LKDV).
 * Surface : blanc chaud translucide + flou fort mais lisible, liseré blanc
 * discret, ombre douce encre, reflet subtil et teinte verte cohérente.
 * Bout de compat. : le composant accepte aussi `style` et les props HTML.
 */
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Rayon de coin (px). */
  radius?: number;
  /** Intensité de la surface (0.4 → 0.75). */
  opacity?: number;
}

export default function GlassCard({
  children,
  className = '',
  radius = 28,
  opacity = 0.55,
  style,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden border border-white/70 ${className}`}
      style={{
        borderRadius: radius,
        background: `linear-gradient(160deg, rgba(255,255,255,${Math.min(1, opacity + 0.15)}), rgba(255,255,255,${opacity}) 45%, rgba(251,250,246,${opacity}))`,
        backdropFilter: 'blur(40px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
        boxShadow:
          '0 24px 60px -24px rgba(11,31,23,0.22), 0 4px 16px rgba(11,31,23,0.06), inset 0 1px 0 0 rgba(255,255,255,0.85), inset 0 0 0 1px rgba(163,196,163,0.12)',
        ...style,
      }}
      {...rest}
    >
      {/* Reflet supérieur */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.12) 55%, transparent 100%)',
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
            'linear-gradient(140deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35) 40%, rgba(163,196,163,0.25) 75%)',
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