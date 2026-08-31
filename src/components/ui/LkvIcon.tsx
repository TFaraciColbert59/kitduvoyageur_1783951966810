'use client';
import React from 'react';
import {
  HomeAnimated,
  MountainAnimated,
  CompassAnimated,
  BoxAnimated,
  UsersAnimated,
  UserAnimated,
  SparklesAnimated,
  TentAnimated,
  BookAnimated,
  ShoppingBagAnimated,
  DocAnimated,
  SearchAnimated,
  ChevronLeftAnimated,
  ChevronRightAnimated,
  ArrowRightAnimated,
  ArrowLeftAnimated,
  XAnimated,
  MenuAnimated,
  BellAnimated,
  HeartAnimated,
  BookmarkAnimated,
  MapPinAnimated,
  StarAnimated,
  LockAnimated,
  FilterAnimated,
  MinusAnimated,
  PlusAnimated,
} from '@/components/icons';

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
