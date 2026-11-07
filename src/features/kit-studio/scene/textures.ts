// Textures du décor et du sac (maquette l.918-975) : panorama, bois de la table, tissus.
// Le panorama, le bois et les tissus techniques (mesh, rembourrage, sangle, chiné) restent dessinés
// par code ; toutes leurs couleurs viennent de domain/palette.scene.ts.
// Les quatre matières que la personne choisit (ripstop, cordura, X-Pac, toile cirée) sont, elles,
// des relevés de tissu réels (lot D) : une carte de détail neutre et une carte de relief, dans
// public/assets/materials. Elles se posent sur la texture procédurale une fois chargées, qui reste
// donc le repli hors ligne. La couleur vient toujours du token, jamais de l'image.
import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import {
  CLOUD_CORE, CLOUD_EDGE, FIR_DARK, FIR_LIGHT, FLOWER_PINK, FLOWER_WHITE, FLOWER_YELLOW, GRASS_DARK, GRASS_LIGHT,
  HAZE_FAR_STOPS, HAZE_MID_STOPS, MEADOW_STOPS, RIDGE_FAR, RIDGE_MID, RIDGE_NEAR, SKY_STOPS, SNOW, SUN_STOPS,
  TEX_BASE, WOOD_JOINT, WOOD_PLANK_COUNT, inkA, whiteA, woodPlank, woodVein,
} from '../domain/palette.scene';
import type { ResourceTracker } from './resources';

export type FabricKind = 'ripstop' | 'cordura' | 'dcf' | 'xpac' | 'waxed' | 'mesh' | 'pad' | 'web' | 'heather';
const FABRIC_KINDS: readonly FabricKind[] = ['ripstop', 'cordura', 'dcf', 'xpac', 'waxed', 'mesh', 'pad', 'web', 'heather'];
export const isFabricKind = (s: string): s is FabricKind => (FABRIC_KINDS as readonly string[]).includes(s);

export interface TextureBank {
  /** Texture de tissu (créée à la première demande, partagée ensuite). Nom inconnu : ripstop. */
  fabric(name: string): Texture;
  /** Carte de relief du tissu, pour les matières relevées sur du tissu réel. `null` pour les autres. */
  fabricNormal(name: string): Texture | null;
  panorama(): Texture;
  wood(): Texture;
  /** Libère toutes les textures créées par la banque. */
  dispose(): void;
}

/** Les quatre matières dont on a un relevé photographique dans public/assets/materials. */
const PHOTO_FABRICS: ReadonlySet<FabricKind> = new Set<FabricKind>(['ripstop', 'cordura', 'xpac', 'waxed']);
const MATERIALS_URL = '/assets/materials';

/**
 * Répétition des relevés photographiques. Chaque image couvre 100 mm de tissu réel ; le corps du sac
 * fait 0,78 unité de scène pour ~0,34 m : la tuile se répète donc ~3,5 fois sur une face.
 * Les textures dessinées par code gardent leur propre valeur, calée sur leur motif.
 */
const PHOTO_FABRIC_REPEAT = 3.5;

/** Encodage du vecteur (0, 0, 1) : surface plane. Ce n'est pas une couleur de charte. */
const FLAT_NORMAL = 'rgb(128, 128, 255)';

/**
 * Pose une image sur une texture déjà créée, sans la remplacer : le dessin procédural reste à l'écran
 * tant que l'image n'est pas arrivée, et le reste définitivement si elle n'arrive jamais (hors ligne,
 * asset absent). Rien n'est tenté hors navigateur (tests, rendu serveur).
 */
function loadImageInto(texture: Texture, url: string): void {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
  const img = new window.Image();
  img.decoding = 'async';
  img.onload = () => {
    texture.image = img;
    texture.needsUpdate = true;
  };
  img.onerror = () => {
    /* Repli : on garde la texture dessinée par code. */
  };
  img.src = url;
}

type Stops = readonly (readonly [number, string])[];

function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  return { canvas, ctx };
}

