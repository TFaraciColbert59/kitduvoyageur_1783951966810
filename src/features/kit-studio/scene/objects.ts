// Objets rangés dans la scène (maquette Kit_Studio_v2.html l.1090-1109 et l.1126-1162).
// Règle produit (09/11/2026) : maillages réels uniquement. Un objet n'a d'entrée ici que s'il a un `.glb` publié
// (itemAssets.ts) ; aucun objet n'est dessiné par code et les « fantômes » (fonctions manquantes) ne sont plus
// dessinés du tout : le manque reste lisible en 2D (bilan, cartes). Registre vide aujourd'hui : la couche ne
// contient donc aucun mesh, aucune entrée, aucun tir de rayon sur un objet.
// Synchronisation avec l'état (addObj / killObj animés), mise en place par zone :
// au repos les objets rangés sont invisibles dans le sac ; ils se déploient en arc devant la caméra sur la zone au
// premier plan, ou s'écartent autour du sac en « pièces séparées ». Les objets de « Sur toi » reposent sur l’établi.
// Rien ici n'écrit dans l'état : la couche lit KitState (jamais modifié) et pilote uniquement des objets three.
// Aucune allocation dans step() : vecteurs et tableaux sont créés à la synchronisation.
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Group, Object3D, Texture } from 'three';
import { ANCHORS, PACK_ZONE_IDS } from '../domain/catalog';
import type { PartNameId, ZoneId } from '../domain/catalog';
import { packedLocal, reindex } from '../domain/layout';
import type { PackIndex } from '../domain/layout';
import { currentKit, getItem } from '../domain/state';
import { effG } from '../domain/totals';
import type { KitState } from '../domain/types';
import type { BagHandle } from './bagBuilder';
import { hasItemModel } from './itemAssets';
import { GROUND_Y, WORN_CENTER, WORN_OFFSETS } from './layout';
import { clamp, damp } from './math';
import type { ResourceTracker } from './resources';

/** Ce que la scène fournit à chaque image. */
export interface ObjectFrame {
  /** Zone au premier plan et force de la mise en avant (0..1). */
  focus: ZoneId;
  arcAmt: number;
  /** Pièces séparées, 0..1. */
  ex: number;
  /** Position continue de la caméra sur la liste des zones (0 = Sur toi). */
  pos: number;
}

/** Résultat brut d'un tir de rayon. */
export type RawPick =
  | { readonly type: 'item'; readonly id: string }
  | { readonly type: 'bag'; readonly zone: ZoneId; readonly part: PartNameId };

export interface ObjectLayerOptions {
  readonly root: Object3D;
  /** Inventaire de ressources et tissu : réservés au futur chargeur de maillages d'objets (aucun mesh dessiné ici). */
  readonly tr: ResourceTracker;
  readonly bag: BagHandle;
  readonly camera: Camera & { readonly fov: number };
  readonly viewport: () => { readonly width: number; readonly height: number };
  readonly fabric: Texture | null;
  readonly reducedMotion: boolean;
  /** Marge haute (px) à laisser libre dans l'arc (encoche, pilule). */
  readonly safeTop?: () => number;
}

export interface ObjectLayer {
  /** Aligne objets et fantômes sur l'état ; true si quelque chose a changé. */
  sync(state: KitState): boolean;
  /** Avance les animations et replace les objets ; true tant que ça bouge. */
  step(dt: number, frame: ObjectFrame): boolean;
  /** Ancre monde d'une zone (le sac doit avoir sa matrice à jour). */
  anchor(zone: ZoneId, out: Vector3): Vector3;
  /** Tir de rayon en coordonnées normalisées (-1..1) : objet (maillage publié) ou pièce du sac. */
  pick(ndcX: number, ndcY: number): RawPick | null;
  /** Projection écran (px, dans le canvas) d'un objet / d'une zone ; null si l'objet n'existe pas. */
  projectItem(id: string, out: { x: number; y: number }): { x: number; y: number } | null;
  projectZone(zone: ZoneId, out: { x: number; y: number }): { x: number; y: number };
  /** Soulever un objet : il suit le doigt, hors du sac. */
  canLift(id: string): boolean;
  liftBegin(id: string): boolean;
  liftMove(ndcX: number, ndcY: number): void;
  /** Fin du soulevé : `keep` garde l'objet à l'endroit relâché le temps que l'interface le range ailleurs. */
  liftEnd(keep: boolean): void;
  /** Nombre d'objets vivants (hors sortants), pour les tests et l'inspection. */
  counts(): { readonly items: number; readonly dying: number };
  dispose(): void;
}

const HOLD_S = 0.6;
const DYING_S = 0.45;
const ARC_PX_PER_ITEM = 112;

