'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TripFull } from '../../types/trip.types';

export interface GroupPresenceWidgetProps {
  trip: TripFull;
}

/** Initiales d'un nom complet (2 lettres). */
function initials(name?: string | null): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/**
 * Widget `group-presence` — avatars, rôles, invitation (prepare, live).
 * §Y_HUB_SPEC §3. Non monté si party === solo (filtre profil).
 */
export function GroupPresenceWidget({ trip }: GroupPresenceWidgetProps) {
  const collabs = trip.collaborators || [];
  const people = collabs.map((c) => ({
    id: c.id,
    name: c.profile?.full_name || c.profile?.username || 'Membre',
    role: c.role,
    avatar: c.profile?.avatar_url,
  }));

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-2.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <span aria-hidden="true">👥</span> Équipage
      </span>
      {people.length === 0 ? (
        <p className="text-xs text-[var(--lkv-text-muted)]">Voyage en solo — personne d'autre pour l'instant.</p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {people.slice(0, 5).map((p) => (
              <span
                key={p.id}
                title={p.name}
                className="w-8 h-8 rounded-full border-2 border-white/80 bg-[var(--lkv-secondary-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--lkv-primary)]"
              >
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials(p.name)
                )}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-[var(--lkv-text-secondary)]">
            {people.length} membre{people.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </GlassCard>
  );
}

export default GroupPresenceWidget;
