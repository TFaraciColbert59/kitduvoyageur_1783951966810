import type { TripStep } from '../types/trip.types';
import { projectTraceToSvg } from '../lib/traceSvg';

/**
 * Hub V5d — Mini-trace SVG statique de l'itinéraire (décoratif, aria-hidden).
 * Dégradé secondary→primary, dot de départ plein, anneau d'arrivée, points
 * d'étapes. Zéro Leaflet, zéro JS client, tokens uniquement (antiHex).
 */
export function TraceMiniMap({
  steps,
  width = 240,
  height = 90,
  className,
}: {
  steps: Pick<TripStep, 'latitude' | 'longitude'>[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const projected = projectTraceToSvg(
    steps
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({ lat: Number(s.latitude), lng: Number(s.longitude) })),
    width,
    height,
  );
  if (!projected) return null;

  const first = projected.markers[0];
  const last = projected.markers[projected.markers.length - 1];
  const middle = projected.markers.slice(1, -1);
  const gradId = `lkv-trace-grad-${width}x${height}`;

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
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--lkv-secondary)" />
          <stop offset="100%" stopColor="var(--lkv-primary)" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={projected.polyline}
      />
      {middle.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r="2.2" fill="var(--lkv-forest-300)" />
      ))}
      <circle cx={first.x} cy={first.y} r="3.4" fill="var(--lkv-primary)" />
      <circle
        cx={last.x}
        cy={last.y}
        r="3.2"
        fill="var(--lkv-surface-card)"
        stroke="var(--lkv-primary)"
        strokeWidth="2"
      />
    </svg>
  );
}

export default TraceMiniMap;
