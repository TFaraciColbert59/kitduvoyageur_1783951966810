// Sac LKDV ONE procédural (maquette Kit_Studio_v2.html, l.985-1067) : pièces paramétriques construites depuis
// la configuration courante (currentConfig(state)). Aucun modèle importé. Les couleurs viennent de RAW_MATERIALS
// (coloris du catalogue) et de palette.scene.ts (teintes de rôle).
import {
  BoxGeometry, BufferAttribute, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, Vector3,
} from 'three';
import type { BufferGeometry, Texture } from 'three';
import { BAGS, FINISHES, MATERIALS } from '../domain/catalog';
import type { BagId, ConfigSet, MaterialKey, PartConfig } from '../domain/catalog';
import { RAW_MATERIALS } from '../domain/palette';
import { BAG_MOUTH, LOOK_COVER, LOOK_EMISSIVE_REFLECT, LOOK_FALLBACK, LOOK_METAL, LOOK_REFLECT } from '../domain/palette.scene';
import { makeColor, paint } from './color';
import { BAG_HALF_HEIGHT, GROUND_Y } from './layout';
import { backOut, clamp, damp, lerp } from './math';
import type { ResourceTracker } from './resources';
import type { TextureBank } from './textures';

type PartKey = 'body' | 'lid' | 'front' | 'sides' | 'hip' | 'harness';
type Slot = PartKey | 'acc';
type Role = 'fabric' | 'pad' | 'mesh' | 'web' | 'accent' | 'cover' | 'reflect' | 'metal';
type V3 = readonly [number, number, number];

const SLOTS: readonly Slot[] = ['body', 'lid', 'front', 'sides', 'hip', 'harness', 'acc'];

interface Piece {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly slot: Slot;
  /** Partie de la configuration dont la pièce tire son apparence. */
  readonly part: PartKey;
  readonly role: Role;
  readonly stretch: boolean;
  readonly baseOpacity: number;
  readonly colTo: Color;
  rTo: number;
  pop: number;
  pe: number;
  fresh: boolean;
}

interface Extra { readonly stretch?: boolean; readonly baseOpacity?: number }

export interface BagHandle {
  readonly group: Group;
  /** Applique bag + config. Renvoie true si quelque chose a changé (pièces ou apparence). */
  sync(bagId: BagId, config: ConfigSet): boolean;
  /** Avance les amortissements (couleurs, apparition, échelle) ; true tant que ça bouge. */
  step(dt: number): boolean;
  dispose(): void;
}

/** Boîte arrondie lisse (normales continues) : maquette l.980. */
function roundedBox(w: number, h: number, d: number, radius: number, seg = 8): BoxGeometry {
  const r = Math.min(radius, w / 2, h / 2, d / 2) * 0.999;
  const g = new BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  if (!(p instanceof BufferAttribute) || !(n instanceof BufferAttribute)) return g;
  const ax = w / 2 - r;
  const ay = h / 2 - r;
  const az = d / 2 - r;
  const v = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -ax, ax), clamp(v.y, -ay, ay), clamp(v.z, -az, az));
    v.sub(c);
    const len = v.length();
    if (len < 1e-6) v.fromBufferAttribute(n, i);
    else v.divideScalar(len);
    n.setXYZ(i, v.x, v.y, v.z);
    p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
  }
  p.needsUpdate = true;
  n.needsUpdate = true;
  return g;
}

function taper(g: BoxGeometry, bottom: number): BoxGeometry {
  const p = g.getAttribute('position');
  if (!(p instanceof BufferAttribute)) return g;
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) + 0.725) / 1.45, 0, 1);
    p.setX(i, p.getX(i) * lerp(bottom, 1, t));
    p.setZ(i, p.getZ(i) * lerp(0.92, 1, t));
  }
  p.needsUpdate = true;
  return g;
}

const effLid = (c: ConfigSet): string => (c.body.shape === 'roll' ? 'none' : (c.lid.shape ?? 'std'));
const bodyFront = (c: ConfigSet): number => (c.body.shape === 'slim' ? 0.25 : 0.28);
const FRONT_DEPTH: Readonly<Partial<Record<string, number>>> = { stretch: 0.1, zip: 0.07, shove: 0.13 };
const frontZ = (c: ConfigSet): number => {
  const bf = bodyFront(c);
  const d = FRONT_DEPTH[c.front.shape ?? 'none'];
  return d === undefined ? bf + 0.005 : bf + d - 0.01;
};
/** [largeur, hauteur, épaisseur, rayon, y] de la poche avant selon sa forme. */
const FRONT_BOX: Readonly<Partial<Record<string, readonly [number, number, number, number, number]>>> = {
  stretch: [0.62, 0.8, 0.1, 0.08, -0.17],
  zip: [0.62, 0.8, 0.07, 0.06, -0.17],
  shove: [0.66, 0.95, 0.13, 0.1, -0.12],
};

