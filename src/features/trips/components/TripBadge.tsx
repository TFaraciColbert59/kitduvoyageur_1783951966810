'use client';

import React from 'react';
import { Badge, type BadgeTone } from '@/components/ui';
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

const DOT: Record<BadgeTone, string> = {
  sage: 'bg-[color:var(--lkv-success)]',
  warn: 'bg-[color:var(--lkv-warning)]',
  danger: 'bg-[color:var(--lkv-danger)]',
  info: 'bg-[color:var(--lkv-info)]',
  stone: 'bg-[color:var(--lkv-text-muted)]',
};

const STATUS_CONFIG: Record<TripStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'stone' },
  planned: { label: 'Planifié', tone: 'info' },
  active: { label: 'En cours', tone: 'sage' },
  completed: { label: 'Terminé', tone: 'stone' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const DIFFICULTY_CONFIG: Record<TripDifficulty, { label: string; tone: BadgeTone }> = {
  easy: { label: 'Facile', tone: 'sage' },
  moderate: { label: 'Modéré', tone: 'info' },
  hard: { label: 'Difficile', tone: 'warn' },
  expert: { label: 'Expert', tone: 'danger' },
};

const ACTIVITY_CONFIG: Record<TripActivityType, { label: string; tone: BadgeTone }> = {
  hiking: { label: 'Randonnée', tone: 'sage' },
  trekking: { label: 'Trek', tone: 'sage' },
  bivouac: { label: 'Bivouac', tone: 'info' },
  roadtrip: { label: 'Roadtrip', tone: 'stone' },
  cultural: { label: 'Culture', tone: 'stone' },
  bushcraft: { label: 'Bushcraft', tone: 'warn' },
  mixed: { label: 'Mixte', tone: 'stone' },
};

const ROLE_CONFIG: Record<TripRole, { label: string; tone: BadgeTone }> = {
  owner: { label: 'Organisateur', tone: 'sage' },
  editor: { label: 'Éditeur', tone: 'info' },
  viewer: { label: 'Lecteur', tone: 'stone' },
};

export function TripBadge({ type, value, size = 'sm', className = '' }: TripBadgeProps) {
  let label = String(value);
  let tone: BadgeTone = 'stone';

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
    <Badge
      tone={tone}
      className={`${size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'} ${className}`}
    >
      {type === 'status' && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      )}
      {label}
    </Badge>
  );
}
