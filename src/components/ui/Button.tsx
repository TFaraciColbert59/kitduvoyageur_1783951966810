'use client';
import React, { useState } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: '#17402C', color: '#fff', border: 'none' },
  secondary: { background: '#FAF8F5', color: '#0B1F17', border: '1px solid #E8E4D8' },
  danger: { background: '#E53E3E', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: '#0B1F17', border: 'none' },
};

const HOVER_STYLES: Partial<Record<ButtonVariant, React.CSSProperties>> = {
  primary: { background: '#0F2D1F' },
  secondary: { background: '#F0ECE1' },
  danger: { background: '#C53030' },
  ghost: { background: '#FAF8F5' },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: '12px', padding: '6px 12px' },
  md: { fontSize: '14px', padding: '10px 16px' },
  lg: { fontSize: '16px', padding: '12px 20px' },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  children,
  ...rest
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: isDisabled ? 0.5 : 1,
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...(isHovered && !isDisabled ? HOVER_STYLES[variant] || {} : {}),
    ...(isFocused ? { outline: '2px solid #A8C8A0', outlineOffset: '2px' } : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={isDisabled}
      onMouseEnter={(e) => { setIsHovered(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setIsHovered(false); rest.onMouseLeave?.(e); }}
      onFocus={(e) => { setIsFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setIsFocused(false); rest.onBlur?.(e); }}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin"
          style={{ height: '16px', width: '16px', marginRight: '8px' }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
