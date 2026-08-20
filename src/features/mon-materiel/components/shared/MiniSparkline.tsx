import React from 'react';

/**
 * MiniSparkline: small inline SVG line chart.
 * Accepts an array of numbers as data.
 * Renders a simple path with no interactions.
 */
interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 20,
  stroke = '#2D5A3D',
  strokeWidth = 2,
  className = '',
}: MiniSparklineProps) {
  if (!data.length) {
    return <span className={className}>–</span>;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = ((max - v) / (max - min)) * height; // invert y
      return `${x},${y}`;
    })
    .join(' ');

  const path = `M ${points}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}
