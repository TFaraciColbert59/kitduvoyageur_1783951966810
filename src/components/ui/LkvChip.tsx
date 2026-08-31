'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export type LkvChipTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone' | 'light' | 'dark';

export interface LkvChipProps {
  label?: string;
  children?: React.ReactNode;
  tone?: LkvChipTone;
  variant?: 'light' | 'dark'; // pour rétrocompatibilité
  dot?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const TONE_STYLES: Record<LkvChipTone, { bg: string; text: string; border: string; dot: string }> = {
  sage: { bg: 'rgba(91,127,85,0.14)', text: '#17402C', border: 'rgba(91,127,85,0.30)', dot: '#5B7F55' },
  warn: { bg: 'rgba(200,154,59,0.16)', text: '#8C6418', border: 'rgba(200,154,59,0.35)', dot: '#C89A3B' },
  danger: { bg: 'rgba(168,68,58,0.16)', text: '#8A241B', border: 'rgba(168,68,58,0.35)', dot: '#A8443A' },
  info: { bg: 'rgba(75,107,124,0.16)', text: '#2C4857', border: 'rgba(75,107,124,0.35)', dot: '#4B6B7C' },
  stone: { bg: 'rgba(255,255,255,0.60)', text: '#3F3B34', border: 'rgba(255,255,255,0.85)', dot: '#7A7365' },
  light: { bg: 'rgba(255,255,255,0.92)', text: '#17402C', border: 'rgba(23,64,44,0.10)', dot: '#5B7F55' },
  dark: { bg: 'rgba(23,64,44,0.55)', text: '#FFFFFF', border: 'rgba(255,255,255,0.20)', dot: '#A6C1A0' },
};

export function LkvChip({
  label,
  children,
  tone,
  variant,
  dot,
  active = false,
  disabled = false,
  onClick,
  className,
  style,
}: LkvChipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const isInteractive = Boolean(onClick) && !disabled;

  // Calcul du ton effectif
  const effectiveTone: LkvChipTone = tone || (variant === 'dark' ? 'dark' : 'light');
  const t = TONE_STYLES[effectiveTone];

  const content = children || label;

  return (
    <span
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      onMouseDown={() => { if (isInteractive) setIsPressed(true); }}
      onMouseUp={() => { if (isInteractive) setIsPressed(false); }}
      onTouchStart={() => { if (isInteractive) setIsPressed(true); }}
      onTouchEnd={() => { if (isInteractive) setIsPressed(false); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        background: active ? '#17402C' : t.bg,
        backdropFilter: 'blur(8px)',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: active ? 600 : 500,
        color: active ? '#ffffff' : t.text,
        border: `1px solid ${active ? '#17402C' : t.border}`,
        cursor: isInteractive ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1,
        transform: isInteractive && isPressed ? 'scale(0.95)' : 'scale(1)',
        transition:
          'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease, color 150ms ease, border-color 150ms ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      className={cn('lkv-chip-primitive touch-manipulation', className)}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: active ? '#A6C1A0' : t.dot,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      {content}
    </span>
  );
}

export default LkvChip;
