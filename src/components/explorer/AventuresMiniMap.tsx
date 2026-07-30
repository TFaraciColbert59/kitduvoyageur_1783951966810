'use client';

import React from 'react';

const PINS = [
  { id: 1, x: '22%', y: '35%', selected: false },
  { id: 2, x: '55%', y: '25%', selected: true },
  { id: 3, x: '72%', y: '55%', selected: false },
  { id: 4, x: '35%', y: '65%', selected: false },
];

export default function AventuresMiniMap() {
  return (
    <div
      style={{
        position: 'relative',
        height: '180px',
        borderRadius: '20px',
        overflow: 'hidden',
        margin: '0 16px 12px',
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, #2D6B4A 0%, #17402C 60%, #0B1F17 100%)',
        }}
      />

      {/* SVG overlay with grid, contours, pins */}
      <svg
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="400" height="180" fill="url(#grid)" />

        {/* Topo contour lines */}
        <path
          d="M0 120 Q 80 80, 160 100 T 320 90 T 400 110"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        <path
          d="M0 140 Q 100 100, 200 120 T 400 130"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.8"
        />
        <path
          d="M0 100 Q 60 60, 140 75 T 280 65 T 400 85"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.6"
        />
        <path
          d="M0 160 Q 120 130, 240 150 T 400 155"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.6"
        />
        <path
          d="M50 50 Q 150 30, 250 55 T 400 60"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Trails */}
        <path
          d="M60 130 Q 120 90, 180 85 T 300 70"
          fill="none"
          stroke="rgba(168,200,160,0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <path
          d="M150 150 Q 200 110, 260 100 T 350 80"
          fill="none"
          stroke="rgba(168,200,160,0.25)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />

        {/* Pins */}
        {PINS.map((pin) => (
          <g key={pin.id}>
            {pin.selected && (
              <circle
                cx={pin.x}
                cy={pin.y}
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                filter="url(#glow)"
              />
            )}
            <circle
              cx={pin.x}
              cy={pin.y}
              r="8"
              fill={pin.selected ? '#FBFAF6' : 'rgba(255,255,255,0.85)'}
              stroke="#17402C"
              strokeWidth="1.5"
            />
            <text
              x={pin.x}
              y={pin.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#17402C"
              fontSize="8"
              fontWeight={600}
              fontFamily="ui-monospace, monospace"
            >
              {pin.id}
            </text>
          </g>
        ))}
      </svg>

      {/* Zoom controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <button
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            backdropFilter: 'blur(4px)',
          }}
        >
          +
        </button>
        <button
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            backdropFilter: 'blur(4px)',
          }}
        >
          −
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '5px 10px',
          background: 'rgba(11,31,23,0.5)',
          backdropFilter: 'blur(8px)',
          borderRadius: '999px',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.75)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#A8C8A0' }} />
          Refuge
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C6DCBE' }} />
          Sommet
        </span>
      </div>
    </div>
  );
}
