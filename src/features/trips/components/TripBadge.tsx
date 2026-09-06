'use client';

import React from 'react';
import { LkvChip, type LkvChipTone } from '@/components/ui/LkvChip';
import type {
  TripStatus,
  TripDifficulty,
  TripActivityType,
  TripRole,
} from '../types/trip.types';

export interface TripBadgeProps {
  type: 'status' | 'difficulty' | 'activity' | 'role';
  value: TripStatus | TripDifficulty | TripActivityType | TripRole | string;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<TripStatus, { label: string; tone: LkvChipTone }> = {
  draft: { label: 'Brouillon', tone: 'stone' },
  planned: { label: 'Planifié', tone: 'info' },
  active: { label: 'En cours', tone: 'sage' },
  completed: { label: 'Terminé', tone: 'light' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const DIFFICULTY_CONFIG: Record<TripDifficulty, { label: string; tone: LkvChipTone }> = {
  easy: { label: 'Facile', tone: 'sage' },
  moderate: { label: 'Modéré', tone: 'info' },
  hard: { label: 'Difficile', tone: 'warn' },
  expert: { label: 'Expert', tone: 'danger' },
};

const ACTIVITY_CONFIG: Record<TripActivityType, { label: string; tone: LkvChipTone }> = {
  hiking: { label: 'Randonnée', tone: 'sage' },
  trekking: { label: 'Trek', tone: 'sage' },
  bivouac: { label: 'Bivouac', tone: 'info' },
  roadtrip: { label: 'Roadtrip', tone: 'stone' },
  cultural: { label: 'Culture', tone: 'light' },
  bushcraft: { label: 'Bushcraft', tone: 'warn' },
  mixed: { label: 'Mixte', tone: 'stone' },
};

const ROLE_CONFIG: Record<TripRole, { label: string; tone: LkvChipTone }> = {
  owner: { label: 'Organisateur', tone: 'sage' },
  editor: { label: 'Éditeur', tone: 'info' },
  viewer: { label: 'Lecteur', tone: 'stone' },
};

export function TripBadge({ type, value, size = 'sm', className = '' }: TripBadgeProps) {
  let label = String(value);
  let tone: LkvChipTone = 'stone';

  if (type === 'status' && value in STATUS_CONFIG) {
    const cfg = STATUS_CONFIG[value as TripStatus];
    label = cfg.label;
    tone = cfg.tone;
  } else if (type === 'difficulty' && value in DIFFICULTY_CONFIG) {
    const cfg = DIFFICULTY_CONFIG[value as TripDifficulty];
    label = cfg.label;
    tone = cfg.tone;
  } else if (type === 'activity' && value in ACTIVITY_CONFIG) {
    const cfg = ACTIVITY_CONFIG[value as TripActivityType];
    label = cfg.label;
    tone = cfg.tone;
  } else if (type === 'role' && value in ROLE_CONFIG) {
    const cfg = ROLE_CONFIG[value as TripRole];
    label = cfg.label;
    tone = cfg.tone;
  }

  return (
    <LkvChip
      tone={tone}
      dot={type === 'status'}
      className={`${size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'} ${className}`}
    >
      {label}
    </LkvChip>
  );
}
