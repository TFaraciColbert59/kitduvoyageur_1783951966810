/**
 * Suivi d'activité (04_CARTE §4, P7-16).
 *
 * Reçoit des positions GPS et produit les métriques du direct : distance,
 * dénivelé positif, temps en mouvement. Règles produit :
 *   - une position dont la précision dépasse 30 m est ignorée ;
 *   - lissage exponentiel de l'altitude (le GPS de montagne oscille de ±10 m) ;
 *   - le mouvement n'est compté qu'au-delà de 0,3 m/s ;
 *   - un saut de plus de 100 m en moins de 2 s est rejeté (perte de fix).
 *
 * Aucune dépendance : utilisable dans le worker, dans les tests et sur le web.
 */

export interface GpsFix {
  t: number;
  lat: number;
  lng: number;
  ele?: number | null;
  /** Précision horizontale en mètres. */
  acc?: number | null;
  speed?: number | null;
}

export interface ActivityMetrics {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  lastFix: GpsFix | null;
  rejected: number;
}

export const MAX_ACCURACY_M = 30;
export const MIN_MOVING_SPEED_MS = 0.3;
export const MAX_JUMP_M = 100;
export const MAX_JUMP_WINDOW_S = 2;
const ELE_SMOOTHING = 0.25;

export function haversineM(a: GpsFix, b: GpsFix): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export class ActivityTracker {
  private metrics: ActivityMetrics = {
    distanceM: 0,
    elevGainM: 0,
    movingS: 0,
    lastFix: null,
    rejected: 0,
  };

  private smoothedEle: number | null = null;

  get state(): ActivityMetrics {
    return { ...this.metrics };
  }

  addFix(fix: GpsFix): ActivityMetrics {
    if (fix.acc !== undefined && fix.acc !== null && fix.acc > MAX_ACCURACY_M) {
      this.metrics.rejected += 1;
      return this.state;
    }

    const previous = this.metrics.lastFix;
    if (!previous) {
      this.metrics.lastFix = fix;
      this.smoothedEle = fix.ele ?? null;
      return this.state;
    }

    const dtS = Math.max(0, (fix.t - previous.t) / 1000);
    const distance = haversineM(previous, fix);

    // Perte de fix : saut impossible dans un laps de temps très court.
    if (dtS > 0 && dtS <= MAX_JUMP_WINDOW_S && distance > MAX_JUMP_M) {
      this.metrics.rejected += 1;
      return this.state;
    }

    this.metrics.distanceM += distance;

    const speed = fix.speed ?? (dtS > 0 ? distance / dtS : 0);
    if (speed > MIN_MOVING_SPEED_MS) this.metrics.movingS += dtS;

    if (typeof fix.ele === 'number') {
      const smoothed =
        this.smoothedEle === null ? fix.ele : this.smoothedEle + ELE_SMOOTHING * (fix.ele - this.smoothedEle);
      if (this.smoothedEle !== null && smoothed > this.smoothedEle) {
        this.metrics.elevGainM += smoothed - this.smoothedEle;
      }
      this.smoothedEle = smoothed;
    }

    this.metrics.lastFix = fix;
    return this.state;
  }
}

/** Vitesse moyenne de déplacement (km/h) sur les mesures en mouvement. */
export function averageSpeedKmh(metrics: ActivityMetrics): number | null {
  if (metrics.movingS <= 0) return null;
  return (metrics.distanceM / metrics.movingS) * 3.6;
}