/** Rayons de séparation par emplacement du compartiment principal (maquette l.1141). */
const MAIN_R: Readonly<Record<string, number>> = { bottom: 1.15, bottomF: 1.45, midBack: 0.98, midFront: 1.42, top: 1.2 };
const MAIN_Y: Readonly<Record<string, number>> = { bottom: -0.42, bottomF: -0.42, midBack: 0.08, midFront: 0.04, top: 0.58 };
/** [rayon, angle, hauteur] des zones extérieures. */
const OUTER: Readonly<Record<string, readonly [number, number, number]>> = {
  front: [1.95, 0.45, -0.2], sides: [1.1, 1.57, -0.32], hip: [1.05, 2.35, -0.5], back: [1.0, 3.14, 0.25],
};
const OUTER_DEFAULT: readonly [number, number, number] = [1.2, 0, 0];

interface Entry {
  /** Identifiant de l'objet. */
  readonly key: string;
  readonly g: Group;
  zone: ZoneId;
  base: number;
  readonly cur: Vector3;
  sc: number;
  /** Position locale dans le sac et facteur de consommation (nourriture, gaz). */
  readonly local: Vector3;
  consK: number;
  readonly worn: Vector3;
  readonly restingLift: number;
  /** Rang dans la liste de sa zone. */
  zi: number;
  zn: number;
  /** Paramètres de séparation : rayon, angle, hauteur (× échelle du sac) et décalage fixe. */
  er: number;
  ea: number;
  ey: number;
  eyAdd: number;
  arcOn: boolean;
  readonly arcP: Vector3;
  arcSp: number;
  /** Position imposée (soulevé, ou point de chute d'un objet qui sort). */
  readonly ov: Vector3;
  hasOv: boolean;
  ovTtl: number;
  t: number;
}

