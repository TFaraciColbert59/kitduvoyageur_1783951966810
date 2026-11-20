'use client';

import React from 'react';
import { LUCIDE_ICONS } from './lucide.generated';
import { HERO_OUTLINE, HERO_SOLID } from './heroicons.generated';
import { INSTAGRAM_FILLED, INSTAGRAM_GLYPHS } from './instagram.generated';
import type { IconGlyphProps, IconProps } from './types';

// Table de correspondance statique Heroicons
const heroOutline = HERO_OUTLINE;
const heroSolid = HERO_SOLID;

// Dictionnaire sémantique pour correspondance immédiate vers Lucide
const SEMANTIC_LUCIDE_MAP: Record<string, string> = {
  // Navigation & Flèches
  home: 'Home',
  'home-icon': 'Home',
  'chevron-down': 'ChevronDown',
  'chevron-up': 'ChevronUp',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'arrow-down': 'ArrowDown',
  'arrow-up': 'ArrowUp',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'arrow-left-on-rectangle': 'LogIn',
  'arrow-right-on-rectangle': 'LogOut',
  'arrow-trending-up': 'TrendingUp',
  'arrow-trending-down': 'TrendingDown',
  'arrow-path': 'RotateCw',
  'arrow-down-tray': 'Download',
  'arrow-up-on-square': 'Share2',
  'arrow-top-right-on-square': 'ExternalLink',
  'arrows-right-left': 'ArrowRightLeft',
  'arrows-pointing-out': 'Maximize2',

  // Actions & Contrôles
  plus: 'Plus',
  'plus-circle': 'PlusCircle',
  minus: 'Minus',
  'minus-circle': 'MinusCircle',
  x: 'X',
  'x-mark': 'X',
  'x-circle': 'XCircle',
  close: 'X',
  check: 'Check',
  'check-circle': 'CheckCircle2',
  'check-badge': 'BadgeCheck',
  'bars-3': 'Menu',
  burger: 'Menu',
  menu: 'Menu',
  'ellipsis-horizontal': 'MoreHorizontal',
  'ellipsis-vertical': 'MoreVertical',
  funnel: 'Filter',
  filter: 'Filter',
  'magnifying-glass': 'Search',
  search: 'Search',
  gear: 'Settings',
  settings: 'Settings',

  // Utilisateur & Communauté
  user: 'User',
  'user-circle': 'UserCircle2',
  users: 'Users',
  'user-group': 'Users',
  'user-plus': 'UserPlus',
  heart: 'Heart',
  whislist: 'Heart',
  like: 'Heart',
  bookmark: 'Bookmark',
  saved: 'Bookmark',
  share: 'Share2',
  'chat-bubble-left': 'MessageSquare',
  'chat-bubble-left-right': 'MessagesSquare',
  'chat-bubble': 'MessageSquare',
  message: 'MessageSquare',
  messages: 'MessagesSquare',
  bell: 'Bell',
  'bell-alert': 'BellRing',
  'bell-slash': 'BellOff',
  notification: 'Bell',

  // Médias, Outils & Documents
  camera: 'Camera',
  photo: 'Image',
  image: 'Image',
  galery: 'Image',
  gallery: 'Image',
  document: 'FileText',
  'document-text': 'FileText',
  'book-open': 'BookOpen',
  book: 'Book',
  calendar: 'Calendar',
  'calendar-days': 'CalendarDays',
  clock: 'Clock',
  pencil: 'Pencil',
  'pencil-square': 'PenSquare',
  edit: 'Edit3',
  trash: 'Trash2',
  archive: 'Archive',
  folder: 'Folder',
  link: 'Link2',
  'paper-airplane': 'Send',
  send: 'Send',
  foward: 'Send',
  envelope: 'Mail',
  mail: 'Mail',
  phone: 'Phone',
  'qr-code': 'QrCode',
  sparkles: 'Sparkles',

  // LKDV & Outdoor
  compass: 'Compass',
  compas: 'Compass',
  mountain: 'Mountain',
  mountains: 'MountainSnow',
  backpack: 'Backpack',
  bag: 'Backpack',
  sac: 'Backpack',
  tent: 'Tent',
  tente: 'Tent',
  bed: 'Bed',
  'sleeping-bag': 'BedSingle',
  mat: 'Square',
  'map-pin': 'MapPin',
  pin: 'MapPin',
  map: 'Map',
  route: 'Route',
  footprints: 'Footprints',
  navigation: 'Navigation',
  locate: 'Locate',
  shield: 'Shield',
  'shield-check': 'ShieldCheck',
  cart: 'ShoppingCart',
  'shopping-bag': 'ShoppingBag',
  'shopping-cart': 'ShoppingCart',
  'credit-card': 'CreditCard',
  card: 'CreditCard',
  tag: 'Tag',
  sun: 'Sun',
  moon: 'Moon',
  flame: 'Flame',
  award: 'Award',
  trophy: 'Trophy',
  info: 'Info',
  'info-circle': 'Info',
  'alert-triangle': 'AlertTriangle',
  warning: 'AlertTriangle',
  lock: 'Lock',
  unlock: 'Unlock',
  eye: 'Eye',
  'eye-slash': 'EyeOff',
  'eye-off': 'EyeOff',
};

function isComponent(val: unknown): val is React.ComponentType<any> {
  return typeof val === 'function' || (typeof val === 'object' && val !== null && '$$typeof' in (val as any));
}

function getLucideIcon(key: string): React.ComponentType<any> | undefined {
  if (!key || typeof key !== 'string') return undefined;
  if (key in Object.prototype) return undefined;
  if (!Object.prototype.hasOwnProperty.call(LUCIDE_ICONS, key)) return undefined;
  const comp = LUCIDE_ICONS[key];
  return isComponent(comp) ? comp : undefined;
}

