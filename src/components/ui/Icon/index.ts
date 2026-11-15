export { default as Icon } from './Icon';
export { default } from './Icon';
export { PNG_ICON_MAP, ANIMATED_ICON_NAMES, SVG_MASK_ICON_NAMES, resolvePackFile, resolveMaskFile } from './registry';
export type { AnimatedIconName } from './registry';
export type {
  IconProps,
  IconGlyphProps,
  IconSource,
  IconVariant,
  IconWeight,
  IconScale,
  IconRenderingMode,
} from './types';

// Re-export vector Lucide icons so feature pages can import from '@/components/ui/Icon'
export * from 'lucide-react';
