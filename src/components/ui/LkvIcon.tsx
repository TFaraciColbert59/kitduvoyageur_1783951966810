'use client';
import React from 'react';

interface LkvIconProps {
  name: 'home' | 'mountain' | 'bag' | 'doc' | 'user' | 'search' | 'chevron-left' | 'chevron-right' | 'heart' | 'bookmark' | 'bell' | 'map-pin' | 'star' | 'minus' | 'plus' | 'close' | 'menu' | 'arrow-right' | 'lock' | 'filter' | 'users' | 'compass' | 'box';
  size?: number;
  color?: string;
}

const PATHS: Record<LkvIconProps['name'], string | string[]> = {
  home: 'M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z',
  mountain: 'M3 20l4-14 5 8 3-4 6 10z',
  bag: ['M5 7h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7z', 'M9 7V5a3 3 0 0 1 6 0v2'],
  doc: ['M4 5a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M8 9h5 M8 13h8'],
  user: ['M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 21c0-4 4-6 8-6s8 2 8 6'],
  search: ['M11 11a7 7 0 1 0 0-14 7 7 0 0 0 0 14', 'M21 21l-3.5-3.5'],
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  close: ['M6 6l12 12', 'M18 6l-12 12'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  star: 'M12 2l3 7h7l-6 4 2 8-6-4-6 4 2-8-6-4h7z',
  lock: ['M8 10V7a4 4 0 0 1 8 0v3', 'M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  minus: 'M5 12h14',
  plus: ['M12 5v14', 'M5 12h14'],
  'map-pin': ['M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z', 'M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z',
  users: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M20 21c0-4-4-6-8-6s-8 2-8 6', 'M17 8a3 3 0 1 0 0-6', 'M22 21c0-3-2.5-5-5-5'],
  compass: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z'],
  box: ['M2 7l10-4 10 4-10 4z', 'M2 7v10l10 4 10-4V7', 'M2 7l10 4 10-4', 'M12 11v10'],
};

export default function LkvIcon({ name, size = 20, color = 'currentColor' }: LkvIconProps) {
  const pathData = PATHS[name];
  if (!pathData) return null;

  const paths = Array.isArray(pathData) ? pathData : [pathData];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
