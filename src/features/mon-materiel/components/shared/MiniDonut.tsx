'use client';
/**
 * LKDV — MiniDonut : donut SVG inline pour répartition par catégorie.
 * Simple, sans dépendance externe.
 */
import React from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // hex
}

interface MiniDonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function MiniDonut({ segments, size = 48, strokeWidth = 8, className = '' }: MiniDonutProps) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  return (
    <svg width={size} height={size} className={className} aria-hidden>
      {segments.map((seg) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const rotate = offset * 360 - 90;
        offset += pct;
        return (
          <circle
            key={seg.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        );
      })}
    </svg>
  );
}
