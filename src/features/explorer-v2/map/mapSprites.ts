/**
 * Explorer v2 — Retina Canvas Map Sprites for Unified GeoJSON Overlays.
 *
 * Generates crisp 2x DPR glossy Apple-Maps–style circular map badges with
 * bespoke category pictograms (`bottle`, `carnet`, `club`, `story`, `friend`,
 * `pokedex`, `fire`, `flood`, `seismic`, `aircraft`) directly on an offscreen
 * `<canvas>` and registers them with MapLibre (`map.addImage`).
 *
 * Zero external sprite network fetches, 100% crisp on Retina/mobile screens,
 * and safely no-ops in headless/Node test environments.
 */

export type ExplorerSpriteKey =
  | 'xp-ico-bottle'
  | 'xp-ico-carnet'
  | 'xp-ico-club'
  | 'xp-ico-story'
  | 'xp-ico-friend'
  | 'xp-ico-pokedex'
  | 'xp-ico-fire'
  | 'xp-ico-flood'
  | 'xp-ico-seismic'
  | 'xp-ico-aircraft';

export interface SpriteHostMapLike {
  hasImage?(id: string): boolean;
  addImage?(
    id: string,
    image: ImageData | { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
    options?: { pixelRatio?: number },
  ): unknown;
}

interface SpriteSpec {
  id: ExplorerSpriteKey;
  bgTop: string;
  bgBottom: string;
  ring: string;
  drawGlyph: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
}

const SPRITE_SPECS: readonly SpriteSpec[] = [
  {
    id: 'xp-ico-bottle',
    bgTop: '#149085',
    bgBottom: '#0F766E',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Bottle / message-at-sea silhouette
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.24, cy - r * 0.56, r * 0.48, r * 0.22, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.38, cy - r * 0.28, r * 0.76, r * 0.84, r * 0.24);
      ctx.fill();
      // Subtle inner scroll wave
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.18, cy + r * 0.15);
      ctx.quadraticCurveTo(cx, cy, cx + r * 0.18, cy + r * 0.15);
      ctx.stroke();
    },
  },
  {
    id: 'xp-ico-carnet',
    bgTop: '#EA8C1E',
    bgBottom: '#C86A08',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Open travel journal / book
      ctx.lineWidth = Math.max(1.8, r * 0.16);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.32);
      ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.45, cx - r * 0.54, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.54, cy + r * 0.36);
      ctx.quadraticCurveTo(cx - r * 0.28, cy + r * 0.22, cx, cy + r * 0.38);
      ctx.quadraticCurveTo(cx + r * 0.28, cy + r * 0.22, cx + r * 0.54, cy + r * 0.36);
      ctx.lineTo(cx + r * 0.54, cy - r * 0.3);
      ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.45, cx, cy - r * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#C86A08';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.3);
      ctx.lineTo(cx, cy + r * 0.36);
      ctx.stroke();
    },
  },
  {
    id: 'xp-ico-club',
    bgTop: '#24583D',
    bgBottom: '#17402C',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Mountain club pennant / peaks
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.56, cy + r * 0.42);
      ctx.lineTo(cx - r * 0.14, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.16, cy + r * 0.08);
      ctx.lineTo(cx + r * 0.32, cy - r * 0.18);
      ctx.lineTo(cx + r * 0.58, cy + r * 0.42);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'xp-ico-story',
    bgTop: '#EC4899',
    bgBottom: '#BE185D',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Play triangle inside story ring
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.28, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.48, cy);
      ctx.lineTo(cx - r * 0.28, cy + r * 0.42);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'xp-ico-friend',
    bgTop: '#14B8A6',
    bgBottom: '#0F766E',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.24, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.52, r * 0.46, Math.PI * 1.12, Math.PI * 1.88);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'xp-ico-pokedex',
    bgTop: '#10B981',
    bgBottom: '#047857',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Botanical leaf glyph
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.44);
      ctx.quadraticCurveTo(cx - r * 0.52, cy - r * 0.42, cx + r * 0.46, cy - r * 0.46);
      ctx.quadraticCurveTo(cx + r * 0.42, cy + r * 0.52, cx - r * 0.42, cy + r * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.32, cy + r * 0.34);
      ctx.lineTo(cx + r * 0.26, cy - r * 0.24);
      ctx.stroke();
    },
  },
  {
    id: 'xp-ico-fire',
    bgTop: '#EF4444',
    bgBottom: '#B91C1C',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Flame glyph
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.54);
      ctx.bezierCurveTo(cx + r * 0.48, cy - r * 0.08, cx + r * 0.5, cy + r * 0.5, cx, cy + r * 0.52);
      ctx.bezierCurveTo(cx - r * 0.5, cy + r * 0.5, cx - r * 0.48, cy - r * 0.04, cx, cy - r * 0.54);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'xp-ico-flood',
    bgTop: '#0EA5E9',
    bgBottom: '#0369A1',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Water drop / flood glyph
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.52);
      ctx.bezierCurveTo(cx + r * 0.46, cy + r * 0.02, cx + r * 0.44, cy + r * 0.52, cx, cy + r * 0.52);
      ctx.bezierCurveTo(cx - r * 0.44, cy + r * 0.52, cx - r * 0.46, cy + r * 0.02, cx, cy - r * 0.52);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'xp-ico-seismic',
    bgTop: '#F59E0B',
    bgBottom: '#B45309',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Seismic pulse line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(2.2, r * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.58, cy + r * 0.04);
      ctx.lineTo(cx - r * 0.24, cy + r * 0.04);
      ctx.lineTo(cx - r * 0.06, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.14, cy + r * 0.42);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.04);
      ctx.lineTo(cx + r * 0.58, cy + r * 0.04);
      ctx.stroke();
    },
  },
  {
    id: 'xp-ico-aircraft',
    bgTop: '#6366F1',
    bgBottom: '#4338CA',
    ring: '#FFFFFF',
    drawGlyph: (ctx, cx, cy, r) => {
      // Upward aircraft silhouette
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.54);
      ctx.lineTo(cx + r * 0.12, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.56, cy + r * 0.16);
      ctx.lineTo(cx + r * 0.56, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.18);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.44);
      ctx.lineTo(cx + r * 0.24, cy + r * 0.54);
      ctx.lineTo(cx - r * 0.24, cy + r * 0.54);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.44);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.18);
      ctx.lineTo(cx - r * 0.56, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.56, cy + r * 0.16);
      ctx.lineTo(cx - r * 0.12, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
    },
  },
];

