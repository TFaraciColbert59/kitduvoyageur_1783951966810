'use client';

import React from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

import { resolveMaskFile } from './registry';
import type { IconGlyphProps, IconProps } from './types';

const heroOutline = HeroIcons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
const heroSolid = HeroIconsSolid as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;

function resolveHeroComponent(
  name: string,
  variant: 'outline' | 'solid',
): React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined {
  const iconSet = variant === 'solid' ? heroSolid : heroOutline;

  let IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined;

  if (name.endsWith('SolidIcon')) {
    const base = `${name.slice(0, -'SolidIcon'.length)}Icon`;
    IconComponent = heroSolid[base] || heroOutline[base];
  } else if (name.endsWith('IconSolid')) {
    const base = `${name.slice(0, -'IconSolid'.length)}Icon`;
    IconComponent = heroSolid[base] || heroOutline[base];
  }
  if (!IconComponent) {
    IconComponent = iconSet[name];
  }
  if (!IconComponent) {
    IconComponent = (variant === 'solid' ? heroOutline : heroSolid)[name];
  }

  return IconComponent;
}

/**
 * Canonical icon primitive. All icon systems (PNG pack, Heroicons, animated
 * local SVGs, and future SF-inspired sets) resolve through this component so a
 * future glyph-source swap is a one-file change.
 */
export default function Icon({
  name,
  size = 24,
  color,
  variant = 'outline',
  source = 'auto',
  className = '',
  title,
  onClick,
  disabled = false,
  strokeWidth,
  component,
  style,
  ...props
}: IconProps) {
  const allowAnimated = source === 'animated' || source === 'auto';

  if (allowAnimated && component) {
    const Glyph = component;
    return (
      <Glyph
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        style={{
          color: color === 'currentColor' ? 'currentColor' : color || 'currentColor',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      />
    );
  }

  if (source !== 'animated') {
    const maskFile = resolveMaskFile(name, variant);
    if (maskFile) {
      const iconSrc = `/icons/${maskFile.split('/').map(encodeURIComponent).join('/')}`;
      return (
        <span
          role="img"
          aria-label={title || name}
          title={title}
          onClick={disabled ? undefined : onClick}
          className={`inline-flex items-center justify-center select-none shrink-0 ${
            disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''
          } ${className}`}
          style={{
            width: size,
            height: size,
            display: 'inline-flex',
            backgroundColor: color || 'currentColor',
            maskImage: `url("${iconSrc}")`,
            WebkitMaskImage: `url("${iconSrc}")`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            ...style,
          }}
          {...props}
        />
      );
    }
  }

  if (source === 'pack' || source === 'auto' || source === 'hero') {
    const HeroComponent = resolveHeroComponent(name, variant);
    if (typeof HeroComponent === 'function') {
      const RenderedComponent = HeroComponent;
      return (
        <RenderedComponent
          width={size}
          height={size}
          style={{ color, ...style }}
          className={`${
            disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''
          } ${className}`}
          onClick={disabled ? undefined : onClick}
          {...(props as any)}
        />
      );
    }
  }

  // Legacy `AppIcon` placeholder (pack source only) — animated sources resolve
  // to nothing, matching the previous `LkvIcon` behaviour.
  if (source === 'pack') {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, ...style }}
        className={`shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={disabled ? undefined : onClick}
        {...(props as any)}
      >
        <span style={{ fontSize: size * 0.7 }}>✦</span>
      </span>
    );
  }

  if (process.env.NODE_ENV !== 'production' && source === 'auto' && !component) {
    console.warn(`[Icon] No glyph resolved for name "${name}" (source: ${source}).`);
  }

  return null;
}

export type { IconGlyphProps };
