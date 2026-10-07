/**
 * Tracé réel d'un itinéraire préparé : la géométrie de chaque tronçon routé
 * (route, chemin, piste cyclable), simplifiée, plutôt que des segments droits
 * entre les soirs. Pur et testé : la carte l'affiche tant que les étapes n'ont
 * pas bougé (signature des positions).
 */

export type LngLat = [number, number];

/** Au plus `max` points, extrémités gardées (décimation régulière). */
export function simplifyLine(coords: ReadonlyArray<readonly [number, number]>, max = 150): LngLat[] {
  const pts = coords
    .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5] as LngLat);
  if (pts.length <= max) return pts;
  const out: LngLat[] = [];
  const step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(pts[Math.round(i * step)]);
  return out;
}

/** Signature des positions des étapes, dans l'ordre (3 décimales ≈ 100 m). */
export function trackKey(points: ReadonlyArray<{ lat: number; lon: number }>): string {
  return points.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(';');
}

/**
 * Tronçons d'un soir au suivant : la géométrie routée quand elle existe, sinon
 * un segment droit (vol, bateau, tronçon non calculé). Null s'il n'y a rien à
 * tracer de plus que des segments droits.
 */
export function buildTrack(
  stops: ReadonlyArray<{ lat: number; lon: number }>,
  legs: ReadonlyArray<ReadonlyArray<readonly [number, number]> | null>
): { type: 'MultiLineString'; coordinates: LngLat[][] } | null {
  const lines: LngLat[][] = [];
  let routed = false;
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1];
    const b = stops[i];
    if (Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4) continue;
    const g = legs[i];
    if (g && g.length >= 2) {
      lines.push(simplifyLine(g));
      routed = true;
    } else {
      lines.push([
        [a.lon, a.lat],
        [b.lon, b.lat],
      ]);
    }
  }
  return routed ? { type: 'MultiLineString', coordinates: lines } : null;
}