export function createObjectLayer(o: ObjectLayerOptions): ObjectLayer {
  const { root, bag, camera, reducedMotion } = o;
  const entries = new Map<string, Entry>();
  const items: Entry[] = [];
  let dying: Entry[] = [];
  let idx: PackIndex = {};
  let lifted: Entry | null = null;
  let arcZone: ZoneId | null = null;
  let disposed = false;

  // Vecteurs, rayon et plan réutilisés.
  const va = new Vector3();
  const vb = new Vector3();
  const vc = new Vector3();
  const vd = new Vector3();
  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane();
  const hit = new Vector3();

  const anchor = (zone: ZoneId, out: Vector3): Vector3 => {
    if (zone === 'worn') return out.set(WORN_CENTER[0], WORN_CENTER[1], WORN_CENTER[2]);
    const a = ANCHORS[zone] ?? ANCHORS.bag ?? [0, 0, 0];
    return bag.group.localToWorld(out.set(a[0], a[1], a[2]));
  };

  const wornPos = (e: Entry, fn: string, out: Vector3): Vector3 => {
    const off = WORN_OFFSETS[fn] ?? [0, 0, 0];
    return out.set(WORN_CENTER[0] + off[0], GROUND_Y + e.restingLift * e.consK, WORN_CENTER[2] + off[2]);
  };

  const apply = (e: Entry): void => {
    e.g.position.copy(e.cur);
    e.g.scale.setScalar(Math.max(e.sc, 1e-4));
    e.g.visible = e.sc > 0.003;
  };

  /** Retire le groupe d'un objet de la scène. Le maillage publié est un actif partagé : il n'est pas libéré ici. */
  function releaseEntry(e: Entry): void {
    e.g.removeFromParent();
  }

  /**
   * Entrée 3D d'un objet : uniquement s'il a un maillage réel publié (itemAssets.ts). Sinon : pas de mesh, pas
   * d'entrée, pas de pick. Point d'extension : quand un chargeur de `.glb` d'objet sera branché (celui des sacs et
   * des modules, scene/bag/loader.ts), c'est ici que le groupe chargé est ajouté à `root` puis enregistré dans
   * `entries` et `items` avec son échelle de base (`userData.s`) et sa hauteur de repos (`restingLift`).
   * Tant que ce chargeur n'existe pas, même un objet inscrit au registre ne dessine rien.
   */
  function addItem(s: KitState, id: string): Entry | null {
    if (!hasItemModel(id) || !getItem(s, id)) return null;
    return null;
  }

  function killItem(e: Entry): void {
    entries.delete(e.key);
    items.splice(items.indexOf(e), 1);
    if (lifted === e) lifted = null;
    if (reducedMotion) { releaseEntry(e); return; }
    e.t = 0;
    dying.push(e);
  }

  /** Paramètres de séparation d'une entrée selon sa zone (maquette explodePos l.1140-1146). */
  function setExplode(e: Entry, zone: ZoneId): void {
    const i = e.zi;
    const n = e.zn;
    const x = idx[e.key];
    if (zone === 'main') {
      const sl = x?.slot ?? 'midFront';
      const si = x?.si ?? 0;
      const sn = x?.sn ?? 1;
      const r = MAIN_R[sl] ?? MAIN_R.midFront;
      e.er = r;
      e.ea = 0.05 + (si - (sn - 1) / 2) * (0.36 / r);
      e.ey = MAIN_Y[sl] ?? MAIN_Y.midFront;
      e.eyAdd = 0.05;
    } else if (zone === 'lid') {
      e.er = 0.62;
      e.ea = -0.25 + (i - (n - 1) / 2) * 0.55;
      e.ey = 1.2;
      e.eyAdd = 0;
    } else {
      const c = OUTER[zone] ?? OUTER_DEFAULT;
      e.er = c[0];
      e.ea = c[1] + (i - (n - 1) / 2) * (0.36 / c[0]);
      e.ey = c[2];
      e.eyAdd = 0;
    }
  }

  function sync(s: KitState): boolean {
    if (disposed) return false;
    let changed = false;
    const kit = currentKit(s);
    idx = reindex(s);
    bag.group.updateMatrixWorld();

    // Objets : sortants animés, entrants créés.
    for (const e of [...items]) {
      if (!(e.key in idx)) { killItem(e); changed = true; }
    }
    for (const z of PACK_ZONE_IDS) {
      for (const id of kit.packed[z] ?? []) {
        if (!entries.has(id) && addItem(s, id)) changed = true;
      }
    }

    // Listes par zone (objets rangés) → rang, effectif, position et séparation.
    for (const z of PACK_ZONE_IDS) {
      const keys: Entry[] = [];
      for (const id of kit.packed[z] ?? []) {
        const e = entries.get(id);
        if (e) keys.push(e);
      }
      keys.forEach((e, i) => {
        e.zi = i;
        e.zn = keys.length;
        e.zone = z;
        setExplode(e, z);
      });
    }
    for (const e of items) {
      const it = getItem(s, e.key);
      if (!it) continue;
      const l = packedLocal(s, e.key, idx);
      if (e.local.x !== l[0] || e.local.y !== l[1] || e.local.z !== l[2]) { e.local.set(l[0], l[1], l[2]); changed = true; }
      const ck = it.cons && it.g ? clamp(Math.cbrt(effG(s, it) / it.g), 0.45, 1) : 1;
      if (ck !== e.consK) { e.consK = ck; changed = true; }
      wornPos(e, it.fn, e.worn);
      if (e.cur.lengthSq() === 0 && e.sc === 0) {
        // Apparition : depuis la position de rangement (ou du personnage).
        if (e.zone === 'worn') e.cur.copy(e.worn);
        else bag.group.localToWorld(e.cur.copy(e.local));
      }
    }
    return changed;
  }

  // Paramètres de l'arc de la zone au premier plan (réutilisés à chaque image).
  const arc = { j: 0, n: 0, per: 1, spPx: 0, y0: 0, dy: 0, wpp: 0, L: 0, W: 1, H: 1 };

  function placeArc(e: Entry): void {
    const row = Math.floor(arc.j / arc.per);
    const k = arc.j % arc.per;
    const m = Math.min(arc.per, arc.n - row * arc.per);
    const off = k - (m - 1) / 2;
    ndc.set(((arc.W / 2 + off * arc.spPx) / arc.W) * 2 - 1, -((arc.y0 + row * arc.dy + off * off * 4) / arc.H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    e.arcP.copy(ray.ray.direction).multiplyScalar(arc.L).add(ray.ray.origin);
    e.arcSp = arc.spPx * arc.wpp;
    e.arcOn = true;
    arc.j++;
  }

  /** Éventail d'objets devant la caméra pour la zone au premier plan (maquette computeArc l.1130-1138). */
  function computeArc(zone: ZoneId): void {
    const { width: W, height: H } = o.viewport();
    let n = 0;
    for (const e of items) if (e.zone === zone) n++;
    if (n === 0) return;
    anchor(zone, va);
    arc.L = camera.position.distanceTo(va) * 0.6;
    const rows = n > 5 ? 2 : 1;
    arc.n = n;
    arc.per = Math.ceil(n / rows);
    arc.spPx = Math.min(W * 0.86, arc.per * ARC_PX_PER_ITEM) / Math.max(arc.per, 1);
    arc.y0 = Math.max((o.safeTop?.() ?? 0) + 112, H * 0.17);
    arc.dy = Math.min(96, arc.spPx * 1.05);
    arc.wpp = (2 * arc.L * Math.tan((camera.fov * Math.PI) / 360)) / H;
    arc.W = W;
    arc.H = H;
    arc.j = 0;
    for (const e of items) if (e.zone === zone) placeArc(e);
  }

  function clearArc(): void {
    for (const e of items) e.arcOn = false;
  }

  function step(dt: number, f: ObjectFrame): boolean {
    if (disposed) return false;
    const kp = damp(reducedMotion ? 60 : 11, dt);
    const ks = damp(reducedMotion ? 60 : 12, dt);
    const ex = f.ex;
    const bs = bag.group.scale;
    const zone = f.focus !== 'bag' && f.focus !== 'worn' && f.arcAmt > 0 ? f.focus : null;
    if (zone !== arcZone) { clearArc(); arcZone = zone; }
    if (zone) computeArc(zone);
    const arcK = f.arcAmt * (1 - ex);
    let moving = false;

    for (const e of items) {
      let s: number;
      if (e.zone === 'worn') {
        vc.copy(e.worn);
        s = e.base * clamp(1 - f.pos * 1.4, 0, 1);
      } else {
        bag.group.localToWorld(va.copy(e.local));
        vb.set(Math.sin(e.ea) * e.er, e.ey * bs.y + e.eyAdd, Math.cos(e.ea) * e.er).add(bag.group.position);
        vc.copy(va).lerp(vb, ex);
        s = e.base * 0.9 * ex;
        if (e.arcOn) {
          vc.lerp(e.arcP, arcK);
          s = Math.max(s, Math.min(e.base, e.arcSp * 0.55) * arcK);
        }
      }
      s *= e.consK;
      if (e.hasOv) {
        vc.copy(e.ov);
        if (e.ovTtl > 0) { e.ovTtl -= dt; if (e.ovTtl <= 0) e.hasOv = false; }
        moving = true;
      }
      const near = e.cur.distanceToSquared(vc) > 1e-6;
      const grow = Math.abs(s - e.sc) > 5e-4;
      if (near) e.cur.lerp(vc, kp); else e.cur.copy(vc);
      if (grow) e.sc += (s - e.sc) * ks; else e.sc = s;
      if (near || grow) moving = true;
      apply(e);
    }

    // Objets qui sortent : ils rejoignent leur point de chute (s'il y en a un) en rétrécissant.
    for (let i = dying.length - 1; i >= 0; i--) {
      const e = dying[i];
      e.t += dt;
      if (e.hasOv) e.cur.lerp(e.ov, damp(9, dt));
      e.sc += (0 - e.sc) * damp(10, dt);
      apply(e);
      if (e.t > DYING_S) {
        releaseEntry(e);
        dying[i] = dying[dying.length - 1];
        dying.pop();
      } else moving = true;
    }
    return moving;
  }

  function pick(nx: number, ny: number): RawPick | null {
    root.updateMatrixWorld(true);
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    const list: Object3D[] = [];
    for (const e of items) if (e.g.visible && e.sc > 0.02) list.push(e.g);
    const hi = ray.intersectObjects(list, true)[0];
    if (hi) {
      const u = hi.object.userData as { itemId?: string };
      if (u.itemId !== undefined) return { type: 'item', id: u.itemId };
    }
    const hb = ray.intersectObjects([...bag.pickables()], false)[0];
    if (hb) {
      const u = hb.object.userData as { zone: ZoneId; part: PartNameId; role: string };
      return { type: 'bag', zone: u.zone, part: u.role === 'web' ? 'webbing' : u.part };
    }
    return null;
  }

  function project(world: Vector3, out: { x: number; y: number }): { x: number; y: number } {
    const { width, height } = o.viewport();
    vd.copy(world).project(camera);
    out.x = ((vd.x + 1) / 2) * width;
    out.y = ((1 - vd.y) / 2) * height;
    return out;
  }

  return {
    sync,
    step,
    anchor,
    pick,
    projectItem(id, out) {
      const e = entries.get(id);
      if (!e) return null;
      return project(e.cur, out);
    },
    projectZone(zone, out) {
      bag.group.updateMatrixWorld();
      anchor(zone, vb);
      return project(vb, out);
    },
    canLift: (id) => entries.has(id),
    liftBegin(id) {
      const e = entries.get(id);
      if (!e) return false;
      lifted = e;
      e.ov.copy(e.cur);
      e.hasOv = true;
      e.ovTtl = 0;
      camera.getWorldDirection(vd);
      plane.setFromNormalAndCoplanarPoint(vd.negate(), e.cur);
      return true;
    },
    liftMove(nx, ny) {
      if (!lifted) return;
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) lifted.ov.copy(hit);
    },
    liftEnd(keep) {
      const e = lifted;
      lifted = null;
      if (!e) return;
      if (keep) e.ovTtl = HOLD_S; else e.hasOv = false;
    },
    counts: () => ({ items: items.length, dying: dying.length }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const e of items) releaseEntry(e);
      for (const e of dying) releaseEntry(e);
      items.length = 0;
      dying = [];
      entries.clear();
    },
  };
}
