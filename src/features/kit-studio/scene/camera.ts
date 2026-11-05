// Caméra minimale synchronisée au tiroir (SPEC-DRAWER §Caméra ; maquette l.1111-1125, 1163-1193).
// `dk` suit `dkT` (0 tiroir fermé, 1,7 ouvert) avec un amortissement exponentiel (taux 3,6 ; 60 en mouvement réduit).
// Décalage de vue yoff = lerp(−0,095 ; 0,035 ; dk) × hauteur ; zoom = 1 + (1 − dk) × 0,05.
import { PerspectiveCamera } from 'three';
import { ZONES } from '../domain/catalog';
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

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  setViewport(width: number, height: number): void;
  /** Point regardé (centre du sac, en coordonnées monde). */
  setFocus(x: number, y: number, z: number): void;
  setDrawerOpen(open: boolean): void;
  /** Valeur courante (amortie) de dk. */
  dk(): number;
  /** Avance l'amortissement et replace la caméra ; true tant que dk n'a pas rejoint sa cible. */
  step(dt: number): boolean;
}

export function createCameraRig(options: { readonly reducedMotion: boolean }): CameraRig {
  const camera = new PerspectiveCamera(36, 1, 0.05, 60);
  const zone = ZONES.find((z) => z.id === 'bag') ?? { id: 'bag', n: 'Sac', th: -0.6, ph: 1.2, d: 5 };
  let w = 1;
  let h = 1;
  let aspectK = 1;
  let dk = DRAWER_CLOSED;
  let dkT = DRAWER_CLOSED;
  let fx = 0;
  let fy = GROUND_Y + 0.725;
  let fz = 0;
  let appliedYoff = Number.NaN;

  function place(): void {
    const ph = clamp(zone.ph, 0.35, 1.62);
    const di = zone.d * aspectK;
    camera.position.set(fx + di * Math.sin(ph) * Math.sin(zone.th), fy + di * Math.cos(ph), fz + di * Math.sin(ph) * Math.cos(zone.th));
    camera.position.y = Math.max(camera.position.y, GROUND_Y + 0.15);
    camera.lookAt(fx, fy - (0.17 * di) / 3.6, fz);
    const yoff = viewOffsetFraction(dk) * h;
    if (yoff !== appliedYoff) {
      if (Math.abs(yoff) > 0.5) camera.setViewOffset(w, h, 0, yoff, w, h);
      else if (camera.view && camera.view.enabled) camera.clearViewOffset();
      appliedYoff = yoff;
    }
    const zt = zoomFor(dk);
    if (Math.abs(camera.zoom - zt) > 0.0004) { camera.zoom = zt; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
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
    setDrawerOpen(open) { dkT = open ? DRAWER_OPEN : DRAWER_CLOSED; },
    dk: () => dk,
    step(dt) {
      dk += (dkT - dk) * damp(options.reducedMotion ? DK_RATE_REDUCED : DK_RATE, dt);
      const moving = Math.abs(dkT - dk) > 0.001;
      if (!moving) dk = dkT;
      place();
      return moving;
    },
  };
}
