import type React from 'react';

export type IconVariant = 'outline' | 'solid';

/** SF-`SymbolConfiguration`-style weight axis (mapped per glyph source). */
export type IconWeight = 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'fill' | 'duotone';

/** SF-`SymbolConfiguration`-style scale axis. */
export type IconScale = 'small' | 'medium' | 'large';

/** SF-`SymbolRenderingMode`-style rendering axis. */
export type IconRenderingMode = 'monochrome' | 'hierarchical' | 'palette';

/**
 * Glyph resolution strategy:
 * - `auto`     : animated component (if provided) → PNG pack → Heroicons fallback
 * - `pack`     : PNG pack → Heroicons fallback (legacy `AppIcon` behaviour)
 * - `animated` : provided animated component only, else `null` (legacy `LkvIcon` behaviour)
 * - `hero`     : Heroicons only
 */
export type IconSource = 'auto' | 'pack' | 'animated' | 'hero';

export interface IconProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  name: string;
  size?: number;
  color?: string;
  variant?: IconVariant;
  weight?: IconWeight;
  scale?: IconScale;
  renderingMode?: IconRenderingMode;
  source?: IconSource;
  className?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  strokeWidth?: number;
  /**
   * Optional animated SVG component. Injected by the `LkvIcon` adapter so the
   * base primitive never eager-imports the animated icon set (bundle guard).
   */
  component?: React.ComponentType<IconGlyphProps>;
}

export interface IconGlyphProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}
