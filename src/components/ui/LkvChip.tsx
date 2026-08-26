'use client';
import React, { useState } from 'react';

interface LkvChipProps {
  label: string;
  dot?: boolean;
  variant?: 'light' | 'dark';
  active?: boolean;
  onClick?: () => void;
}

export default function LkvChip({ label, dot, variant = 'light', active = false, onClick }: LkvChipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const isLight = variant === 'light';

  const isInteractive = Boolean(onClick);

  return (
    <span
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      onMouseDown={() => { if (isInteractive) setIsPressed(true); }}
      onMouseUp={() => { if (isInteractive) setIsPressed(false); }}
      onTouchStart={() => { if (isInteractive) setIsPressed(true); }}
      onTouchEnd={() => { if (isInteractive) setIsPressed(false); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        background: active
          ? '#17402C'
          : isLight
          ? 'rgba(255,255,255,0.92)'
          : 'rgba(23,64,44,0.5)',
        backdropFilter: 'blur(8px)',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: active ? 600 : 500,
        color: active ? '#fff' : isLight ? '#17402C' : '#fff',
        border: active
          ? '1px solid #17402C'
          : isLight
          ? '1px solid rgba(23,64,44,0.08)'
          : '1px solid rgba(255,255,255,0.2)',
        cursor: isInteractive ? 'pointer' : 'default',
        transform: isInteractive && isPressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease, color 150ms ease, border-color 150ms ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: active ? '#A6C1A0' : '#5B7F55',
          }}
        />
      )}
      {label}
    </span>
  );
}