function gradient(g: CanvasGradient, stops: Stops): CanvasGradient {
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

type Harmonic = readonly [number, number, number];

function drawPanorama(x: CanvasRenderingContext2D, W: number, H: number): void {
  const hY = Math.round(H * 0.69);
  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const per = (u: number, k: readonly Harmonic[]): number => k.reduce((a, [f, amp, ph]) => a + amp * Math.sin(u * Math.PI * 2 * f + ph), 0);

  x.fillStyle = gradient(x.createLinearGradient(0, 0, 0, hY), SKY_STOPS);
  x.fillRect(0, 0, W, hY + 2);
  const sx = W * 0.86;
  const sy = H * 0.16;
  x.fillStyle = gradient(x.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55), SUN_STOPS);
  x.fillRect(0, 0, W, hY);

  for (let i = 0; i < 14; i++) {
    const cx = rnd() * W;
    const cy = H * (0.1 + rnd() * 0.28);
    const w = 120 + rnd() * 260;
    for (let j = 0; j < 7; j++) {
      const ox = (rnd() - 0.5) * w;
      const oy = (rnd() - 0.5) * w * 0.18;
      const r = w * (0.12 + rnd() * 0.16);
      for (const d of [-W, 0, W]) {
        x.fillStyle = gradient(x.createRadialGradient(cx + ox + d, cy + oy, 0, cx + ox + d, cy + oy, r), [[0, CLOUD_CORE], [1, CLOUD_EDGE]]);
        x.fillRect(cx + ox + d - r, cy + oy - r, 2 * r, 2 * r);
      }
    }
  }

  const ridge = (base: number, amp: number, k: readonly Harmonic[], fill: string, snow: number): void => {
    const norm = k.reduce((a, q) => a + q[1], 0);
    x.beginPath();
    x.moveTo(0, H);
    const pts: number[] = [];
    for (let i = 0; i <= W; i += 4) {
      const y = base - amp * (0.5 + (0.5 * per(i / W, k)) / norm);
      pts.push(y);
      x.lineTo(i, y);
    }
    x.lineTo(W, H);
    x.closePath();
    x.fillStyle = fill;
    x.fill();
    if (snow) {
      x.save();
      x.clip();
      x.fillStyle = SNOW;
      for (let i = 0; i <= W; i += 4) {
        const y = pts[i / 4];
        if (y < base - amp * snow) x.fillRect(i, y, 4, (base - amp * snow - y) * 0.9 + 6);
      }
      x.restore();
    }
  };

  ridge(hY - 60, 300, [[2, 1, 0.4], [5, 0.55, 1.3], [11, 0.25, 2.1], [23, 0.12, 0.7]], RIDGE_FAR, 0.78);
  x.fillStyle = gradient(x.createLinearGradient(0, hY - 220, 0, hY), HAZE_FAR_STOPS);
  x.fillRect(0, hY - 220, W, 220);
  ridge(hY - 10, 190, [[3, 1, 2.2], [7, 0.5, 0.3], [17, 0.2, 1.7]], RIDGE_MID, 0.86);
  x.fillStyle = gradient(x.createLinearGradient(0, hY - 140, 0, hY), HAZE_MID_STOPS);
  x.fillRect(0, hY - 140, W, 140);
  ridge(hY + 14, 90, [[4, 1, 0.9], [9, 0.4, 2.6], [19, 0.2, 0.2]], RIDGE_NEAR, 0);

  for (let i = 0; i < 420; i++) {
    const tx = rnd() * W;
    const band = rnd();
    const ty = hY - 6 + band * 26;
    const th = 14 + rnd() * 22 * (1 - band * 0.4);
    x.fillStyle = band < 0.5 ? FIR_DARK : FIR_LIGHT;
    for (const d of [-W, 0, W]) {
      x.beginPath();
      x.moveTo(tx + d, ty - th);
      x.lineTo(tx + d + th * 0.32, ty);
      x.lineTo(tx + d - th * 0.32, ty);
      x.closePath();
      x.fill();
    }
  }

  x.fillStyle = gradient(x.createLinearGradient(0, hY + 8, 0, H), MEADOW_STOPS);
  x.fillRect(0, hY + 12, W, H - hY);
  for (let i = 0; i < 5000; i++) {
    const fx = rnd() * W;
    const fy = hY + 14 + Math.pow(rnd(), 0.7) * (H - hY - 14);
    const q = rnd();
    x.fillStyle = q < 0.06 ? FLOWER_WHITE : q < 0.1 ? FLOWER_YELLOW : q < 0.12 ? FLOWER_PINK : q < 0.6 ? GRASS_DARK : GRASS_LIGHT;
    const r = q < 0.12 ? 1.6 : 1.2;
    x.fillRect(fx, fy, r, r * (q < 0.12 ? 1 : 3));
  }
}

