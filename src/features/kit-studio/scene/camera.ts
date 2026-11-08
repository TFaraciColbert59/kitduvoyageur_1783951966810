// Caméra de la scène (SPEC-DRAWER §Caméra, SPEC-3D ; maquette l.1111-1125 et l.1163-1193).
//  - Tiroir : `dk` suit `dkT` (0 fermé, 1,7 ouvert), amortissement exponentiel (taux 3,6 ; 60 en mouvement réduit).
//    Décalage de vue yoff = lerp(−0,095 ; 0,035 ; dk) × hauteur ; zoom = 1 + (1 − dk) × 0,05.
//  - Zones : la caméra parcourt les ZONES (Sur toi, Sac, Couvercle, Principal…) sur une position continue `s`
//    (ressort amorti) ; chaque zone fixe l'azimut, la hauteur, la distance et l'ancre regardée.
//  - Inclinaison (tilt) et pièces séparées (ex) : cibles amorties. Mouvement réduit = aucun amortissement.
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { ZONES } from '../domain/catalog';
import type { ZoneId } from '../domain/catalog';
import { GROUND_Y } from './layout';
import { clamp, damp, lerp } from './math';

export const DRAWER_CLOSED = 0;
export const DRAWER_OPEN = 1.7;
export const DK_RATE = 3.6;
export const DK_RATE_REDUCED = 60;

/** Décalage vertical de la vue, en fraction de la hauteur d'écran. */
export const viewOffsetFraction = (dk: number): number => lerp(-0.095, 0.035, dk);
/** Zoom caméra selon l'ouverture du tiroir. */
export const zoomFor = (dk: number): number => 1 + (1 - dk) * 0.05;

/** Raideur et amortissement du ressort de zone (maquette l.1166 : k = 120, c = 2√k × 0,88). */
const SPRING_K = 120;
const SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.88;
/** Plage d'inclinaison (rad) et élasticité hors des bornes de zones. */
export const TILT_MAX = 0.32;
const RUBBER = 0.35;

const ZONE_COUNT = ZONES.length;
const ZONE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));
const BAG_INDEX = ZONE_INDEX.bag ?? 1;

/** Ce que la caméra doit connaître du monde : ancre d'une zone, centre du sac et boîte englobante de l'ensemble (sac + modules). */
export interface CameraWorld {
  anchor(zone: ZoneId, out: Vector3): Vector3;
  center(out: Vector3): Vector3;
  bounds?(out: Box3): Box3;
}

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  setViewport(width: number, height: number): void;
  /** Point regardé quand aucun monde n'est fourni (tests) : centre du sac, en coordonnées monde. */
  setFocus(x: number, y: number, z: number): void;
  setWorld(world: CameraWorld): void;
  setDrawerOpen(open: boolean): void;
  /** Valeur courante (amortie) de dk. */
  dk(): number;

  /** Va à une zone (animé, ou immédiat en mouvement réduit). */
  goZone(zone: ZoneId | number): void;
  /** Zone la plus proche de la position courante. */
  zoneId(): ZoneId;
  zoneIndex(): number;
  /** Zone visée (arrondie) : les flèches du clavier s'empilent sur la cible, pas sur la position en cours. */
  targetIndex(): number;
  /** Position continue sur la liste des zones (0 = Sur toi, 1 = Sac, …). */
  position(): number;
  /** Orbite : suit le doigt (élastique aux extrémités), sans ressort. */
  scrub(s: number): void;
  /** Fin d'orbite : vitesse (zones/s) → zone d'arrivée. */
  release(velocity: number): void;
  /** Première zone atteignable (0 en Gestion ; 1 = Sac en Apparence, où « Sur toi » n'existe pas). */
  setLowestZone(index: number): void;
  /** Azimut (rad) et hauteur (rad depuis le zénith) courants. */
  angle(): number;
  polar(): number;
  /** Inclinaison verticale : cible (rad, bornée) et valeur courante. */
  setTilt(t: number): void;
  tilt(): number;
  /** Pièces séparées : cible 0..1 (bornée) ; valeur courante. */
  setExploded(v: number): void;
  explodedTarget(): number;
  exploded(): number;
  /** Mise en avant de la zone courante (0..1), nulle hors Gestion. */
  arcAmount(): number;
  setArcEnabled(enabled: boolean): void;
  /** Recentrer : retour à la vue du sac, sans inclinaison, pièces rassemblées. */
  recenter(): void;
  /** Rappelé quand la zone la plus proche change. */
  onZoneChange(listener: ((zone: ZoneId) => void) | null): void;
  viewport(): { readonly width: number; readonly height: number };

  /** Avance les amortissements (sans replacer la caméra) ; true tant que quelque chose bouge. */
  advance(dt: number): boolean;
  /** Replace la caméra d'après l'état courant (le monde doit être à jour). */
  place(): void;
  /** advance() puis place(). */
  step(dt: number): boolean;
}

