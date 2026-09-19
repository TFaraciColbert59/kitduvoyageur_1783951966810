'use client';

import React from 'react';
import LiquidGlass from '@/components/glass/LiquidGlass';
import { cn } from '@/lib/utils';

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  activeClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  count?: number | string;
  badge?: React.ReactNode;
}

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 28, md: 32, lg: 36 };

/**
 * Bouton icône rond — pile LiquidGlass complète (référence section 4) :
 * warp + double liseré + glow + réfraction budgétée + élasticité.
 * Valeurs pilotées par les tokens --btn-* (tokens.css).
 */
export default function GlassIconButton({
  icon,
  active = false,
  activeClassName = '',
  size = 'md',
  count,
  badge,
  className = '',
  style,
  disabled,
  onClick,
  children,
  type = 'button',
  ...props
}: GlassIconButtonProps) {
  const isCountMode = count !== undefined && count !== null;
  const px = SIZE_PX[size];

  return (
    <LiquidGlass
      as="button"
      {...props}
      type={type}
      disabled={disabled}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={cn('lkv-button-primitive touch-manipulation', active ? activeClassName : '', className)}
      cornerRadius={999}
      displacementScale={70}
      blurAmount={6}
      saturation={160}
      aberrationIntensity={2}
      priority="media"
      elasticity={0.3}
      glassTint={active ? 'var(--btn-tint-solid)' : 'var(--btn-tint)'}
      shadow="var(--btn-shadow)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
        minHeight: '44px',
        width: isCountMode ? undefined : `${px}px`,
        height: `${px}px`,
        padding: isCountMode ? '0 10px' : 0,
        border: 'none',
        color: active ? 'var(--btn-on-solid)' : 'var(--btn-content)',
        fontWeight: 700,
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', lineHeight: 1, position: 'relative' }}>
        {icon}
        {children}
        {isCountMode && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
        {badge && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '14px',
              minWidth: '14px',
              padding: '0 3px',
              borderRadius: '999px',
              background: 'var(--lkv-action)',
              color: 'var(--btn-on-solid)',
              fontSize: '8px',
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        )}
      </span>
    </LiquidGlass>
  );
}
