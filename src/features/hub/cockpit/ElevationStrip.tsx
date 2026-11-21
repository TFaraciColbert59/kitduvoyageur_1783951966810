'use client';

import type { CockpitStep } from './model';
import styles from './cockpit.module.css';

export function ElevationStrip({ steps, onSelectStep }: {
  steps: CockpitStep[];
  onSelectStep?: (stepId: string) => void;
}) {
  const points = steps.filter((s) => s.elevation != null || s.distance != null);
  if (points.length < 2) return null;

  let cumulativeDist = 0;
  let cumulativeElev = 0;
  const series = points.map((step, index) => {
    if (index > 0) {
      cumulativeDist += Math.max(0.1, step.distance ?? 1);
      cumulativeElev += step.elevation ?? 0;
    } else {
      cumulativeElev = step.elevation ?? 0;
    }
    return { step, dist: cumulativeDist, elev: cumulativeElev };
  });

  const maxDist = Math.max(1, series.at(-1)?.dist ?? 1);
  const elevValues = series.map((p) => p.elev);
  const minElev = Math.min(...elevValues);
  const maxElev = Math.max(...elevValues);
  const span = Math.max(10, maxElev - minElev);

  const width = 320;
  const height = 64;
  const padX = 10;
  const padY = 10;

  const coords = series.map((p) => ({
    ...p,
    x: padX + (p.dist / maxDist) * (width - padX * 2),
    y: height - padY - ((p.elev - minElev) / span) * (height - padY * 2),
  }));

  const polyline = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height - padY} ${polyline} ${(width - padX).toFixed(1)},${height - padY}`;

  return (
    <div role="region" aria-label="Profil de dénivelé des étapes" className={styles.stepExecution}>
      <p className={styles.meta}>
        Profil du jour · {series.length} points · +{Math.round(maxElev - minElev)} m cumulé
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="64" role="img" aria-label="Courbe de dénivelé des étapes du jour">
        <polygon points={area} fill="currentColor" opacity="0.12" />
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <circle
            key={p.step.id}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="currentColor"
            style={{ cursor: onSelectStep ? 'pointer' : 'default' }}
            onClick={() => onSelectStep?.(p.step.id)}
          >
            <title>{`${p.step.title} (${Math.round(p.elev)} m)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
