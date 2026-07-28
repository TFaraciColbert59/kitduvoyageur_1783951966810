'use client';
import React, { useState } from 'react';

interface LkvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'light' | 'ghost-light' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

const STYLES = {
  primary: { background: '#17402C', color: '#fff' },
  light: { background: '#fff', color: '#0B1F17' },
  'ghost-light': { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  ghost: { background: 'transparent', color: '#0B1F17' },
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
  ...props
}: LkvButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
    transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    ...STYLES[variant],
    ...SIZES[size],
    ...(disabled ? { opacity: 0.5 } : {}),
    ...(isHovered && !disabled && variant === 'primary' ? { background: '#0F2D1F' } : {}),
    ...(isFocused ? { outline: '2px solid #82C39B', outlineOffset: '2px' } : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      onMouseEnter={(e) => { setIsHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setIsHovered(false); onMouseLeave?.(e); }}
      onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
      disabled={disabled}
      {...props}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
}
