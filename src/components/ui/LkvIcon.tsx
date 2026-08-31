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

export interface LkvIconProps {
  name:
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
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function LkvIcon({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  style,
}: LkvIconProps) {
  const mergedStyle: React.CSSProperties = {
    color: color === 'currentColor' ? 'currentColor' : color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  switch (name) {
    case 'home':
      return <HomeAnimated size={size} className={className} style={mergedStyle} />;
    case 'mountain':
      return <MountainAnimated size={size} className={className} style={mergedStyle} />;
    case 'compass':
      return <CompassAnimated size={size} className={className} style={mergedStyle} />;
    case 'box':
      return <BoxAnimated size={size} className={className} style={mergedStyle} />;
    case 'users':
      return <UsersAnimated size={size} className={className} style={mergedStyle} />;
    case 'user':
      return <UserAnimated size={size} className={className} style={mergedStyle} />;
    case 'sparkles':
      return <SparklesAnimated size={size} className={className} style={mergedStyle} />;
    case 'tent':
      return <TentAnimated size={size} className={className} style={mergedStyle} />;
    case 'book':
      return <BookAnimated size={size} className={className} style={mergedStyle} />;
    case 'bag':
      return <ShoppingBagAnimated size={size} className={className} style={mergedStyle} />;
    case 'doc':
      return <DocAnimated size={size} className={className} style={mergedStyle} />;
    case 'search':
      return <SearchAnimated size={size} className={className} style={mergedStyle} />;
    case 'chevron-left':
      return <ChevronLeftAnimated size={size} className={className} style={mergedStyle} />;
    case 'chevron-right':
      return <ChevronRightAnimated size={size} className={className} style={mergedStyle} />;
    case 'arrow-right':
      return <ArrowRightAnimated size={size} className={className} style={mergedStyle} />;
    case 'arrow-left':
      return <ArrowLeftAnimated size={size} className={className} style={mergedStyle} />;
    case 'close':
      return <XAnimated size={size} className={className} style={mergedStyle} />;
    case 'menu':
      return <MenuAnimated size={size} className={className} style={mergedStyle} />;
    case 'bell':
      return <BellAnimated size={size} className={className} style={mergedStyle} />;
    case 'heart':
      return <HeartAnimated size={size} className={className} style={mergedStyle} />;
    case 'bookmark':
      return <BookmarkAnimated size={size} className={className} style={mergedStyle} />;
    case 'map-pin':
      return <MapPinAnimated size={size} className={className} style={mergedStyle} />;
    case 'star':
      return <StarAnimated size={size} className={className} style={mergedStyle} />;
    case 'lock':
      return <LockAnimated size={size} className={className} style={mergedStyle} />;
    case 'filter':
      return <FilterAnimated size={size} className={className} style={mergedStyle} />;
    case 'minus':
      return <MinusAnimated size={size} className={className} style={mergedStyle} />;
    case 'plus':
      return <PlusAnimated size={size} className={className} style={mergedStyle} />;
    default:
      return null;
  }
}
