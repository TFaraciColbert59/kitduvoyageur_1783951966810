// Textures du décor et du sac : mur neutre, bois de l’établi, tissus.
// Le mur, le bois et les tissus techniques (mesh, rembourrage, sangle, chiné) restent dessinés
// par code ; toutes leurs couleurs viennent de domain/palette.scene.ts.
// Les quatre matières que la personne choisit (ripstop, cordura, X-Pac, toile cirée) sont, elles,
// des relevés de tissu réels (lot D) : une carte de détail neutre et une carte de relief, dans
// public/assets/materials. Elles se posent sur la texture procédurale une fois chargées, qui reste
// donc le repli hors ligne. La couleur vient toujours du token, jamais de l'image.
import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import {
  WALL_STOPS, TEX_BASE, inkA, whiteA, woodPlank,
} from '../domain/palette.scene';
import type { ResourceTracker } from './resources';

/**
 * Pas physique de la trame : une image couvre 100 mm de tissu réel. Avec des UV exprimées en
 * mètres (§2 de la spec matières), la répétition correcte est donc exactement 10, sans réglage
 * à l'œil. Une seule source pour la scène ET la couche GLB.
 */
export const FABRIC_TILE_M = 0.1;
export const FABRIC_REPEAT = 1 / FABRIC_TILE_M;

export type FabricKind = 'ripstop' | 'cordura' | 'dcf' | 'xpac' | 'waxed' | 'brushed-pet' | 'mesh' | 'pad' | 'web' | 'heather';
const FABRIC_KINDS: readonly FabricKind[] = ['ripstop', 'cordura', 'dcf', 'xpac', 'waxed', 'brushed-pet', 'mesh', 'pad', 'web', 'heather'];
export const isFabricKind = (s: string): s is FabricKind => (FABRIC_KINDS as readonly string[]).includes(s);

/**
 * Cartes de détail d'une matière, pour les sacs chargés depuis un GLB.
 * L'albédo est NEUTRE et clair (moyenne 235/255) : la couleur vient du token, par
 * multiplication `mat.color × mat.map` — jamais de coloris cuit dans l'image.
 */
export interface FabricMaps {
  /** Carte de détail neutre, à multiplier par la couleur du token. */
  readonly albedo: Texture;
  /** Carte de relief en espace tangent OpenGL, ou `null` si le tissu n'a pas de relevé. */
  readonly normal: Texture | null;
}

/** Ce que `applyPartCustomization` attend du banc : les cartes de détail d'un preset. */
export interface FabricDetailProvider {
  /** Cartes du preset, ou `null` si ce preset n'a pas de relevé photographique. */
  forPreset(presetId: string | undefined): FabricMaps | null;
}

export interface TextureBank extends FabricDetailProvider {
  /** Texture de tissu (créée à la première demande, partagée ensuite). Nom inconnu : ripstop. */
  fabric(name: string): Texture;
  /** Carte de relief du tissu, pour les matières relevées sur du tissu réel. `null` pour les autres. */
  fabricNormal(name: string): Texture | null;
  panorama(): Texture;
  wood(): Texture;
  /** Libère toutes les textures créées par la banque. */
  dispose(): void;
}

/**
 * Relevé de tissu utilisé par chaque preset de matière de la couche GLB
 * (`bag/materials.ts` BAG_MATERIAL_PRESETS).
 * `ballistic-nylon` partage la trame du Cordura : ce sont deux armures toile de nylon
 * lourdes, que seule la densité sépare — et la densité est déjà portée par la rugosité du
 * preset. Mieux vaut la bonne armure partagée qu'une trame inventée.
 */
const FABRIC_BY_PRESET: Readonly<Record<string, string>> = {
  'cordura-matte': 'cordura',
  'ballistic-nylon': 'cordura',
  'ripstop-ultralight': 'ripstop',
  'waxed-canvas': 'waxed',
  'recycled-pet': 'brushed-pet',
};

/** Presets qui disposent d'un relevé de tissu. Exporté pour les tests et l'inventaire. */
export const PRESETS_WITH_FABRIC_MAPS: readonly string[] = Object.keys(FABRIC_BY_PRESET);

/** Les quatre matières dont on a un relevé photographique dans public/assets/materials. */
const PHOTO_FABRICS: ReadonlySet<FabricKind> = new Set<FabricKind>(['ripstop', 'cordura', 'xpac', 'waxed', 'brushed-pet']);
const MATERIALS_URL = '/assets/materials';

/**
 * Répétition des relevés photographiques, au pas physique : chaque image couvre 100 mm de tissu
 * réel, donc la tuile se répète 10 fois par mètre. Valable parce que les pièces de tissu nu du sac
 * reçoivent des UV en mètres (`uvMeters`, appelé depuis `bagBuilder.add()`).
 *
 * Les textures dessinées par code gardent leur propre valeur, calée sur leur motif et sur des UV
 * normalisées 0..1.
 */
const PHOTO_FABRIC_REPEAT = FABRIC_REPEAT;

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

/** Mur sans motif ni horizon ; conserve l'API du banc pour les consommateurs existants. */
function drawPanorama(x: CanvasRenderingContext2D, W: number, H: number): void {
  x.fillStyle = gradient(x.createLinearGradient(0, 0, 0, H), WALL_STOPS);
  x.fillRect(0, 0, W, H);
}

function drawWood(x: CanvasRenderingContext2D): void {
  x.fillStyle = woodPlank(2);
  x.fillRect(0, 0, 512, 256);
  // Fil fin déterministe : pas de larges lames rayées, ni de scintillement à la reconstruction.
  for (let i = 0; i < 100; i++) {
    const y = i * 2.6;
    x.strokeStyle = i % 3 ? inkA(0.025) : whiteA(0.10);
    x.lineWidth = 0.4;
    x.beginPath();
    for (let q = 0; q <= 512; q += 8) {
      const v = y + Math.sin(q / 85 + i * 1.7) * 0.7;
      if (q === 0) x.moveTo(q, v); else x.lineTo(q, v);
    }
    x.stroke();
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
  'brushed-pet': {
    repeat: 8,
    draw: (x) => {
      // Repli dessiné du polyester recyclé brossé : grain fin sans direction. L'image réelle
      // « brushed-pet » du lot D se pose par-dessus dès qu'elle est chargée.
      grain(x, 30);
      x.strokeStyle = whiteA(0.16);
      for (let i = 0; i < 120; i++) {
        const px = Math.random() * 128;
        const py = Math.random() * 128;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + 4, py + (Math.random() - 0.5) * 3);
        x.stroke();
      }
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
    /**
     * Cartes de détail d'un preset de matière. Fusion de l'ancien `bag/fabricMaps.ts` :
     * un seul banc de textures pour la scène survivante. Les textures sont celles de
     * `fabric()` / `fabricNormal()`, donc suivies par le `ResourceTracker` et libérées avec lui.
     */
    forPreset(presetId) {
      if (!presetId) return null;
      const fabricName = FABRIC_BY_PRESET[presetId];
      if (!fabricName) return null;
      return { albedo: fabric(fabricName), normal: fabricNormal(fabricName) };
    },
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
