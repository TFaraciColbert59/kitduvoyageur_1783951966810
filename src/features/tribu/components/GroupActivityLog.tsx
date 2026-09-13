'use client';

import React from 'react';

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
    <div className="glass rounded-2xl p-5" data-testid="group-activity-log">
      <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)] mb-3">
        Journal du groupe
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--lkv-text-muted)]">
          Aucune activité pour le moment.
        </p>
      ) : (
        <ol className={`space-y-2 ${compact ? 'max-h-64' : 'max-h-80'} overflow-y-auto pr-1`}>
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3">
              <span className="text-xs text-[var(--lkv-text-secondary)] leading-snug">
                {entry.summary}
              </span>
              <span className="text-[10px] font-mono text-[var(--lkv-text-muted)] shrink-0">
                {formatWhen(entry.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