function drawWood(x: CanvasRenderingContext2D): void {
  const planks = WOOD_PLANK_COUNT;
  const ph = 256 / planks;
  for (let p = 0; p < planks; p++) {
    x.fillStyle = woodPlank(p);
    x.fillRect(0, p * ph, 512, ph);
    for (let i = 0; i < 46; i++) {
      const y = p * ph + Math.random() * ph;
      x.strokeStyle = woodVein(Math.random() >= 0.5, 0.08 + Math.random() * 0.14);
      x.lineWidth = 0.6 + Math.random() * 1.4;
      x.beginPath();
      x.moveTo(0, y);
      for (let q = 0; q <= 512; q += 32) x.lineTo(q, y + Math.sin(q / 60 + i) * 2.2);
      x.stroke();
    }
    x.fillStyle = WOOD_JOINT;
    x.fillRect(0, p * ph, 512, 1.5);
  }
}

function grain(x: CanvasRenderingContext2D, a: number): void {
  const d = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * a;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  x.putImageData(d, 0, 0);
}

function gridLines(x: CanvasRenderingContext2D, step: number, alpha: number): void {
  x.strokeStyle = inkA(alpha);
  x.lineWidth = 1;
  for (let i = 0; i <= 128; i += step) {
    x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 128); x.stroke();
    x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(128, i + 0.5); x.stroke();
  }
}

type Painter = (x: CanvasRenderingContext2D) => void;
const FABRIC: Readonly<Record<FabricKind, { readonly repeat: number; readonly draw: Painter }>> = {
  ripstop: { repeat: 6, draw: (x) => { gridLines(x, 16, 0.045); grain(x, 10); } },
  cordura: {
    repeat: 10,
    draw: (x) => {
      for (let y = 0; y < 128; y += 4) for (let q = 0; q < 128; q += 4) { x.fillStyle = inkA(((q + y) / 4) % 2 ? 0.075 : 0.02); x.fillRect(q, y, 4, 4); }
      grain(x, 18);
    },
  },
  dcf: {
    repeat: 2.5,
    draw: (x) => {
      x.strokeStyle = inkA(0.075);
      for (let i = 0; i < 70; i++) {
        let px = Math.random() * 128;
        let py = Math.random() * 128;
        x.beginPath(); x.moveTo(px, py);
        for (let j = 0; j < 4; j++) { px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); }
        x.stroke();
      }
      gridLines(x, 32, 0.05); grain(x, 6);
    },
  },
  xpac: {
    repeat: 5,
    draw: (x) => {
      x.strokeStyle = inkA(0.08);
      for (let i = -128; i <= 256; i += 16) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke();
        x.beginPath(); x.moveTo(i, 128); x.lineTo(i + 128, 0); x.stroke();
      }
      grain(x, 8);
    },
  },
  waxed: {
    repeat: 2.5,
    draw: (x) => {
      for (let i = 0; i < 70; i++) { x.fillStyle = inkA(Math.random() * 0.05); x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 16, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = inkA(0.025);
      for (let y = 0; y <= 128; y += 3) { x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(128, y + 0.5); x.stroke(); }
      grain(x, 22);
    },
  },
  mesh: {
    repeat: 10,
    draw: (x) => {
      x.fillStyle = inkA(0.3);
      for (let y = 2; y < 128; y += 8) for (let q = ((y - 2) / 8 % 2) * 4 + 2; q < 128; q += 8) { x.beginPath(); x.arc(q, y, 2.4, 0, Math.PI * 2); x.fill(); }
    },
  },
  pad: {
    repeat: 8,
    draw: (x) => {
      x.fillStyle = inkA(0.1);
      for (let y = 4; y < 128; y += 8) for (let q = ((y - 4) / 8 % 2) * 4 + 4; q < 128; q += 8) { x.beginPath(); x.arc(q, y, 1.6, 0, Math.PI * 2); x.fill(); }
      grain(x, 8);
    },
  },
  web: {
    repeat: 12,
    draw: (x) => {
      x.strokeStyle = inkA(0.09);
      for (let y = 0; y <= 128; y += 3) { x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(128, y + 0.5); x.stroke(); }
      grain(x, 6);
    },
  },
  heather: {
    repeat: 6,
    draw: (x) => {
      grain(x, 46);
      x.strokeStyle = whiteA(0.25);
      for (let i = 0; i < 160; i++) { const px = Math.random() * 128; const py = Math.random() * 128; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6, py + (Math.random() - 0.5) * 2); x.stroke(); }
    },
  },
};

