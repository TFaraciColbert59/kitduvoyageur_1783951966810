'use client';

import React from 'react';
import { Card, EmptyState } from '@/components/ui';

export interface ActivityLogEntry {
  id: string;
  summary: string;
  actionType: string;
  entityType: string;
  createdAt: string;
  actorName?: string;
}

interface GroupActivityLogProps {
  entries: ActivityLogEntry[];
  compact?: boolean;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function GroupActivityLog({ entries, compact = false }: GroupActivityLogProps) {
  return (
    <Card className="p-[var(--space-5)]" data-testid="group-activity-log">
      <h3 className="mb-[var(--space-3)] font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
        Journal du groupe
      </h3>
      {entries.length === 0 ? (
        <EmptyState compact title="Aucune activité pour le moment." />
      ) : (
        <ol
          className={`space-y-[var(--space-2)] ${compact ? 'max-h-64' : 'max-h-80'} overflow-y-auto pr-[var(--space-1)]`}
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-[var(--space-3)]"
            >
              <span className="text-[length:var(--lkv-text-caption)] leading-snug text-[color:var(--lkv-text-secondary)]">
                {entry.summary}
              </span>
              <span className="shrink-0 font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                {formatWhen(entry.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
