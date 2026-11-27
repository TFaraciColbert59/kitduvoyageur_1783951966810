'use client';

import React, { useMemo } from 'react';

export interface RouteMiniTraceSvgProps {
  geojson: unknown;
  width?: number;
  height?: number;
  strokeColor?: string;
  className?: string;
}

type LngLat = [number, number];

function extractLineSegments(geojson: unknown): LngLat[][] {
  if (!geojson || typeof geojson !== 'object') return [];
  const obj = geojson as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : null;

  if (type === 'Feature') {
    return extractLineSegments(obj.geometry);
  }
  if (type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features.flatMap((feature) => extractLineSegments(feature));
  }
  if (type === 'GeometryCollection' && Array.isArray(obj.geometries)) {
    return obj.geometries.flatMap((geom) => extractLineSegments(geom));
  }
  if (type === 'LineString' && Array.isArray(obj.coordinates)) {
    const pts = toLngLatArray(obj.coordinates);
    return pts.length >= 2 ? [pts] : [];
  }
  if (type === 'MultiLineString' && Array.isArray(obj.coordinates)) {
    const segments: LngLat[][] = [];
    for (const line of obj.coordinates) {
      if (Array.isArray(line)) {
        const pts = toLngLatArray(line);
        if (pts.length >= 2) segments.push(pts);
      }
    }
    return segments;
  }
  return [];
}

function toLngLatArray(raw: unknown[]): LngLat[] {
  const out: LngLat[] = [];
  for (const item of raw) {
    if (
      Array.isArray(item) &&
      typeof item[0] === 'number' &&
      typeof item[1] === 'number' &&
      Number.isFinite(item[0]) &&
      Number.isFinite(item[1])
    ) {
      out.push([item[0], item[1]]);
    }
  }
  return out;
}

function decimateSegment(pts: LngLat[], maxPoints: number): LngLat[] {
  if (pts.length <= maxPoints) return pts;
  const out: LngLat[] = [];
  const lastIdx = pts.length - 1;
  const step = lastIdx / (maxPoints - 1);
  for (let i = 0; i < maxPoints - 1; i += 1) {
    out.push(pts[Math.round(i * step)]);
  }
  out.push(pts[lastIdx]);
  return out;
}

interface ProjectedTrace {
  polylines: string[];
  start: [number, number];
  end: [number, number];
  isLoop: boolean;
}

function projectSegments(
  segments: LngLat[][],
  width: number,
  height: number,
): ProjectedTrace | null {
  if (segments.length === 0) return null;
  const allPts = segments.flat();
  if (allPts.length < 2) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of allPts) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos(midLatRad));
  const rawW = (maxLon - minLon) * cosLat;
  const rawH = maxLat - minLat;

  const pad = Math.max(8, Math.min(width, height) * 0.14);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const safeW = rawW > 1e-7 ? rawW : 1e-4;
  const safeH = rawH > 1e-7 ? rawH : 1e-4;
  const scale = Math.min(innerW / safeW, innerH / safeH);

  const projW = rawW * scale;
  const projH = rawH * scale;
  const offsetX = pad + (innerW - projW) / 2;
  const offsetY = pad + (innerH - projH) / 2;

  const toScreen = ([lon, lat]: LngLat): [number, number] => [
    Number((offsetX + (lon - minLon) * cosLat * scale).toFixed(1)),
    Number((offsetY + (maxLat - lat) * scale).toFixed(1)),
  ];

  const decimated = segments.map((seg) => decimateSegment(seg, 96));
  const polylines = decimated.map((seg) =>
    seg
      .map((pt) => {
        const [x, y] = toScreen(pt);
        return `${x},${y}`;
      })
      .join(' '),
  );

  const firstPt = decimated[0][0];
  const lastSeg = decimated[decimated.length - 1];
  const lastPt = lastSeg[lastSeg.length - 1];
  const start = toScreen(firstPt);
  const end = toScreen(lastPt);
  const distPx = Math.hypot(end[0] - start[0], end[1] - start[1]);

  return {
    polylines,
    start,
    end,
    isLoop: distPx < 6,
  };
}

/**
 * Pure SVG mini polyline preview for any GeoJSON LineString/MultiLineString,
 * with subtle topographic contour fallback when geometry is not yet available.
 */
export function RouteMiniTraceSvg({
  geojson,
  width = 160,
  height = 100,
  strokeColor = '#17402C',
  className,
}: RouteMiniTraceSvgProps) {
  const projected = useMemo(() => {
    const segments = extractLineSegments(geojson);
    return projectSegments(segments, width, height);
  }, [geojson, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      {/* Subtle topographic contour lines */}
      <g fill="none" stroke="#17402C" strokeOpacity={0.075} strokeWidth={1}>
        <path
          d={`M ${-width * 0.08} ${height * 0.78} Q ${width * 0.28} ${height * 0.56}, ${width * 0.54} ${height * 0.68} T ${width * 1.08} ${height * 0.44}`}
        />
        <path
          d={`M ${-width * 0.05} ${height * 0.52} Q ${width * 0.34} ${height * 0.26}, ${width * 0.64} ${height * 0.42} T ${width * 1.08} ${height * 0.2}`}
        />
        <path
          d={`M ${width * 0.14} ${height * 1.04} Q ${width * 0.52} ${height * 0.78}, ${width * 0.88} ${height * 0.92} T ${width * 1.1} ${height * 0.72}`}
        />
      </g>

      {projected ? (
        <g>
          {/* Ivory halo */}
          {projected.polylines.map((points, idx) => (
            <polyline
              key={`halo-${idx}`}
              points={points}
              fill="none"
              stroke="rgba(251, 250, 246, 0.86)"
              strokeWidth={4.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* Primary forest route stroke */}
          {projected.polylines.map((points, idx) => (
            <polyline
              key={`line-${idx}`}
              points={points}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* Start dot */}
          <circle
            cx={projected.start[0]}
            cy={projected.start[1]}
            r={3.5}
            fill="#5B7F55"
            stroke="#FBFAF6"
            strokeWidth={1.6}
          />
          {/* End dot (distinct if not a closed loop) */}
          {!projected.isLoop ? (
            <circle
              cx={projected.end[0]}
              cy={projected.end[1]}
              r={3.5}
              fill={strokeColor}
              stroke="#FBFAF6"
              strokeWidth={1.6}
            />
          ) : null}
        </g>
      ) : (
        /* Topographic contour curve fallback when geometry isn't loaded yet */
        <g fill="none">
          <path
            d={`M ${width * 0.14} ${height * 0.74} C ${width * 0.34} ${height * 0.68}, ${width * 0.42} ${height * 0.34}, ${width * 0.62} ${height * 0.38} S ${width * 0.82} ${height * 0.58}, ${width * 0.88} ${height * 0.28}`}
            stroke={strokeColor}
            strokeOpacity={0.32}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
          <circle
            cx={width * 0.14}
            cy={height * 0.74}
            r={3}
            fill="#5B7F55"
            fillOpacity={0.55}
          />
          <circle
            cx={width * 0.88}
            cy={height * 0.28}
            r={3}
            fill={strokeColor}
            fillOpacity={0.55}
          />
        </g>
      )}
    </svg>
  );
}

export default RouteMiniTraceSvg;
