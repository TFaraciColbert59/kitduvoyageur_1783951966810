'use client';

import React from 'react';
import Link from 'next/link';

interface AventureCardProps {
  difficulty: string;
  location: string;
  title: string;
  distance: string | number;
  elevation: string | number;
  duration: string;
  href?: string;
  onClick?: () => void;
}

export default function AventureCard({
  difficulty,
  location,
  title,
  distance,
  elevation,
  duration,
  href = '#',
  onClick,
}: AventureCardProps) {
  const content = (
    <div
      style={{
        background: '#FBFAF6',
        border: '1px solid rgba(11,31,23,0.06)',
        borderRadius: '20px',
        overflow: 'hidden',
        display: 'flex',
        textDecoration: 'none',
        color: 'inherit',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <div
        style={{
          width: '110px',
          flexShrink: 0,
          background: 'linear-gradient(160deg, #2D6B4A 0%, #17402C 60%, #0B1F17 100%)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            padding: '3px 8px',
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '999px',
            fontSize: '9px',
            fontWeight: 600,
            color: '#17402C',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {difficulty}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#8B978F',
            }}
          >
            {location}
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 500, margin: '2px 0 0' }}>{title}</h3>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            fontSize: '11px',
            color: '#6B7A72',
            fontFamily: 'ui-monospace, monospace',
            marginTop: '8px',
          }}
        >
          <span>{distance} km</span>
          <span>+{elevation} m</span>
          <span>{duration}</span>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
