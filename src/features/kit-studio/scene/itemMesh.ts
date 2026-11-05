// Objets du catalogue en 3D procédurale (maquette Kit_Studio_v2.html l.1057-1089) : un maillage par forme `sh`,
// teinté par la couleur de l'objet. Géométries et matériaux sont PARTAGÉS par clé dans le ResourceTracker (comptés
// par référence) : la scène principale et les vignettes des cartes réutilisent les mêmes. Aucune couleur littérale :
// les teintes viennent du coloris de l'objet (RAW_MATERIALS) et de palette.scene.ts.
import {
  BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry, Sprite, SpriteMaterial, Texture, TorusGeometry,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Ghost, Item } from '../domain/catalog';
import { RAW_MATERIALS } from '../domain/palette';
import { GHOST_COLOR, GHOST_HALO_STOPS, ITEM_BLADE, ITEM_CROSS, ITEM_LENS, ITEM_SCREEN } from '../domain/palette.scene';
import { roundedBox } from './bagBuilder';
import { makeColor } from './color';
import { clamp } from './math';
import type { ResourceTracker } from './resources';

/** Forme minimale pour dessiner un objet (un Item, un objet ajouté, ou une vignette sur mesure). */
export type ItemLike = Pick<Item, 'sh' | 'gl' | 'L' | 'color'> & {
  readonly id: string;
  readonly cons?: string;
  readonly planned?: unknown;
};

/** Échelle de base d'un objet (userData.s du groupe) : le volume (litres) borné, ajusté par forme. */
export interface ItemMeshData { readonly s: number }

const OPACITY_PLANNED = 0.62;
const GHOST_OPACITY = 0.5;

interface Spec {
  readonly id: string;
  readonly sh: string;
  readonly gl: string;
  readonly L: number;
  readonly hex: string;
  readonly planned: boolean;
  readonly ghost: boolean;
}

const hexOf = (item: Pick<Item, 'color'>): string => RAW_MATERIALS[item.color];

/** Taille de base selon le volume (maquette : cbrt(L) × 0,2 borné). */
const baseScale = (L: number): number => clamp(Math.cbrt(Math.max(L || 0.3, 0.05)) * 0.2, 0.1, 0.4);