export function createCameraRig(options: { readonly reducedMotion: boolean }): CameraRig {
  const rm = options.reducedMotion;
  const camera = new PerspectiveCamera(36, 1, 0.05, 60);
  let w = 1;
  let h = 1;
  let aspectK = 1;
  let dk = DRAWER_CLOSED;
  let dkT = DRAWER_CLOSED;
  let fx = 0;
  let fy = GROUND_Y + 0.725;
  let fz = 0;
  let appliedYoff = Number.NaN;
  let world: CameraWorld | null = null;
  const tempBox = new Box3();
  let adaptiveDistTarget = 2.2;
  let adaptiveDistCurrent = 2.2;
  let adaptiveCenterY = GROUND_Y + 0.725;

  // Zones
  let s = BAG_INDEX;
  let sT = BAG_INDEX;
  let sV = 0;
  let lowest = 0;
  let zi = BAG_INDEX;
  let scrubbing = false;
  let listener: ((zone: ZoneId) => void) | null = null;
  let tiltV = 0;
  let tiltT = 0;
  let ex = 0;
  let exT = 0;
  let arcEnabled = true;
  let arc = 0;
  let theta = ZONES[BAG_INDEX]?.th ?? 0;
  let phi = ZONES[BAG_INDEX]?.ph ?? 1;
  let wornW = 0;

  // Vecteurs réutilisés : aucune allocation à l'image.
  const tgt = new Vector3();
  const va = new Vector3();
  const vb = new Vector3();
  const bagC = new Vector3();

  const clampZone = (v: number): number => clamp(v, lowest, ZONE_COUNT - 1);
  const rubber = (v: number): number => {
    const m = ZONE_COUNT - 1;
    return v < lowest ? lowest + (v - lowest) * RUBBER : v > m ? m + (v - m) * RUBBER : v;
  };
  const arcFactor = (): number => {
    if (!arcEnabled) return 0;
    const id = ZONES[zi]?.id;
    if (id === 'bag' || id === 'worn') return 0;
    return clamp(1 - Math.abs(s - zi) * 2.2, 0, 1);
  };

  function place(): void {
    if (world?.bounds) {
      world.bounds(tempBox);
      if (!tempBox.isEmpty()) {
        const spanY = Math.max(0.2, tempBox.max.y - tempBox.min.y);
        const spanX = Math.max(0.1, tempBox.max.x - tempBox.min.x);
        const spanZ = Math.max(0.1, tempBox.max.z - tempBox.min.z);
        const spanHoriz = Math.max(spanX, spanZ);
        adaptiveCenterY = (tempBox.min.y + tempBox.max.y) * 0.5;

        // Cadrage adaptatif : 75% à 80% (cible 78%) de la hauteur utile au-dessus du tiroir
        // Le tiroir mange près de 40% de l'écran en position déployée (dk = 1.7)
        const drawerCoverage = clamp((dk / DRAWER_OPEN) * 0.38, 0, 0.42);
        const visibleHeightFraction = Math.max(0.5, 1 - drawerCoverage);

        const TARGET_OCCUPANCY = 0.78;
        const reqH = spanY / (TARGET_OCCUPANCY * visibleHeightFraction);
        const reqW = spanHoriz / TARGET_OCCUPANCY;
        const reqHFromW = reqW / Math.max(0.2, camera.aspect);
        const effectiveH = Math.max(reqH, reqHFromW);

        const fovRad = (camera.fov * Math.PI) / 180;
        const halfTan = Math.tan(fovRad * 0.5);
        adaptiveDistTarget = clamp(effectiveH / (2 * halfTan), 0.9, 8.0);
      }
    }

    const n = ZONE_COUNT;
    const i = clamp(Math.floor(s), 0, n - 2);
    const f = s - i;
    const A = ZONES[i];
    const B = ZONES[i + 1];
    theta = lerp(A.th, B.th, f);
    phi = lerp(A.ph, B.ph, f);
    const dA = A.id === 'bag' ? adaptiveDistCurrent : A.d * (adaptiveDistCurrent / 5.0);
    const dB = B.id === 'bag' ? adaptiveDistCurrent : B.d * (adaptiveDistCurrent / 5.0);
    let di = lerp(dA, dB, f);
    let ph = phi + tiltV;
    if (world) {
      world.anchor(A.id, va);
      world.anchor(B.id, vb);
      tgt.copy(va).lerp(vb, clamp(f, 0, 1));
      world.center(bagC);
      bagC.y = adaptiveCenterY;
      wornW = A.id === 'worn' ? clamp(1 - f, 0, 1) : 0;
      tgt.lerp(bagC, Math.max(ex * 0.75, 0.38 * (1 - wornW)));
    } else {
      tgt.set(fx, fy, fz);
    }
    di *= 1 + ex * (camera.aspect < 0.75 ? 0.55 : 0.32);
    di *= aspectK;
    ph = clamp(ph, 0.35, 1.62);
    camera.position.set(tgt.x + di * Math.sin(ph) * Math.sin(theta), tgt.y + di * Math.cos(ph), tgt.z + di * Math.sin(ph) * Math.cos(theta));
    camera.position.y = Math.max(camera.position.y, GROUND_Y + 0.15);
    camera.lookAt(tgt.x, tgt.y - (0.17 * di) / 3.6, tgt.z);
    // Le sac se recentre au-dessus du tiroir : glissement et léger recul, amortis (dk de 0, fermé, à 1,7, ouvert).
    const yoff = viewOffsetFraction(dk) * h - arc * (1 - ex) * h * 0.16;
    if (yoff !== appliedYoff) {
      if (Math.abs(yoff) > 0.5) camera.setViewOffset(w, h, 0, yoff, w, h);
      else if (camera.view && camera.view.enabled) camera.clearViewOffset();
      appliedYoff = yoff;
    }
    const zt = zoomFor(dk);
    if (Math.abs(camera.zoom - zt) > 0.0004) { camera.zoom = zt; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  function advance(dt: number): boolean {
    let moving = false;
    // Drawer
    dk += (dkT - dk) * damp(rm ? DK_RATE_REDUCED : DK_RATE, dt);
    if (Math.abs(dkT - dk) > 0.001) moving = true; else dk = dkT;

    // Transition continue de cadrage adaptatif : 400 à 500 ms (taux 7.0), courbe sortante.
    const kDist = rm ? 60 : 7.0;
    if (Math.abs(adaptiveDistTarget - adaptiveDistCurrent) > 0.001) {
      adaptiveDistCurrent += (adaptiveDistTarget - adaptiveDistCurrent) * (rm ? 1 : damp(kDist, dt));
      moving = true;
    } else {
      adaptiveDistCurrent = adaptiveDistTarget;
    }

    // Zone : ressort amorti vers la cible (la main qui orbite impose `s` directement).
    if (scrubbing) {
      moving = true;
    } else if (rm) {
      if (s !== sT) { s = sT; moving = true; }
      sV = 0;
    } else {
      const a = SPRING_K * (sT - s) - SPRING_C * sV;
      sV += a * dt;
      s += sV * dt;
      if (Math.abs(sT - s) < 0.0006 && Math.abs(sV) < 0.002) { s = sT; sV = 0; } else moving = true;
    }
    const nz = clamp(Math.round(s), 0, ZONE_COUNT - 1);
    if (nz !== zi) { zi = nz; listener?.(ZONES[zi].id); }

    const kt = damp(10, dt);
    if (Math.abs(tiltT - tiltV) > 0.0008) { tiltV += (tiltT - tiltV) * (rm ? 1 : kt); moving = true; } else tiltV = tiltT;
    const ke = damp(rm ? 60 : 7, dt);
    if (Math.abs(exT - ex) > 0.001) { ex = rm ? exT : ex + (exT - ex) * ke; moving = true; } else ex = exT;
    arc = arcFactor();
    return moving;
  }

  return {
    camera,
    setViewport(width, height) {
      w = Math.max(1, width);
      h = Math.max(1, height);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.75 ? 40 : 31;
      camera.updateProjectionMatrix();
      aspectK = camera.aspect < 0.6 ? 1.12 : camera.aspect > 1.3 ? 0.92 : 1;
      appliedYoff = Number.NaN;
      place();
    },
    setFocus(x, y, z) { fx = x; fy = y; fz = z; },
    setWorld(next) { world = next; },
    setDrawerOpen(open) { dkT = open ? DRAWER_OPEN : DRAWER_CLOSED; },
    dk: () => dk,

    goZone(zone) {
      const idx = typeof zone === 'number' ? Math.round(zone) : ZONE_INDEX[zone];
      if (idx === undefined || Number.isNaN(idx)) return;
      scrubbing = false;
      sT = clampZone(idx);
    },
    zoneId: () => ZONES[zi].id,
    zoneIndex: () => zi,
    targetIndex: () => Math.round(sT),
    position: () => s,
    scrub(v) {
      scrubbing = true;
      s = rubber(v);
      sT = s;
      sV = 0;
    },
    release(velocity) {
      scrubbing = false;
      sV = clamp(velocity, -14, 14);
      sT = clampZone(Math.round(s + sV * 0.16));
      if (rm) sV = 0;
    },
    setLowestZone(index) {
      lowest = clamp(Math.round(index), 0, ZONE_COUNT - 1);
      if (sT < lowest) sT = lowest;
    },
    angle: () => theta,
    polar: () => phi,
    setTilt(t) { tiltT = clamp(t, -TILT_MAX, TILT_MAX); },
    tilt: () => tiltV,
    setExploded(v) { exT = clamp(v, 0, 1); },
    explodedTarget: () => exT,
    exploded: () => ex,
    arcAmount: () => arc,
    setArcEnabled(enabled) { arcEnabled = enabled; },
    recenter() {
      scrubbing = false;
      sT = BAG_INDEX;
      tiltT = 0;
      exT = 0;
    },
    onZoneChange(fn) { listener = fn; },
    viewport: () => ({ width: w, height: h }),

    advance,
    place,
    step(dt) {
      const moving = advance(dt);
      place();
      return moving;
    },
  };
}
