'use client';
import React from 'react';

interface LkvChipProps {
  label: string;
  dot?: boolean;
  variant?: 'light' | 'dark';
}

export default function LkvChip({ label, dot, variant = 'light' }: LkvChipProps) {
  const isLight = variant === 'light';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px',
        background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(11,31,23,0.5)',
        backdropFilter: 'blur(8px)',
        borderRadius: '999px',
        fontSize: '11px', fontWeight: 500,
        color: isLight ? '#0B1F17' : '#fff',
        border: isLight ? '1px solid rgba(11,31,23,0.05)' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A8C8A0' }} />}
      {label}
    </span>
  );
}