export const SOURCE_TO_SPRITE_KEY: Readonly<Record<string, ExplorerSpriteKey>> = Object.freeze({
  'xp-social-bottles': 'xp-ico-bottle',
  'xp-social-carnets': 'xp-ico-carnet',
  'xp-social-clubs': 'xp-ico-club',
  'xp-social-stories': 'xp-ico-story',
  'xp-social-friends': 'xp-ico-friend',
  'xp-pokedex-species': 'xp-ico-pokedex',
  'xp-hazard-fires': 'xp-ico-fire',
  'xp-hazard-floods': 'xp-ico-flood',
  'xp-hazard-seismic': 'xp-ico-seismic',
  'xp-airspace-aircraft': 'xp-ico-aircraft',
});

function renderBadgeImageData(spec: SpriteSpec, sizePx = 64): ImageData | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const radius = sizePx * 0.38;

  // Soft elevation shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 28, 22, 0.32)';
  ctx.shadowBlur = sizePx * 0.12;
  ctx.shadowOffsetY = sizePx * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  grad.addColorStop(0, spec.bgTop);
  grad.addColorStop(1, spec.bgBottom);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Glossy white outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(3, sizePx * 0.065);
  ctx.strokeStyle = spec.ring;
  ctx.stroke();

  // Subtle top specular highlight
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.16, radius * 0.72, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Crisp white pictogram
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  spec.drawGlyph(ctx, cx, cy, radius * 0.62);
  ctx.restore();

  return ctx.getImageData(0, 0, sizePx, sizePx);
}

/**
 * Registers all Explorer retina map sprites idempotently on a MapLibre instance.
 * Returns the number of newly registered sprites (0 in non-DOM test environments).
 */
export function registerExplorerMapSprites(map: SpriteHostMapLike): number {
  if (typeof map.addImage !== 'function' || typeof document === 'undefined') {
    return 0;
  }
  let added = 0;
  for (const spec of SPRITE_SPECS) {
    try {
      if (map.hasImage?.(spec.id)) continue;
      const imgData = renderBadgeImageData(spec, 64);
      if (!imgData) continue;
      map.addImage(spec.id, imgData, { pixelRatio: 2 });
      added += 1;
    } catch {
      /* canvas or map unavailable */
    }
  }
  return added;
}
