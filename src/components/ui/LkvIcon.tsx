'use client';

import React from 'react';

import { HomeIcon as HomeAnimated } from '@/components/icons/home';
import { MountainIcon as MountainAnimated } from '@/components/icons/mountain';
import { CompassIcon as CompassAnimated } from '@/components/icons/compass';
import { BoxIcon as BoxAnimated } from '@/components/icons/box';
import { UsersIcon as UsersAnimated } from '@/components/icons/users';
import { UserIcon as UserAnimated } from '@/components/icons/user';
import { SparklesIcon as SparklesAnimated } from '@/components/icons/sparkles';
import { TentIcon as TentAnimated } from '@/components/icons/tent';
import { BookIcon as BookAnimated } from '@/components/icons/book';
import { ShoppingBagIcon as ShoppingBagAnimated } from '@/components/icons/shopping-bag';
import { DocIcon as DocAnimated } from '@/components/icons/doc';
import { SearchIcon as SearchAnimated } from '@/components/icons/search';
import { ChevronLeftIcon as ChevronLeftAnimated } from '@/components/icons/chevron-left';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { ArrowRightIcon as ArrowRightAnimated } from '@/components/icons/arrow-right';
import { ArrowLeftIcon as ArrowLeftAnimated } from '@/components/icons/arrow-left';
import { XIcon as XAnimated } from '@/components/icons/x';
import { MenuIcon as MenuAnimated } from '@/components/icons/menu';
import { BellIcon as BellAnimated } from '@/components/icons/bell';
import { HeartIcon as HeartAnimated } from '@/components/icons/heart';
import { BookmarkIcon as BookmarkAnimated } from '@/components/icons/bookmark';
import { MapPinIcon as MapPinAnimated } from '@/components/icons/map-pin';
import { StarIcon as StarAnimated } from '@/components/icons/star';
import { LockIcon as LockAnimated } from '@/components/icons/lock';
import { FilterIcon as FilterAnimated } from '@/components/icons/filter';
import { MinusIcon as MinusAnimated } from '@/components/icons/minus';
import { PlusIcon as PlusAnimated } from '@/components/icons/plus';

import Icon from './Icon';
import type { IconGlyphProps } from './Icon';

export type LkvIconName =
  | 'home'
  | 'mountain'
  | 'bag'
  | 'doc'
  | 'user'
  | 'search'
  | 'chevron-left'
  | 'chevron-right'
  | 'heart'
  | 'bookmark'
  | 'bell'
  | 'map-pin'
  | 'star'
  | 'minus'
  | 'plus'
  | 'close'
  | 'menu'
  | 'arrow-right'
  | 'arrow-left'
  | 'lock'
  | 'filter'
  | 'users'
  | 'compass'
  | 'box'
  | 'sparkles'
  | 'tent'
  | 'book';

const ANIMATED_ICONS: Record<LkvIconName, React.ComponentType<IconGlyphProps>> = {
  home: HomeAnimated,
  mountain: MountainAnimated,
  compass: CompassAnimated,
  box: BoxAnimated,
  users: UsersAnimated,
  user: UserAnimated,
  sparkles: SparklesAnimated,
  tent: TentAnimated,
  book: BookAnimated,
  bag: ShoppingBagAnimated,
  doc: DocAnimated,
  search: SearchAnimated,
  'chevron-left': ChevronLeftAnimated,
  'chevron-right': ChevronRightAnimated,
  'arrow-right': ArrowRightAnimated,
  'arrow-left': ArrowLeftAnimated,
  close: XAnimated,
  menu: MenuAnimated,
  bell: BellAnimated,
  heart: HeartAnimated,
  bookmark: BookmarkAnimated,
  'map-pin': MapPinAnimated,
  star: StarAnimated,
  lock: LockAnimated,
  filter: FilterAnimated,
  minus: MinusAnimated,
  plus: PlusAnimated,
};

export interface LkvIconProps {
  name: LkvIconName;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Legacy adapter — delegates to the canonical `Icon` primitive using the local
 * animated SVG set. The animated components are imported here (not in `Icon`)
 * so the PNG/Heroicons consumers never pull them into their bundle.
 */
export default function LkvIcon({ name, size = 20, color = 'currentColor', className = '', style }: LkvIconProps) {
  const component = ANIMATED_ICONS[name];

  if (!component) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[LkvIcon] Unknown animated icon "${name}".`);
    }
    return null;
  }

  return <Icon name={name} source="animated" component={component} size={size} color={color} className={className} style={style} />;
}
