'use client';

import React from 'react';
import type { OutdoorRole } from '../../types/clubs.types';

export interface ClubRoleBadgeProps {
  role: OutdoorRole;
  size?: 'sm' | 'md';
  className?: string;
}

const ROLE_STYLES: Record<OutdoorRole, { label: string; style: string }> = {
  owner: {
    label: 'Propriétaire',
    style: 'bg-forest-900/15 text-forest-800 dark:text-forest-200 border-forest-700/30',
  },
  admin: {
    label: 'Admin',
    style: 'bg-sky-600/15 text-sky-800 dark:text-sky-200 border-sky-600/30',
  },
  guide: {
    label: 'Guide',
    style: 'bg-sage-600/15 text-sage-800 dark:text-sage-200 border-sage-600/30',
  },
  safety: {
    label: 'Sécurité',
    style: 'bg-sand-500/20 text-sand-800 dark:text-sand-200 border-sand-500/40',
  },
  member: {
    label: 'Membre',
    style: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30',
  },
};

export const ClubRoleBadge: React.FC<ClubRoleBadgeProps> = ({
  role,
  size = 'sm',
  className = '',
}) => {
  const current = ROLE_STYLES[role] || ROLE_STYLES.member;
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${current.style} ${className}`}
    >
      {current.label}
    </span>
  );
};