function build(spec: Spec, tr: ResourceTracker, fabric: Texture | null): Group {
  const group = new Group();
  const sc = baseScale(spec.L);
  let s = sc;
  const fabKey = fabric ? 't' : 'n';
  const planned = spec.planned;

  const geo = (key: string, factory: () => BufferGeometry): BufferGeometry => tr.acquire(`it:${key}`, factory);
  const rbox = (w: number, h: number, d: number, r: number, seg = 8): BufferGeometry =>
    tr.acquire(`it:rb:${w}:${h}:${d}:${r}:${seg}`, () => roundedBox(w, h, d, r, seg));

  /** Matériau partagé : la variante « prévu » (objet à acheter ou louer) est translucide. */
  const mat = <T extends Material>(key: string, factory: () => T): Material => {
    if (spec.ghost) return tr.acquireMaterial('it:ghost', ghostMaterial);
    return tr.acquireMaterial(`it:${key}${planned ? ':p' : ''}`, () => {
      const m = factory();
      if (planned) { m.transparent = true; m.opacity = OPACITY_PLANNED; }
      return m;
    });
  };
  const std = (key: string, hex: string, rough: number, metal: number, map: Texture | null = null): Material =>
    mat(`${key}:${hex}`, () => new MeshStandardMaterial({ color: makeColor(hex), roughness: rough, metalness: metal, map }));
  const fab = (): Material => std(`fab${fabKey}`, spec.hex, 0.86, 0, fabric);
  const solid = (): Material => std('solid', spec.hex, 0.55, 0.05);
  const dm = (): Material =>
    mat(`dark:${spec.hex}`, () => new MeshStandardMaterial({ color: makeColor(spec.hex).multiplyScalar(0.5), roughness: 0.7, metalness: 0 }));
  const metal = (rough: number, met: number): Material => std(`metal${rough}:${met}`, spec.hex, rough, met);
  const fixed = (hex: string, rough: number, met: number): Material => std('fixed', hex, rough, met);

  const mk = (g: BufferGeometry, m: Material): Mesh => {
    const o = new Mesh(g, m);
    o.castShadow = !spec.ghost;
    return o;
  };
  const add = (...parts: Mesh[]): void => { for (const p of parts) group.add(p); };
  const sphere = (): BufferGeometry => geo('sack', () => new SphereGeometry(0.6, 24, 18));

  switch (spec.sh) {
    case 'roll': {
      const m = mk(geo('roll', () => new CylinderGeometry(0.5, 0.5, 1.5, 28)), fab());
      m.rotation.z = Math.PI / 2;
      add(m);
      for (const x of [-0.62, 0.62]) {
        const r = mk(geo('rollr', () => new TorusGeometry(0.48, 0.04, 8, 28)), dm());
        r.rotation.y = Math.PI / 2;
        r.position.x = x;
        add(r);
      }
      break;
    }
    case 'sack': {
      const m = mk(sphere(), fab());
      m.scale.set(1, 0.85, 0.8);
      add(m);
      const k = mk(geo('knot', () => new SphereGeometry(0.12, 12, 10)), dm());
      k.position.y = 0.5;
      add(k);
      break;
    }
    case 'jacket': {
      const m = mk(sphere(), fab());
      m.scale.set(1.15, 0.62, 0.8);
      add(m);
      const z = mk(geo('zip', () => new BoxGeometry(0.035, 0.5, 0.02)), dm());
      z.position.z = 0.47;
      add(z);
      break;
    }
    case 'box': {
      add(mk(rbox(1.1, 0.72, 0.6, 0.14), solid()));
      if (spec.gl === 'aid') {
        const a = mk(geo('cx', () => new BoxGeometry(0.36, 0.1, 0.02)), fixed(ITEM_CROSS, 0.6, 0));
        a.position.z = 0.305;
        const b = mk(geo('cx', () => new BoxGeometry(0.36, 0.1, 0.02)), fixed(ITEM_CROSS, 0.6, 0));
        b.position.z = 0.305;
        b.rotation.z = Math.PI / 2;
        add(a, b);
      }
      s = sc * 1.15;
      break;
    }
    case 'bottle': {
      add(mk(geo('btl', () => new CylinderGeometry(0.28, 0.32, 1.1, 22)), solid()));
      const c = mk(geo('btc', () => new CylinderGeometry(0.16, 0.16, 0.18, 16)), dm());
      c.position.y = 0.64;
      add(c);
      s = sc * 1.35;
      break;
    }
    case 'bladder': {
      const b = mk(rbox(0.85, 1.2, 0.16, 0.07), mat(`bladder:${spec.hex}`, () => new MeshStandardMaterial({
        color: makeColor(spec.hex), roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.85,
      })));
      add(b);
      const h = mk(geo('hose', () => new TorusGeometry(0.35, 0.025, 8, 24, Math.PI * 1.2)), dm());
      h.position.set(0.25, 0.55, 0);
      add(h);
      s = sc * 1.1;
      break;
    }
    case 'lamp': {
      const b = mk(geo('band', () => new TorusGeometry(0.5, 0.06, 10, 32)), dm());
      b.rotation.x = Math.PI / 2;
      add(b);
      const l = mk(rbox(0.36, 0.26, 0.2, 0.06, 4), solid());
      l.position.z = 0.52;
      add(l);
      const lens = mk(geo('lens', () => new CircleGeometry(0.08, 16)), mat('lens', () => new MeshBasicMaterial({ color: makeColor(ITEM_LENS) })));
      lens.castShadow = false;
      lens.position.z = 0.625;
      add(lens);
      s = 0.17;
      break;
    }
    case 'poles': {
      for (const sx of [-0.12, 0.12]) {
        const p = mk(geo('pole', () => new CylinderGeometry(0.03, 0.018, 1.6, 10)), solid());
        p.position.x = sx;
        p.rotation.z = sx * 0.12;
        add(p);
        const gr = mk(geo('grip', () => new CylinderGeometry(0.06, 0.06, 0.3, 12)), dm());
        gr.position.set(sx * 1.6, 0.7, 0);
        add(gr);
      }
      s = 0.42;
      break;
    }
    case 'map': {
      add(mk(rbox(0.9, 0.62, 0.05, 0.024, 3), solid()));
      s = 0.3;
      break;
    }
    case 'shoe': {
      for (const z of [-0.2, 0.2]) {
        const sole = mk(rbox(1.1, 0.14, 0.34, 0.06, 4), dm());
        sole.position.set(0, -0.26, z);
        add(sole);
        const up = mk(sphere(), fab());
        up.scale.set(0.85, 0.48, 0.3);
        up.position.set(-0.08, 0, z);
        add(up);
      }
      s = 0.32;
      break;
    }
    case 'phone': {
      add(mk(rbox(0.5, 1, 0.08, 0.04, 4), solid()));
      const scr = mk(geo('scr', () => new PlaneGeometry(0.42, 0.88)), fixed(ITEM_SCREEN, 0.2, 0.3));
      scr.castShadow = false;
      scr.position.z = 0.042;
      add(scr);
      s = 0.16;
      break;
    }
    case 'knife': {
      add(mk(rbox(0.8, 0.16, 0.1, 0.05, 4), dm()));
      const bl = mk(geo('kb', () => new BoxGeometry(0.55, 0.12, 0.02)), fixed(ITEM_BLADE, 0.25, 0.8));
      bl.position.set(0.62, 0.03, 0);
      add(bl);
      s = 0.16;
      break;
    }
    case 'tube': {
      add(mk(geo('tube', () => new CylinderGeometry(0.22, 0.28, 0.9, 18)), solid()));
      const c = mk(geo('tcap', () => new CylinderGeometry(0.14, 0.14, 0.2, 14)), dm());
      c.position.y = -0.55;
      add(c);
      s = 0.15;
      break;
    }
    case 'stove': {
      add(mk(geo('pot', () => new CylinderGeometry(0.5, 0.46, 0.62, 26)), metal(0.35, 0.6)));
      const l = mk(geo('potl', () => new CylinderGeometry(0.52, 0.52, 0.06, 26)), dm());
      l.position.y = 0.34;
      add(l);
      s = sc * 1.2;
      break;
    }
    case 'hat': {
      add(mk(geo('crown', () => new SphereGeometry(0.5, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2)), fab()));
      const b = mk(geo('brim', () => new CylinderGeometry(0.42, 0.42, 0.04, 24)), fab());
      b.scale.set(1, 1, 1.2);
      b.position.set(0, 0.01, 0.32);
      add(b);
      s = 0.2;
      break;
    }
    case 'glasses': {
      for (const sx of [-0.28, 0.28]) {
        const r = mk(geo('lensr', () => new TorusGeometry(0.2, 0.035, 8, 20)), dm());
        r.position.x = sx;
        add(r);
      }
      add(mk(geo('br', () => new BoxGeometry(0.18, 0.03, 0.03)), dm()));
      s = 0.16;
      break;
    }
    case 'blanket': {
      add(mk(rbox(0.8, 0.55, 0.14, 0.05, 4), metal(0.3, 0.7)));
      s = 0.2;
      break;
    }
    case 'watch': {
      add(mk(rbox(0.5, 0.5, 0.14, 0.12, 4), solid()));
      const st = mk(geo('ws', () => new TorusGeometry(0.42, 0.07, 8, 24)), dm());
      st.rotation.y = Math.PI / 2;
      add(st);
      s = 0.11;
      break;
    }
    case 'laptop': {
      add(mk(rbox(1.2, 0.82, 0.06, 0.03, 4), metal(0.4, 0.5)));
      s = 0.34;
      break;
    }
    default:
      add(mk(sphere(), fab()));
  }

  group.userData = { s } satisfies ItemMeshData;
  return group;
}

function ghostMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: makeColor(GHOST_COLOR), wireframe: true, transparent: true, opacity: GHOST_OPACITY, depthWrite: false });
}

/**
 * Maillage d'un objet. `res` : inventaire de ressources (partagé avec la scène et les vignettes). `fabric` : texture
 * de tissu optionnelle. Le groupe porte `userData.s` (échelle de base) ; chaque maillage porte `userData.itemId`.
 * À rendre avec releaseItemMesh().
 */
export function itemMesh(item: ItemLike, res: ResourceTracker, fabric: Texture | null = null): Group {
  const group = build(
    { id: item.id, sh: item.sh, gl: item.gl, L: item.L, hex: hexOf(item), planned: Boolean(item.planned), ghost: false },
    res,
    fabric,
  );
  group.traverse((o) => { if (o instanceof Mesh) o.userData = { itemId: item.id }; });
  return group;
}

/** Maillage filaire ambre d'un objet manquant ; chaque maillage porte `userData.ghost` (fonction manquante). */
export function ghostMesh(ghost: Pick<Ghost, 'fn' | 'sh' | 'gl'>, res: ResourceTracker): Group {
  const group = build({ id: '', sh: ghost.sh, gl: ghost.gl, L: 0.9, hex: GHOST_COLOR, planned: false, ghost: true }, res, null);
  group.traverse((o) => { if (o instanceof Mesh) { o.castShadow = false; o.userData = { ghost: ghost.fn }; } });
  return group;
}

/** Matériau filaire partagé des fantômes (le même pour tous). */
export function ghostMaterialOf(res: ResourceTracker): MeshBasicMaterial {
  const m = res.acquireMaterial('it:ghost', ghostMaterial);
  return m as MeshBasicMaterial;
}

/** Rend les géométries et matériaux d'un maillage d'objet (partagés : libérés à la dernière référence). */
export function releaseItemMesh(group: Group, res: ResourceTracker): void {
  group.traverse((o) => {
    if (o instanceof Mesh) {
      res.release(o.geometry as BufferGeometry);
      res.releaseMaterial(o.material as Material);
    }
  });
  group.removeFromParent();
}

/** Halo radial des fantômes (texture partagée). Sans contexte 2D (tests), la texture reste vide. */
export function haloTexture(res: ResourceTracker): Texture {
  if (typeof document === 'undefined') return res.texture(new Texture());
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    for (const [at, color] of GHOST_HALO_STOPS) gr.addColorStop(at, color);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
  }
  return res.texture(new CanvasTexture(canvas));
}

/** Pastille lumineuse d'un fantôme : un sprite par fantôme (opacité animée), carte partagée. */
export function halo(res: ResourceTracker, map: Texture): Sprite {
  const sprite = new Sprite(res.material(new SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 })));
  sprite.scale.setScalar(0.32);
  sprite.visible = false;
  return sprite;
}