export function createTextureBank(tr: ResourceTracker, maxAnisotropy: number): TextureBank {
  const fabrics = new Map<FabricKind, Texture>();
  const normals = new Map<FabricKind, Texture>();
  let pano: Texture | null = null;
  let wood: Texture | null = null;

  const fabric = (name: string): Texture => {
    const kind: FabricKind = isFabricKind(name) ? name : 'ripstop';
    const hit = fabrics.get(kind);
    if (hit) return hit;
    const spec = FABRIC[kind];
    const photo = PHOTO_FABRICS.has(kind);
    const { canvas, ctx } = newCanvas(128, 128);
    if (ctx) { ctx.fillStyle = TEX_BASE; ctx.fillRect(0, 0, 128, 128); spec.draw(ctx); }
    const t = tr.texture(new CanvasTexture(canvas));
    t.wrapS = t.wrapT = RepeatWrapping;
    const repeat = photo ? PHOTO_FABRIC_REPEAT : spec.repeat;
    t.repeat.set(repeat, repeat);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAnisotropy);
    if (photo) loadImageInto(t, `${MATERIALS_URL}/${kind}-albedo.png`);
    fabrics.set(kind, t);
    return t;
  };

  const fabricNormal = (name: string): Texture | null => {
    const kind: FabricKind = isFabricKind(name) ? name : 'ripstop';
    if (!PHOTO_FABRICS.has(kind)) return null;
    const hit = normals.get(kind);
    if (hit) return hit;
    // Base plane : tant que l'image n'est pas là, le tissu s'éclaire comme aujourd'hui.
    const { canvas, ctx } = newCanvas(4, 4);
    if (ctx) { ctx.fillStyle = FLAT_NORMAL; ctx.fillRect(0, 0, 4, 4); }
    const t = tr.texture(new CanvasTexture(canvas));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(PHOTO_FABRIC_REPEAT, PHOTO_FABRIC_REPEAT);
    // Pas de conversion sRGB : une carte de relief porte des vecteurs, pas des couleurs.
    t.anisotropy = Math.min(8, maxAnisotropy);
    loadImageInto(t, `${MATERIALS_URL}/${kind}-normal.png`);
    normals.set(kind, t);
    return t;
  };

  const panorama = (): Texture => {
    if (pano) return pano;
    const W = 2048;
    const H = 768;
    const { canvas, ctx } = newCanvas(W, H);
    let source = canvas;
    if (ctx) {
      drawPanorama(ctx, W, H);
      // Léger flou (absent de certains Safari : on garde alors l'image nette).
      const soft = newCanvas(W, H);
      if (soft.ctx) {
        soft.ctx.filter = 'blur(1.4px)';
        soft.ctx.drawImage(canvas, 0, 0);
        if (soft.ctx.filter === 'blur(1.4px)') source = soft.canvas;
      }
    }
    const t = tr.texture(new CanvasTexture(source));
    t.colorSpace = SRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.wrapT = ClampToEdgeWrapping;
    t.anisotropy = 4;
    pano = t;
    return t;
  };

  const woodTex = (): Texture => {
    if (wood) return wood;
    const { canvas, ctx } = newCanvas(512, 256);
    if (ctx) drawWood(ctx);
    const t = tr.texture(new CanvasTexture(canvas));
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1.6, 1.6);
    t.anisotropy = Math.min(8, maxAnisotropy);
    wood = t;
    return t;
  };

  return {
    fabric,
    fabricNormal,
    panorama,
    wood: woodTex,
    dispose() {
      for (const t of fabrics.values()) t.dispose();
      fabrics.clear();
      for (const t of normals.values()) t.dispose();
      normals.clear();
      pano?.dispose();
      wood?.dispose();
      pano = null;
      wood = null;
    },
  };
}
