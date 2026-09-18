"use client";

import React, {
  type CSSProperties,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ShaderDisplacementGenerator, fragmentShaders } from "./shader-utils";

export type GlassMode = "standard" | "shader";

/* ------------------------------------------------------------------ *
 * Carte de déplacement statique (fallback léger si le shader échoue)  *
 *   R = déplacement X  ·  B = déplacement Y  ·  128 = neutre          *
 * ------------------------------------------------------------------ */
const STATIC_DISPLACEMENT_MAP =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="rx" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff8080"/><stop offset="50%" stop-color="#808080"/><stop offset="100%" stop-color="#ff8080"/>
        </linearGradient>
        <linearGradient id="by" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8080ff"/><stop offset="50%" stop-color="#808080"/><stop offset="100%" stop-color="#8080ff"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="30"/></filter>
        <mask id="edge">
          <rect width="512" height="512" fill="#000"/>
          <rect x="26" y="26" width="460" height="460" rx="120" fill="none" stroke="#fff" stroke-width="66" filter="url(#soft)"/>
        </mask>
      </defs>
      <rect width="512" height="512" fill="#808080"/>
      <rect width="512" height="512" fill="url(#rx)" mask="url(#edge)"/>
      <rect width="512" height="512" fill="url(#by)" mask="url(#edge)" style="mix-blend-mode:screen"/>
    </svg>`
  );

function getMap(mode: GlassMode, shaderUrl?: string) {
  return mode === "shader" && shaderUrl ? shaderUrl : STATIC_DISPLACEMENT_MAP;
}

/* ---------------- Filtre SVG : réfraction + aberration ---------------- */
interface GlassFilterProps {
  id: string;
  mode: GlassMode;
  displacementScale: number;
  aberrationIntensity: number;
  width: number;
  height: number;
  shaderUrl?: string;
}

function GlassFilter({ id, mode, displacementScale, aberrationIntensity, width, height, shaderUrl }: GlassFilterProps) {
  const map = getMap(mode, shaderUrl);
  return (
    <svg aria-hidden="true" width={width} height={height}
         style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0 }}>
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          {/* 1. carte de déplacement */}
          <feImage href={map} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="MAP" />

          {/* 2. masque de bord dérivé de la carte */}
          <feColorMatrix in="MAP" type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" result="EDGE_I" />
          <feComponentTransfer in="EDGE_I" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues={`0 ${Math.min(0.9, aberrationIntensity * 0.05)} 1`} />
          </feComponentTransfer>

          {/* 3. centre net (non réfracté) */}
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER" />

          {/* 4. réfraction 3 canaux = aberration chromatique */}
          <feDisplacementMap in="SourceGraphic" in2="MAP" scale={displacementScale}
                             xChannelSelector="R" yChannelSelector="B" result="RED_D" />
          <feColorMatrix in="RED_D" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_C" />

          <feDisplacementMap in="SourceGraphic" in2="MAP" scale={displacementScale - aberrationIntensity * 1.5}
                             xChannelSelector="R" yChannelSelector="B" result="GRN_D" />
          <feColorMatrix in="GRN_D" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GRN_C" />

          <feDisplacementMap in="SourceGraphic" in2="MAP" scale={displacementScale - aberrationIntensity * 3}
                             xChannelSelector="R" yChannelSelector="B" result="BLU_D" />
          <feColorMatrix in="BLU_D" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLU_C" />

          <feBlend in="GRN_C" in2="BLU_C" mode="screen" result="GB" />
          <feBlend in="RED_C" in2="GB" mode="screen" result="RGB" />
          <feGaussianBlur in="RGB" stdDeviation={Math.max(0.1, 0.5 - aberrationIntensity * 0.1)} result="AB" />

          {/* 5. aberration masquée sur les bords uniquement */}
          <feComposite in="AB" in2="EDGE_MASK" operator="in" result="EDGE_AB" />
          <feComponentTransfer in="EDGE_MASK" result="EDGE_INV">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>

          {/* 6. fusion bords réfractés + centre net */}
          <feComposite in="CENTER" in2="EDGE_INV" operator="in" result="CENTER_CLEAN" />
          <feComposite in="EDGE_AB" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

/* ---------------- Détection de capacité ---------------- */
export function glassCapabilities() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isFirefox = /firefox/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const supportsBackdrop =
    typeof CSS !== "undefined" &&
    (CSS.supports?.("backdrop-filter", "blur(1px)") || CSS.supports?.("-webkit-backdrop-filter", "blur(1px)"));
  // Le filtre SVG via backdrop n'est fiable que sur Chromium.
  return { supportsBackdrop: !!supportsBackdrop, canRefract: !isFirefox && !isSafari && !!supportsBackdrop };
}

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  mode?: GlassMode;
  /** Intensité de la réfraction. Cards : 18–32. Boutons/pastilles : 60–90. */
  displacementScale?: number;
  /** Flou du verre en px. */
  blurAmount?: number;
  /** Saturation du verre en %. */
  saturation?: number;
  /** Intensité de l'aberration chromatique. */
  aberrationIntensity?: number;
  /** Rayon : cards 24–40, pastilles 999. */
  cornerRadius?: number;
  /** Liseré spéculaire piloté par le pointeur. */
  interactive?: boolean;
  /** Verre posé sur fond clair (assombrit + ombre forte). */
  overLight?: boolean;
  variant?: string;
  shape?: string;
  tone?: string;
  elevated?: boolean;
  disabled?: boolean;
}

const LiquidGlass = forwardRef<HTMLElement, LiquidGlassProps>(function LiquidGlass(
  {
    as: Component = "div",
    children,
    className = "",
    style,
    mode = "shader",
    displacementScale = 26,
    blurAmount = 14,
    saturation = 170,
    aberrationIntensity = 2,
    cornerRadius = 28,
    interactive = true,
    overLight = false,
    onClick,
    onMouseMove,
    variant,
    shape,
    tone,
    elevated,
    disabled,
    ...rest
  },
  ref
) {
  const rawId = useId();
  const filterId = `lkv-glass-${rawId.replace(/[:]/g, "")}`;
  const hostRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [shaderUrl, setShaderUrl] = useState<string>("");
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const caps = glassCapabilities();

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      hostRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    },
    [ref]
  );

  /* Mesure de la surface */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  /* Génération de la carte de déplacement (mode shader) */
  useEffect(() => {
    if (mode !== "shader" || !caps.canRefract || size.width === 0) return;
    try {
      const gen = new ShaderDisplacementGenerator({
        width: size.width,
        height: size.height,
        fragment: fragmentShaders.liquidGlass,
      });
      setShaderUrl(gen.updateShader());
      gen.destroy();
    } catch {
      setShaderUrl(""); // repli sur STATIC_DISPLACEMENT_MAP
    }
  }, [mode, caps.canRefract, size.width, size.height]);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!interactive) return;
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setOffset({
        x: ((e.clientX - (r.left + r.width / 2)) / r.width) * 100,
        y: ((e.clientY - (r.top + r.height / 2)) / r.height) * 100,
      });
      if (onMouseMove) (onMouseMove as any)(e);
    },
    [interactive, onMouseMove]
  );

  const useRefraction = caps.canRefract && mode === "shader";
  const Comp = Component as any;

  return (
    <Comp
      ref={setRefs}
      className={`lkv-glass lkv-glass--premium ${className}`}
      data-glass-variant={variant}
      data-glass-shape={shape}
      data-glass-tone={tone}
      onMouseMove={handleMove}
      onClick={disabled ? undefined : onClick}
      style={{ position: "relative", cursor: onClick && !disabled ? "pointer" : undefined, ...style }}
      {...rest}
    >
      {useRefraction && size.width > 0 && (
        <GlassFilter
          id={filterId}
          mode={mode}
          displacementScale={overLight ? displacementScale * 0.6 : displacementScale}
          aberrationIntensity={aberrationIntensity}
          width={size.width}
          height={size.height}
          shaderUrl={shaderUrl}
        />
      )}

      {/* COUCHE 1 — optique du verre (flou + saturation + réfraction) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          borderRadius: cornerRadius,
          overflow: "hidden",
          backdropFilter: caps.supportsBackdrop ? `blur(${blurAmount}px) saturate(${saturation}%)` : undefined,
          WebkitBackdropFilter: caps.supportsBackdrop ? `blur(${blurAmount}px) saturate(${saturation}%)` : undefined,
          filter: useRefraction ? `url(#${filterId})` : undefined,
          background: overLight ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.08)",
          boxShadow: overLight
            ? "0 16px 60px rgba(11,31,23,0.35)"
            : "0 12px 40px rgba(11,31,23,0.22), 0 2px 8px rgba(11,31,23,0.14)",
        }}
      />

      {/* COUCHE 2 — liseré spéculaire (rim) + bordure bevel */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: cornerRadius,
          padding: "1.5px",
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: 0.85,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow:
            "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.28) inset, 0 -1px 3px rgba(11,31,23,0.12) inset",
          background: `linear-gradient(${135 + offset.x * 1.2}deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,${0.16 + Math.abs(offset.x) * 0.008}) ${Math.max(10, 33 + offset.y * 0.3)}%,
            rgba(255,255,255,${0.45 + Math.abs(offset.x) * 0.012}) ${Math.min(90, 66 + offset.y * 0.4)}%,
            rgba(255,255,255,0) 100%)`,
        }}
      />

      {/* COUCHE 3 — reflet supérieur au survol (boutons/pastilles) */}
      {interactive && onClick && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            borderRadius: cornerRadius,
            pointerEvents: "none",
            mixBlendMode: "overlay",
            opacity: 0.35,
            backgroundImage:
              "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)",
          }}
        />
      )}

      {/* CONTENU — toujours net, au-dessus des couches optiques */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </Comp>
  );
});

export default LiquidGlass;
export { LiquidGlass };
