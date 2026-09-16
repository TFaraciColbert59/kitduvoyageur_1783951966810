/**
 * P1-3 (fin) — Defs SVG du filtre liquid-glass, SANS framer-motion : le layout
 * hub n'importe que ce module (le composant LiquidGlassCard, lui, garde ses
 * interactions et vit dans ./liquid-glass).
 */
export function LiquidGlassDefs({ id = 'lkdv-glass-blur' }: { id?: string }) {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter
          id={id}
          x="0"
          y="0"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003 0.007"
            numOctaves="1"
            result="turbulence"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale="200"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default LiquidGlassDefs;
