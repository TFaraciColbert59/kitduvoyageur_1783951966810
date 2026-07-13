import React from 'react';

interface TopoSeparatorProps {
  inverted?: boolean;
  color?: string;
  className?: string;
}

export default function TopoSeparator({ inverted = false, color = '#E7E3D6', className = '' }: TopoSeparatorProps) {
  return (
    <div className={`topo-separator ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: '48px', transform: inverted ? 'scaleY(-1)' : 'none' }}
        fill={color}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0,30 C120,50 240,10 360,30 C480,50 600,10 720,30 C840,50 960,10 1080,30 C1200,50 1320,10 1440,30 L1440,60 L0,60 Z" />
        <path
          d="M0,40 C180,20 360,55 540,40 C720,25 900,55 1080,40 C1260,25 1380,50 1440,40"
          fill="none"
          stroke={color}
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}