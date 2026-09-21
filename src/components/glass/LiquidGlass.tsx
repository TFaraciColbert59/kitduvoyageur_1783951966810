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
          <stop offset="0%" stop-color="var(--lkv-danger)"/><stop offset="50%" stop-color="var(--lkv-text-muted)"/><stop offset="100%" stop-color="var(--lkv-danger)"/>
        </linearGradient>
        <linearGradient id="by" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--lkv-info)"/><stop offset="50%" stop-color="var(--lkv-text-muted)"/><stop offset="100%" stop-color="var(--lkv-info)"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="30"/></filter>
        <mask id="edge">
          <rect width="512" height="512" fill="var(--lkv-forest-950)"/>
          <rect x="26" y="26" width="460" height="460" rx="120" fill="none" stroke="var(--lkv-text-inverted)" stroke-width="66" filter="url(#soft)"/>
        </mask>
      </defs>
      <rect width="512" height="512" fill="var(--lkv-text-muted)"/>
      <rect width="512" height="512" fill="url(#rx)" mask="url(#edge)"/>
      <rect width="512" height="512" fill="url(#by)" mask="url(#edge)" style="mix-blend-mode:screen"/>
    </svg>`
  );

function getMap(mode: GlassMode, shaderUrl?: string) {
  return mode === "shader" && shaderUrl ? shaderUrl : STATIC_DISPLACEMENT_MAP;
}

/* ---------------- Filtre SVG : réfraction + aberration ---------------- *
 * Pipeline porté verbatim de rdev/liquid-glass-react (MIT) :
 * feImage (carte de déplacement) → 3 passes feDisplacementMap décalées
 * (aberration chromatique) → masque de bord → centre net / bords réfractés.
 * Région du filtre : 170 % du bbox (xMidYMid slice) — valeurs de référence. */
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
    <svg
      aria-hidden="true"
      focusable="false"
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    >
      <defs>
        <filter id={id} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          {/* 1. carte de déplacement */}
          <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" href={map} result="DISPLACEMENT_MAP" />

          {/* 2. masque de bord dérivé de la carte */}
          <feColorMatrix in="DISPLACEMENT_MAP" type="matrix"
            values="0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0" result="EDGE_INTENSITY" />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues={`0 ${aberrationIntensity * 0.05} 1`} />
          </feComponentTransfer>

          {/* 3. centre net (non réfracté) */}
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

          {/* 4. réfraction 3 canaux = aberration chromatique */}
          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale}
                             xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED" />
          <feColorMatrix in="RED_DISPLACED" type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_CHANNEL" />

          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale * (1 - aberrationIntensity * 0.05)}
                             xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED" />
          <feColorMatrix in="GREEN_DISPLACED" type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GREEN_CHANNEL" />

          <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale * (1 - aberrationIntensity * 0.1)}
                             xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED" />
          <feColorMatrix in="BLUE_DISPLACED" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLUE_CHANNEL" />

          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
          <feGaussianBlur in="RGB_COMBINED" stdDeviation={Math.max(0.1, 0.5 - aberrationIntensity * 0.1)} result="ABERRATED_BLURRED" />

          {/* 5. aberration masquée sur les bords uniquement */}
          <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>

          {/* 6. fusion bords réfractés + centre net */}
          <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
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

/* ---------------- Budget global de réfraction ----------------
 * La réfraction complète (filtre SVG + carte de déplacement) est coûteuse.
 * Deux pools séparés : les surfaces (cards) et les contrôles (boutons/chips).
 * Au-delà du budget, les surfaces gardent le verre léger (blur + liseré). */
const REFRACTION_BUDGET = {
  surface: { mobile: 3, desktop: 3 },
  control: { mobile: 1, desktop: 3 },
  media: { mobile: 2, desktop: 4 },
};
const activeRefractionSlots = { surface: 0, control: 0, media: 0 };

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

function isWeakDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)
  );
}

function claimRefractionSlot(priority: "surface" | "control" | "media"): boolean {
  const budget = isMobileViewport() ? REFRACTION_BUDGET[priority].mobile : REFRACTION_BUDGET[priority].desktop;
  if (isWeakDevice() || activeRefractionSlots[priority] >= budget) return false;
  activeRefractionSlots[priority] += 1;
  return true;
}

function releaseRefractionSlot(priority: "surface" | "control" | "media"): void {
  activeRefractionSlots[priority] = Math.max(0, activeRefractionSlots[priority] - 1);
}

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>["type"];
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  mode?: GlassMode;
  /** Intensité de la réfraction. Cards : 18–34. Boutons/pastilles : 50–90. */
  displacementScale?: number;
  /** Flou du verre en px. Cards : 12. Pills : 6. */
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
  /** Teinte du verre (rgba) — défaut : 0.30 (toile image), overLight : 0.42. */
  glassTint?: string;
  /** Ombre portée du verre (défaut : ombre de référence). */
  shadow?: string;
  /** Élasticité directionnelle au pointeur (0 = désactivée). */
  elasticity?: number;
  /** Pool du budget de réfraction : surfaces (cards), contrôles (boutons/chips) ou médias (pastilles sur photo). */
  priority?: "surface" | "control" | "media";
  variant?: string;
  shape?: string;
  tone?: string;
  elevated?: boolean;
  disabled?: boolean;
}

/* ---------------- Élasticité directionnelle (port rdev) ---------------- */
const ACTIVATION_ZONE = 200;

function computeElasticTransform(
  global: { x: number; y: number } | null,
  rect: { left: number; top: number; width: number; height: number } | null,
  elasticity: number,
  active: boolean
): { transform: string; enabled: boolean } {
  if (active) return { transform: "scale(0.96)", enabled: true };
  if (!global || !rect) return { transform: "none", enabled: false };
  const deltaX = global.x - (rect.left + rect.width / 2);
  const deltaY = global.y - (rect.top + rect.height / 2);
  const edgeDistanceX = Math.max(0, Math.abs(deltaX) - rect.width / 2);
  const edgeDistanceY = Math.max(0, Math.abs(deltaY) - rect.height / 2);
  const edgeDistance = Math.sqrt(edgeDistanceX * edgeDistanceX + edgeDistanceY * edgeDistanceY);
  if (edgeDistance > ACTIVATION_ZONE) return { transform: "none", enabled: false };
  const fade = 1 - edgeDistance / ACTIVATION_ZONE;
  const centerDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (centerDistance === 0) return { transform: "none", enabled: false };
  const normalizedX = deltaX / centerDistance;
  const normalizedY = deltaY / centerDistance;
  const intensity = Math.min(centerDistance / 300, 1) * elasticity * fade;
  const scaleX = Math.max(0.8, 1 + Math.abs(normalizedX) * intensity * 0.3 - Math.abs(normalizedY) * intensity * 0.15);
  const scaleY = Math.max(0.8, 1 + Math.abs(normalizedY) * intensity * 0.3 - Math.abs(normalizedX) * intensity * 0.15);
  const tx = deltaX * elasticity * 0.1 * fade;
  const ty = deltaY * elasticity * 0.1 * fade;
  return { transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`, enabled: true };
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
    glassTint,
    shadow,
    elasticity = 0.15,
    priority = "surface",
    onClick,
    onMouseMove,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
    variant,
    shape,
    tone,
    elevated: _elevated,
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
  const [globalMouse, setGlobalMouse] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [motionSafe, setMotionSafe] = useState(false);
  const [opticsReduced, setOpticsReduced] = useState(false);
  const [refractionSlot, setRefractionSlot] = useState(false);
  const [mounted, setMounted] = useState(false);
  const caps = glassCapabilities();

  const elastic = interactive && Boolean(onClick);

  /* Montage client — les couches optiques dépendent des capacités navigateur :
   * on ne les rend qu'après hydratation pour éviter tout écart SSR/client. */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Préférences de mouvement & optiques — SSR-safe */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerFine = window.matchMedia("(pointer: fine)");
    const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const moreContrast = window.matchMedia("(prefers-contrast: more)");
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const readEffects = () => document.documentElement.dataset.glassEffects === "reduced";
    const update = () => {
      setMotionSafe(!reduced.matches && pointerFine.matches && !readEffects());
      setOpticsReduced(reducedTransparency.matches || moreContrast.matches || forcedColors.matches || readEffects());
    };
    update();
    reduced.addEventListener("change", update);
    pointerFine.addEventListener("change", update);
    reducedTransparency.addEventListener("change", update);
    moreContrast.addEventListener("change", update);
    forcedColors.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-glass-effects"] });
    return () => {
      reduced.removeEventListener("change", update);
      pointerFine.removeEventListener("change", update);
      reducedTransparency.removeEventListener("change", update);
      moreContrast.removeEventListener("change", update);
      forcedColors.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      hostRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    },
    [ref]
  );

  /* Mesure de la surface (nécessaire uniquement pour la carte de déplacement) */
  useEffect(() => {
    if (mode !== "shader" || !caps.canRefract) return;
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
  }, [mode, caps.canRefract]);

  /* Attribution d'un slot de réfraction (budget global par pool) */
  useEffect(() => {
    if (mode !== "shader" || !caps.canRefract) return;
    const got = claimRefractionSlot(priority);
    if (!got) return;
    setRefractionSlot(true);
    return () => releaseRefractionSlot(priority);
  }, [mode, caps.canRefract, priority]);

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

  /* Suivi global du pointeur pour l'élasticité (uniquement au survol) */
  useEffect(() => {
    if (!elastic || !motionSafe || !hovered) return;
    const handle = (e: MouseEvent) => setGlobalMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handle, { passive: true });
    return () => window.removeEventListener("mousemove", handle);
  }, [elastic, motionSafe, hovered]);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setOffset({
        x: ((e.clientX - (r.left + r.width / 2)) / r.width) * 100,
        y: ((e.clientY - (r.top + r.height / 2)) / r.height) * 100,
      });
      setGlobalMouse({ x: e.clientX, y: e.clientY });
      if (onMouseMove) (onMouseMove as any)(e);
    },
    [onMouseMove]
  );

  const useRefraction = refractionSlot && caps.canRefract && mode === "shader" && !opticsReduced;
  const Comp = Component as any;

  const rect =
    motionSafe && elastic && hovered && hostRef.current
      ? (() => {
          const r = hostRef.current.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        })()
      : null;
  const { transform, enabled: elasticActive } =
    motionSafe && elastic
      ? computeElasticTransform(globalMouse, rect, elasticity, pressed)
      : { transform: "none", enabled: false };

  const rimGradient = `linear-gradient(${135 + offset.x * 1.2}deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,${0.16 + Math.abs(offset.x) * 0.008}) ${Math.max(10, 33 + offset.y * 0.3)}%,
    rgba(255,255,255,${0.45 + Math.abs(offset.x) * 0.012}) ${Math.min(90, 66 + offset.y * 0.4)}%,
    rgba(255,255,255,0) 100%)`;

  return (
    <Comp
      ref={setRefs}
      className={`lkv-glass--premium ${className}`}
      data-glass-variant={variant}
      data-glass-shape={shape}
      data-glass-tone={tone}
      onMouseMove={handleMove}
      onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
        setHovered(true);
        if (onMouseEnter) (onMouseEnter as any)(e);
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
        setHovered(false);
        setGlobalMouse(null);
        setOffset({ x: 0, y: 0 });
        if (onMouseLeave) (onMouseLeave as any)(e);
      }}
      onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
        setPressed(true);
        if (onMouseDown) (onMouseDown as any)(e);
      }}
      onMouseUp={(e: React.MouseEvent<HTMLElement>) => {
        setPressed(false);
        if (onMouseUp) (onMouseUp as any)(e);
      }}
      disabled={typeof Component === "string" && ["button", "input", "select", "textarea", "fieldset", "optgroup", "option"].includes(Component) ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        cursor: onClick && !disabled ? "pointer" : undefined,
        transform: elasticActive ? transform : undefined,
        transition: elasticActive && motionSafe ? "transform var(--motion-control-duration) var(--motion-ease-decelerate)" : undefined,
        willChange: elasticActive ? "transform" : undefined,
        borderRadius: cornerRadius,
        ...style,
      }}
      {...rest}
    >
      {mounted && useRefraction && size.width > 0 && (
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

      {/* Clip the filtered backdrop before applying tint: filtering translucent tint
          recombines partial RGB alpha into gray, and filters paint beyond their own radius. */}
      {mounted && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            borderRadius: cornerRadius,
            overflow: "hidden",
            pointerEvents: "none",
            boxShadow: shadow
              ? shadow
              : overLight
              ? "0 16px 60px rgba(11,31,23,0.35)"
              : "var(--card-shadow, 0 4px 14px rgba(11,31,23,0.16), 0 1px 3px rgba(11,31,23,0.1))",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: caps.supportsBackdrop && !opticsReduced ? `blur(${blurAmount}px) saturate(${saturation}%)` : undefined,
              WebkitBackdropFilter: caps.supportsBackdrop && !opticsReduced ? `blur(${blurAmount}px) saturate(${saturation}%)` : undefined,
              filter: useRefraction ? `url(#${filterId})` : undefined,
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: opticsReduced
                ? "var(--glass-solid, rgba(238,243,236,1))"
                : glassTint ?? (overLight ? "var(--card-tint-strong, rgba(255,255,255,0.42))" : "var(--card-tint, rgba(255,255,255,0.2))"),
            }}
          />
        </span>
      )}

      {/* COUCHE 2 — liseré spéculaire (rim) + bordure bevel */}
      {mounted && (
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
            WebkitMask: "linear-gradient(var(--lkv-forest-950) 0 0) content-box, linear-gradient(var(--lkv-forest-950) 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.28) inset, 0 -1px 3px rgba(11,31,23,0.12) inset",
            background: rimGradient,
          }}
        />
      )}

      {/* COUCHE 2b — liseré en surimpression (surfaces interactives uniquement) */}
      {mounted && elastic && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            borderRadius: cornerRadius,
            padding: "1.5px",
            pointerEvents: "none",
            mixBlendMode: "overlay",
            opacity: 0.6,
            WebkitMask: "linear-gradient(var(--lkv-forest-950) 0 0) content-box, linear-gradient(var(--lkv-forest-950) 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.55) inset, 0 1px 3px rgba(255,255,255,0.3) inset, 0 1px 4px rgba(11,31,23,0.18) inset",
            background: rimGradient,
          }}
        />
      )}

      {/* COUCHE 3 — reflet supérieur au survol (boutons/pastilles) */}
      {mounted && elastic && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            borderRadius: cornerRadius,
            pointerEvents: "none",
            mixBlendMode: "overlay",
            opacity: hovered ? 0.4 : pressed ? 0.8 : 0,
            transition: motionSafe ? "opacity 0.2s ease-out" : undefined,
            backgroundImage:
              "radial-gradient(circle at 50% 0%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
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
