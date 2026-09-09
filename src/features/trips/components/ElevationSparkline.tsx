import type { TripStep } from '../types/trip.types';

/**
 * Hub V5d — Sparkline d'élévation SVG (décoratif, aria-hidden).
 * Courbe d'aire : cumul altitude approché (gains/pertes par étape),
 * re-échelonné sur les bornes réelles [minM, maxM] quand fournies
 * (getTripElevationProfile) — sinon auto-normalisé. Tokens uniquement.
 */
export function ElevationSparkline({
  steps,
  bounds,
  width = 120,
  height = 44,
  className,
}: {
  steps: Pick<TripStep, 'elevation_gain_m' | 'elevation_loss_m'>[];
  /** Bornes d'altitude réelles (m) pour l'échelle verticale. */
  bounds?: { minM: number; maxM: number } | null;
  width?: number;
  height?: number;
  className?: string;
}) {
  const deltas = steps
    .map((s) => (Number(s.elevation_gain_m) || 0) - (Number(s.elevation_loss_m) || 0))
    .filter((d) => Number.isFinite(d));
  if (deltas.length < 2) return null;

  // Courbe cumulée approchée (l'altitude absolue n'existe pas par étape).
  let cursor = 0;
  const curve: number[] = [0];
  for (const d of deltas) {
    cursor += d;
    curve.push(cursor);
  }

  // Échelle verticale : bornes réelles si fournies, sinon auto-normalisée.
  const curveMin = Math.min(...curve);
  const curveMax = Math.max(...curve);
  const vMin = bounds && Number.isFinite(bounds.minM) && Number.isFinite(bounds.maxM) && bounds.maxM > bounds.minM
    ? bounds.minM
    : curveMin;
  const vMax = bounds && bounds.maxM > bounds.minM ? bounds.maxM : curveMax;
  const vSpan = Math.max(vMax - vMin, 1);

  const padX = 2;
  const innerW = Math.max(width - padX * 2, 1);
  const innerH = Math.max(height - 4, 1);
  const n = curve.length;

  const pts = curve.map((v, i) => ({
    x: padX + (i / (n - 1)) * innerW,
    y: height - 2 - ((v - vMin) / vSpan) * innerH,
  }));

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height - 2} ${line} ${(padX + innerW).toFixed(1)},${height - 2}`;
  const gradId = `lkv-elev-grad-${width}x${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lkv-secondary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--lkv-secondary)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke="var(--lkv-forest-600)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

export default ElevationSparkline;