/** Ce qui impose de reconstruire les pièces d'un emplacement (la couleur et la matière n'en font pas partie). */
function signature(slot: Slot, c: ConfigSet): string {
  const b = c.body.shape ?? '';
  switch (slot) {
    case 'body': return b;
    case 'lid': return `${b}|${c.lid.shape ?? ''}`;
    case 'front': return `${b}|${c.front.shape ?? ''}`;
    case 'sides': return c.sides.shape ?? '';
    case 'hip': return c.hip.shape ?? '';
    case 'harness': return `${b}|${c.harness.shape ?? ''}`;
    case 'acc': return `${b}|${c.lid.shape ?? ''}|${c.front.shape ?? ''}|${c.acc.join(',')}`;
  }
}

const hexOf = (key: MaterialKey | undefined): string => (key ? RAW_MATERIALS[key] : LOOK_FALLBACK);

interface Look { readonly col: string; readonly map: Texture | null; readonly r: number; readonly met: number }

export function createBag(tr: ResourceTracker, tex: TextureBank, reducedMotion: boolean): BagHandle {
  const group = new Group();
  const groups = {} as Record<Slot, Group>;
  for (const s of ['body', 'front', 'sides', 'hip', 'harness', 'acc'] as const) {
    groups[s] = new Group();
    group.add(groups[s]);
  }
  const lidPivot = new Group();
  lidPivot.position.set(0, 0.66, -0.26);
  group.add(lidPivot);
  groups.lid = lidPivot;

  const mouthMat = tr.material(new MeshBasicMaterial({ color: makeColor(BAG_MOUTH), transparent: true }));
  const mouth = new Mesh(tr.geometry(new CircleGeometry(1, 40)), mouthMat);
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.set(0, 0.728, 0);
  mouth.scale.set(0.3, 0.2, 1);
  mouth.visible = false;
  group.add(mouth);

  const scale = new Vector3(1, 1, 1);
  const scaleT = new Vector3(1, 1, 1);
  let pieces: Piece[] = [];
  let sigs: Partial<Record<Slot, string>> = {};
  let current: { readonly bagId: BagId; readonly key: string } | null = null;
  let config: ConfigSet | null = null;
  let disposed = false;

  const popSpeed = reducedMotion ? 60 : 3.4;

  function add(slot: Slot, part: PartKey, role: Role, geometry: BufferGeometry, pos: V3, rot?: V3, extra?: Extra): Piece {
    const bo = extra?.baseOpacity ?? 1;
    const material = tr.material(new MeshStandardMaterial({ roughness: 0.82, metalness: 0, transparent: bo < 1, opacity: bo, depthWrite: bo === 1 }));
    if (role === 'reflect') {
      paint(material.emissive, LOOK_EMISSIVE_REFLECT);
      material.emissiveIntensity = 0.3;
    }
    const mesh = new Mesh(geometry, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groups[slot].add(mesh);
    const piece: Piece = {
      mesh, slot, part, role, stretch: extra?.stretch ?? false, baseOpacity: bo,
      colTo: new Color(), rTo: 0.82, pop: 0, pe: 1, fresh: true,
    };
    pieces.push(piece);
    return piece;
  }

  const box = (w: number, h: number, d: number, r: number, seg?: number): BufferGeometry => tr.geometry(roundedBox(w, h, d, r, seg));
  const shared = (key: string, factory: () => BufferGeometry): BufferGeometry => tr.acquire(key, factory);

  function clearSlot(slot: Slot): void {
    const keep: Piece[] = [];
    for (const p of pieces) {
      if (p.slot !== slot) { keep.push(p); continue; }
      groups[slot].remove(p.mesh);
      p.mesh.material.dispose();
      tr.release(p.mesh.geometry);
    }
    pieces = keep;
  }

  function buildSlot(slot: Slot, c: ConfigSet): void {
    clearSlot(slot);
    switch (slot) {
      case 'body': {
        const sh = c.body.shape;
        if (sh === 'roll') {
          add('body', 'body', 'fabric', box(0.78, 1.6, 0.56, 0.22, 10), [0, 0.075, 0]);
          add('body', 'body', 'fabric', shared('rolltop', () => new CylinderGeometry(0.07, 0.07, 0.72, 20)), [0, 0.9, 0.02], [0, 0, Math.PI / 2]);
          for (const sx of [-0.24, 0.24]) add('body', 'body', 'web', box(0.045, 0.36, 0.02, 0.01, 2), [sx, 0.74, 0.29]);
        } else if (sh === 'slim') {
          add('body', 'body', 'fabric', tr.geometry(taper(roundedBox(0.76, 1.45, 0.5, 0.2, 10), 0.82)), [0, 0, 0]);
        } else {
          add('body', 'body', 'fabric', box(0.78, 1.45, 0.56, 0.22, 10), [0, 0, 0]);
        }
        mouth.scale.set(sh === 'slim' ? 0.28 : 0.3, sh === 'slim' ? 0.18 : 0.2, 1);
        break;
      }
      case 'lid': {
        const sh = effLid(c);
        if (sh === 'none') break;
        const xl = sh === 'xl';
        add('lid', 'lid', 'fabric', box(0.8, xl ? 0.34 : 0.26, xl ? 0.66 : 0.62, xl ? 0.14 : 0.12), [0, xl ? 0.24 : 0.2, 0.28]);
        add('lid', 'lid', 'accent', box(0.5, 0.018, 0.014, 0.007, 2), [0, xl ? 0.24 : 0.2, xl ? 0.617 : 0.597]);
        for (const sx of [-0.2, 0.2]) add('lid', 'lid', 'web', box(0.05, 0.36, 0.02, 0.01, 2), [sx, -0.06, 0.55]);
        break;
      }
      case 'front': {
        const sh = c.front.shape ?? 'none';
        const bf = bodyFront(c);
        const fz = frontZ(c);
        const D = FRONT_BOX[sh];
        if (D) {
          add('front', 'front', 'fabric', box(D[0], D[1], D[2], D[3]), [0, D[4], bf + D[2] / 2 - 0.01], undefined, { stretch: sh === 'stretch' });
          if (sh === 'zip') add('front', 'front', 'accent', box(0.014, 0.64, 0.012, 0.006, 2), [0.2, D[4], fz + 0.006]);
        }
        add('front', 'front', 'accent', box(0.12, 0.12, 0.012, 0.03, 3), [0, 0.1, fz + 0.004]);
        for (const y of [-0.5, 0.18]) add('front', 'front', 'web', box(0.7, 0.035, 0.03, 0.012, 2), [0, y, Math.max(fz, bf + 0.01) + 0.012]);
        break;
      }
      case 'sides': {
        const sh = c.sides.shape ?? 'std';
        if (sh !== 'none') {
          const h = sh === 'tall' ? 0.62 : 0.4;
          const y = sh === 'tall' ? -0.31 : -0.42;
          for (const sx of [-1, 1]) add('sides', 'sides', 'fabric', box(0.1, h, 0.38, 0.05), [sx * 0.42, y, 0.02]);
        }
        for (const sx of [-1, 1]) add('sides', 'sides', 'web', box(0.02, 0.035, 0.46, 0.012, 2), [sx * 0.395, 0.12, 0]);
        break;
      }
      case 'hip': {
        const sh = c.hip.shape;
        for (const sx of [-1, 1]) {
          if (sh === 'web') { add('hip', 'hip', 'web', box(0.44, 0.05, 0.025, 0.012, 2), [sx * 0.42, -0.6, -0.2], [0, sx * -0.6, 0]); continue; }
          const w = sh === 'wide';
          add('hip', 'hip', 'pad', box(w ? 0.4 : 0.34, w ? 0.26 : 0.2, w ? 0.12 : 0.1, 0.05), [sx * 0.42, -0.6, -0.2], [0, sx * -0.6, 0]);
          add('hip', 'hip', 'fabric', box(w ? 0.26 : 0.18, w ? 0.17 : 0.12, 0.04, 0.03, 3), [sx * (w ? 0.49 : 0.47), -0.6, w ? -0.1 : -0.12], [0, sx * -0.6, 0]);
        }
        break;
      }
      case 'harness': {
        const sh = c.harness.shape;
        const bz = c.body.shape === 'slim' ? 0.03 : 0;
        if (sh === 'mesh') {
          add('harness', 'harness', 'pad', box(0.7, 1.3, 0.035, 0.03), [0, 0, -0.29 + bz]);
          add('harness', 'harness', 'mesh', box(0.6, 1.08, 0.012, 0.02, 4), [0, 0.02, -0.37 + bz]);
          for (const qx of [-1, 1]) for (const qy of [-1, 1]) add('harness', 'harness', 'web', box(0.04, 0.04, 0.08, 0.01, 2), [qx * 0.28, qy * 0.5, -0.33 + bz]);
        } else {
          add('harness', 'harness', 'pad', box(0.7, 1.3, 0.07, 0.06), [0, 0, -0.3 + bz]);
        }
        for (const sx of [-1, 1]) {
          if (sh === 'vest') add('harness', 'harness', 'pad', box(0.13, 0.95, 0.035, 0.03, 4), [sx * 0.19, 0.12, -0.4 + bz], [0.12, 0, sx * 0.08]);
          else add('harness', 'harness', 'pad', shared('cap', () => new CapsuleGeometry(0.05, 0.9, 6, 12)), [sx * 0.18, 0.12, (sh === 'mesh' ? -0.41 : -0.37) + bz], [0.12, 0, sx * 0.08]);
        }
        add('harness', 'harness', 'web', box(0.38, 0.025, 0.02, 0.01, 2), [0, 0.32, (sh === 'mesh' ? -0.45 : -0.42) + bz]);
        add('harness', 'harness', 'web', shared('loop', () => new TorusGeometry(0.06, 0.012, 8, 16)), [0, 0.74, -0.3 + bz], [Math.PI / 2, 0, 0]);
        break;
      }
      case 'acc': {
        const a = c.acc;
        const fz = frontZ(c);
        const noLid = effLid(c) === 'none';
        if (a.includes('cover')) add('acc', 'body', 'cover', box(0.9, noLid ? 1.6 : 1.78, 0.76, 0.28, 10), [0, noLid ? 0.05 : 0.12, 0.04], undefined, { baseOpacity: 0.82 });
        if (a.includes('reflect')) for (const sx of [-1, 1]) add('acc', 'body', 'reflect', box(0.02, 0.5, 0.008, 0.004, 2), [sx * 0.34, 0.2, bodyFront(c) + 0.006]);
        if (a.includes('daisy')) for (let i = 0; i < 6; i++) add('acc', 'front', 'web', box(0.07, 0.024, 0.018, 0.006, 2), [-0.24, -0.45 + i * 0.12, fz + 0.012]);
        if (a.includes('axe')) {
          add('acc', 'front', 'web', shared('axel', () => new TorusGeometry(0.05, 0.013, 8, 18)), [0.22, -0.62, fz + 0.01]);
          add('acc', 'front', 'web', box(0.06, 0.08, 0.02, 0.01, 2), [0.22, 0.32, fz + 0.01]);
        }
        if (a.includes('compress')) for (const sx of [-1, 1]) for (const y of [-0.25, 0.45]) add('acc', 'sides', 'web', box(0.02, 0.035, 0.46, 0.012, 2), [sx * 0.395, y, 0]);
        if (a.includes('spocket')) add('acc', 'harness', 'fabric', box(0.12, 0.18, 0.06, 0.03, 3), [0.2, 0.28, -0.47], [0.12, 0, 0.08]);
        if (a.includes('sbottle')) add('acc', 'harness', 'fabric', shared('sbh', () => new CylinderGeometry(0.055, 0.055, 0.18, 16)), [0.2, 0.26, -0.48]);
        if (a.includes('biner')) add('acc', 'hip', 'metal', shared('biner', () => new TorusGeometry(0.045, 0.008, 8, 20)), [0.62, -0.64, -0.02], [0, 0.4, 0]);
        break;
      }
    }
  }

  function look(piece: Piece, c: ConfigSet): Look {
    const P: PartConfig = c[piece.part];
    switch (piece.role) {
      case 'fabric': {
        const mt = MATERIALS[P.mat ?? 'ripstop'];
        const fn = FINISHES[P.fin ?? 'mat'];
        const map = fn.noise ? tex.fabric('heather') : piece.stretch ? tex.fabric('mesh') : tex.fabric(mt.tex);
        return { col: hexOf(P.col ?? c.body.col), map, r: (fn.r + mt.rough) / 2, met: fn.m };
      }
      case 'pad': {
        const fn = FINISHES[P.fin ?? 'mat'];
        return { col: hexOf(P.col ?? c.body.col), map: fn.noise ? tex.fabric('heather') : tex.fabric('pad'), r: fn.r, met: fn.m };
      }
      case 'mesh': return { col: hexOf(P.col ?? c.body.col), map: tex.fabric('mesh'), r: 0.9, met: 0 };
      case 'web': {
        const fn = FINISHES[c.webbing.fin ?? 'mat'];
        return { col: hexOf(c.webbing.col), map: tex.fabric('web'), r: fn.r, met: fn.m };
      }
      case 'accent': return { col: hexOf(c.accent), map: null, r: 0.45, met: 0.1 };
      case 'cover': return { col: LOOK_COVER, map: null, r: 0.45, met: 0 };
      case 'reflect': return { col: LOOK_REFLECT, map: null, r: 0.2, met: 0.7 };
      case 'metal': return { col: LOOK_METAL, map: null, r: 0.25, met: 0.85 };
    }
  }

  function applyLook(c: ConfigSet, instant: boolean): void {
    for (const p of pieces) {
      const L = look(p, c);
      const mt = p.mesh.material;
      paint(p.colTo, L.col);
      p.rTo = L.r;
      mt.metalness = L.met;
      if (mt.map !== L.map) { mt.map = L.map; mt.needsUpdate = true; }
      if (instant || p.fresh) { mt.color.copy(p.colTo); mt.roughness = L.r; p.fresh = false; }
    }
  }

  function updateMouth(c: ConfigSet): void {
    const a = effLid(c) !== 'none' ? 0 : c.body.shape === 'roll' ? 0 : 0.92;
    mouth.visible = a > 0.03;
    mouthMat.opacity = a;
  }

  return {
    group,
    sync(bagId, c) {
      if (disposed) return false;
      const key = JSON.stringify(c);
      if (current && current.bagId === bagId && current.key === key) return false;
      const first = current === null;
      const bagChanged = !first && current?.bagId !== bagId;
      scaleT.set(...BAGS[bagId].sc);
      if (first) scale.copy(scaleT);
      const next: Partial<Record<Slot, string>> = {};
      for (const slot of SLOTS) {
        next[slot] = signature(slot, c);
        if (first || bagChanged || sigs[slot] !== next[slot]) buildSlot(slot, c);
      }
      sigs = next;
      current = { bagId, key };
      config = c;
      applyLook(c, first || bagChanged);
      updateMouth(c);
      group.scale.copy(scale);
      group.position.y = GROUND_Y + BAG_HALF_HEIGHT * scale.y;
      return true;
    },
    step(dt) {
      if (disposed || !config) return false;
      let moving = false;
      if (scale.distanceToSquared(scaleT) > 1e-7) {
        if (reducedMotion) scale.copy(scaleT);
        else scale.lerp(scaleT, damp(6, dt));
        moving = true;
      } else if (!scale.equals(scaleT)) {
        scale.copy(scaleT);
        moving = true;
      }
      group.scale.copy(scale);
      group.position.y = GROUND_Y + BAG_HALF_HEIGHT * scale.y;
      const k = damp(9, dt);
      for (const p of pieces) {
        const mt = p.mesh.material;
        const dc = Math.abs(mt.color.r - p.colTo.r) + Math.abs(mt.color.g - p.colTo.g) + Math.abs(mt.color.b - p.colTo.b);
        if (dc > 0.002) { mt.color.lerp(p.colTo, k); moving = true; } else if (dc > 0) mt.color.copy(p.colTo);
        const dr = p.rTo - mt.roughness;
        if (Math.abs(dr) > 0.002) { mt.roughness += dr * k; moving = true; } else mt.roughness = p.rTo;
        if (p.pop < 1) { p.pop = Math.min(1, p.pop + dt * popSpeed); moving = true; }
        const pe = p.pop >= 1 ? 1 : 0.88 + 0.12 * backOut(p.pop);
        if (pe !== 1 || p.pe !== 1) p.mesh.scale.setScalar(pe);
        p.pe = pe;
      }
      return moving;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const slot of SLOTS) clearSlot(slot);
      group.remove(mouth);
      mouth.geometry.dispose();
      mouthMat.dispose();
      group.removeFromParent();
    },
  };
}
