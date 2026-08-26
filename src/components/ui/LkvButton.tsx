'use client';
import React, { useState } from 'react';

interface LkvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'light' | 'ghost-light' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

const STYLES = {
  primary: { background: '#17402C', color: '#fff' },
  light: { background: '#fff', color: '#17402C' },
  'ghost-light': { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  ghost: { background: 'transparent', color: '#17402C' },
};

const SIZES = {
  sm: { padding: '8px 14px', fontSize: '12px' },
  md: { padding: '11px 20px', fontSize: '14px' },
  lg: { padding: '14px 26px', fontSize: '15px' },
};

export default function LkvButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  style,
  disabled,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  ...props
}: LkvButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '999px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transform: !disabled && isPressed ? 'scale(0.97)' : !disabled && isHovered ? 'scale(1.015)' : 'scale(1)',
    transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease, opacity 200ms ease, box-shadow 200ms ease',
    ...STYLES[variant],
    ...SIZES[size],
    ...(disabled ? { opacity: 0.5 } : {}),
    ...(isHovered && !disabled && variant === 'primary' ? { background: '#365233' } : {}),
    ...(isFocused ? { outline: '2px solid #5B7F55', outlineOffset: '2px' } : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      onMouseEnter={(e) => { setIsHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setIsHovered(false); setIsPressed(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { setIsPressed(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setIsPressed(false); onMouseUp?.(e); }}
      onTouchStart={(e) => { setIsPressed(true); onTouchStart?.(e); }}
      onTouchEnd={(e) => { setIsPressed(false); onTouchEnd?.(e); }}
      onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setIsFocused(false); setIsPressed(false); onBlur?.(e); }}
      disabled={disabled}
      {...props}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
}
