'use client';
import React from 'react';

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

export default function LkvButton({ variant = 'primary', size = 'md', icon, children, style, ...props }: LkvButtonProps) {
  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        borderRadius: '999px', fontWeight: 500, whiteSpace: 'nowrap',
        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
        transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        ...STYLES[variant], ...SIZES[size], ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
}
