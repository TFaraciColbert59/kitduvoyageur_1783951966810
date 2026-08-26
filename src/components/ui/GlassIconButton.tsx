'use client';

import React from 'react';

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  activeClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  count?: number | string;
  badge?: React.ReactNode;
}

export default function GlassIconButton({
  icon,
  active = false,
  activeClassName = '!bg-[#17402C] !text-white !border-emerald-700/80 !shadow-md',
  size = 'md',
  count,
  badge,
  className = '',
  children,
  ...props
}: GlassIconButtonProps) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-9 h-9 text-base',
  };

  const isCountMode = count !== undefined && count !== null;

  return (
    <button
      type="button"
      className={`glass-circle-btn ${
        isCountMode
          ? 'h-8 px-2.5 gap-1.5'
          : sizeClasses[size]
      } ${
        active ? activeClassName : ''
      } ${className}`}
      {...props}
    >
      {icon}
      {children}

      {isCountMode && (
        <span className="text-[11px] font-mono font-bold tracking-tight text-[#17402C]">
          {count}
        </span>
      )}

      {badge && (
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white shadow-xs">
          {badge}
        </span>
      )}
    </button>
  );
}
