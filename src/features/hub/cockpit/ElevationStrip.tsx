'use client';

import type { CockpitStep } from './model';
import { DrawerSection, StatusBadge } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

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
  const height = 84;
  const padX = 12;
  const padY = 12;

  const coords = series.map((p) => ({
    ...p,
    x: padX + (p.dist / maxDist) * (width - padX * 2),
    y: height - padY - ((p.elev - minElev) / span) * (height - padY * 2),
  }));

  const polyline = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height - padY} ${polyline} ${(width - padX).toFixed(1)},${height - padY}`;

  return (
    <div role="region" aria-label="Profil de dénivelé des étapes">
      <DrawerSection
        title="Profil altimétrique du jour"
        right={<StatusBadge tone="good">+{Math.round(maxElev - minElev)} m · {cumulativeDist.toFixed(1)} km</StatusBadge>}
        padded
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="84" role="img" aria-label="Courbe de dénivelé des étapes du jour">
          <defs>
            <linearGradient id="hubElevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d7a52" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#3d7a52" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(23,43,36,0.1)" strokeWidth="1" />
          <polygon points={area} fill="url(#hubElevGrad)" />
          <polyline points={polyline} fill="none" stroke="#17402c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((p) => (
            <circle
              key={p.step.id}
              cx={p.x}
              cy={p.y}
              r="5"
              fill="#17402c"
              stroke="#ffffff"
              strokeWidth="2"
              style={{ cursor: onSelectStep ? 'pointer' : 'default' }}
              onClick={() => onSelectStep?.(p.step.id)}
            >
              <title>{`${p.step.title} (${Math.round(p.elev)} m)`}</title>
            </circle>
          ))}
        </svg>
        <p className={ds.heroSub}>Touchez un point du profil pour ouvrir le détail de l’étape.</p>
      </DrawerSection>
    </div>
  );
}
