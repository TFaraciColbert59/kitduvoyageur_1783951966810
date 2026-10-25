import type { TripStep } from '../types/trip.types';
import { projectTraceToSvg } from '../lib/traceSvg';

/**
 * Hub V5e — Mini-trace SVG statique de l'itinéraire (décoratif, aria-hidden).
 * Deux modes :
 *  - inline (défaut) : viewBox respecté, coins arrondis par le parent.
 *  - fullBleed : preserveAspectRatio="slice" pour COUVRIR toute la carte
 *    (fond média), trace renforcée + halo blanc + POIs visibles.
 * Tokens uniquement (antiHex). Fix ligne invisible : stops du dégradé
 * passés en style CSS (propriété) et non en attribut SVG.
 */
export function TraceMiniMap({
  steps,
  width = 240,
  height = 90,
  fullBleed = false,
  className,
}: {
  steps: Pick<TripStep, 'latitude' | 'longitude'>[];
  width?: number;
  height?: number;
  /** Mode fond de carte : couvre tout l'espace disponible. */
  fullBleed?: boolean;
  className?: string;
}) {
  const projected = projectTraceToSvg(
    steps
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({ lat: Number(s.latitude), lng: Number(s.longitude) })),
    width,
    height,
    fullBleed ? 6 : 10,
  );
  if (!projected) return null;

  const first = projected.markers[0];
  const last = projected.markers[projected.markers.length - 1];
  const middle = projected.markers.slice(1, -1);
  const gradId = `lkv-trace-grad-${width}x${height}`;
  const strokeWidth = fullBleed ? 3.5 : 2.5;
  const dotR = fullBleed ? 4 : 2.6;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio={fullBleed ? 'xMidYMid slice' : 'xMidYMid meet'}
      className={fullBleed ? 'h-full w-full' : className}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--lkv-secondary)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--lkv-primary)' }} />
        </linearGradient>
      </defs>
      {/* Halo : la trace reste lisible sur tout fond. */}
      <polyline
        fill="none"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={strokeWidth + 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={projected.polyline}
      />
      <polyline
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={projected.polyline}
      />
      {middle.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={dotR} fill="var(--lkv-forest-300)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      ))}
      <circle
        cx={first.x}
        cy={first.y}
        r={dotR + 0.6}
        fill="var(--lkv-primary)"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.4"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={dotR}
        fill="var(--lkv-surface-card)"
        stroke="var(--lkv-primary)"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export default TraceMiniMap;