function resolveLucideComponent(name: string): React.ComponentType<any> | undefined {
  if (!name || typeof name !== 'string') return undefined;

  const lowerKebab = name.toLowerCase().replace(/_/g, '-');
  if (Object.prototype.hasOwnProperty.call(SEMANTIC_LUCIDE_MAP, lowerKebab)) {
    const mapped = SEMANTIC_LUCIDE_MAP[lowerKebab];
    const comp = getLucideIcon(mapped);
    if (comp) return comp;
  }

  const directComp = getLucideIcon(name);
  if (directComp) return directComp;

  let clean = name;
  if (clean.endsWith('SolidIcon')) clean = clean.slice(0, -9);
  else if (clean.endsWith('IconSolid')) clean = clean.slice(0, -9);
  else if (clean.endsWith('Icon')) clean = clean.slice(0, -4);

  const cleanComp = getLucideIcon(clean);
  if (cleanComp) return cleanComp;

  const pascal = clean
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  const pascalComp = getLucideIcon(pascal);
  if (pascalComp) return pascalComp;

  return undefined;
}

function resolveHeroComponent(
  name: string,
  variant: 'outline' | 'solid',
): React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined {
  if (!name || typeof name !== 'string') return undefined;
  const iconSet = variant === 'solid' ? heroSolid : heroOutline;
  let IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined;

  if (name.endsWith('SolidIcon')) {
    const base = `${name.slice(0, -'SolidIcon'.length)}Icon`;
    IconComponent = (Object.prototype.hasOwnProperty.call(heroSolid, base) ? heroSolid[base] : undefined) ||
                    (Object.prototype.hasOwnProperty.call(heroOutline, base) ? heroOutline[base] : undefined);
  } else if (name.endsWith('IconSolid')) {
    const base = `${name.slice(0, -'IconSolid'.length)}Icon`;
    IconComponent = (Object.prototype.hasOwnProperty.call(heroSolid, base) ? heroSolid[base] : undefined) ||
                    (Object.prototype.hasOwnProperty.call(heroOutline, base) ? heroOutline[base] : undefined);
  }
  if (!IconComponent && Object.prototype.hasOwnProperty.call(iconSet, name)) {
    IconComponent = iconSet[name];
  }
  const fallbackSet = variant === 'solid' ? heroOutline : heroSolid;
  if (!IconComponent && Object.prototype.hasOwnProperty.call(fallbackSet, name)) {
    IconComponent = fallbackSet[name];
  }

  return typeof IconComponent === 'function' ? IconComponent : undefined;
}

/**
 * Primitive canonique Icon — Rendu vectoriel SVG net (0 masque PNG, 0 pixel flou).
 * Supporte Lucide, Heroicons vectoriels et glyphes personnalisés.
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

  if (!name || typeof name !== 'string') {
    return null;
  }

  // 1. Rendu Vectoriel Lucide SVG Prioritaire
  const LucideGlyph = resolveLucideComponent(name);
  if (LucideGlyph) {
    const computedStroke = strokeWidth ?? (variant === 'solid' ? 2.5 : 1.75);
    return (
      <span
        {...(title || onClick ? { role: 'img', 'aria-label': title || name } : { 'aria-hidden': true })}
        title={title}
        onClick={disabled ? undefined : onClick}
        className={`inline-flex items-center justify-center select-none shrink-0 ${
          disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''
        } ${className}`}
        style={{ width: size, height: size, ...(color ? { color } : {}), ...style }}
        {...(props as any)}
      >
        <LucideGlyph
          size={size}
          strokeWidth={computedStroke}
          aria-hidden="true"
        />
      </span>
    );
  }

  // 2. Glyphes Instagram vectoriels
  const InstagramGlyph =
    typeof name === 'string' && Object.prototype.hasOwnProperty.call(INSTAGRAM_GLYPHS, name)
      ? INSTAGRAM_GLYPHS[name]
      : undefined;
  if (InstagramGlyph) {
    const filled = variant === 'solid' || INSTAGRAM_FILLED.has(name);
    return (
      <span
        {...(title || onClick ? { role: 'img', 'aria-label': title || name } : { 'aria-hidden': true })}
        title={title}
        onClick={disabled ? undefined : onClick}
        className={`inline-flex items-center justify-center select-none shrink-0 ${
          disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''
        } ${className}`}
        style={{ width: size, height: size, color, ...style }}
        {...(props as any)}
      >
        <InstagramGlyph
          size={size}
          strokeWidth={strokeWidth ?? 1.75}
          fill={filled ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </span>
    );
  }

  // 3. Fallback Heroicons Vectoriel
  const HeroComponent = resolveHeroComponent(name, variant);
  if (typeof HeroComponent === 'function') {
    const RenderedComponent = HeroComponent;
    return (
      <span
        {...(title || onClick ? { role: 'img', 'aria-label': title || name } : { 'aria-hidden': true })}
        title={title}
        onClick={disabled ? undefined : onClick}
        className={`inline-flex items-center justify-center select-none shrink-0 ${
          disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''
        } ${className}`}
        style={{ width: size, height: size, color, ...style }}
        {...(props as any)}
      >
        <RenderedComponent
          width={size}
          height={size}
          style={{ color, ...style }}
        />
      </span>
    );
  }

  if (process.env.NODE_ENV !== 'production' && !component) {
    console.warn(`[Icon] No vector glyph resolved for name "${name}".`);
  }

  return null;
}

export type { IconGlyphProps };
