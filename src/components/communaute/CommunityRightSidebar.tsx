'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card, IconButton } from '@/components/ui';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';

interface CommunityRightSidebarProps {
  clubs?: any[];
  events?: any[];
}

export default function CommunityRightSidebar({ clubs = [], events = [] }: CommunityRightSidebarProps) {
  const topClubs = clubs.slice(0, 3);
  const validEvents = events.filter((e) => {
    if (!e.date) return true;
    const d = new Date(e.date);
    return isNaN(d.getTime()) || d.getTime() >= new Date().setHours(0, 0, 0, 0);
  });
  const uniqueEvents = Array.from(new Map(validEvents.map(e => [e.id || e.title, e])).values());
  const upcomingEvents = uniqueEvents.slice(0, 3);

  return (
    <aside className="community-right-sidebar flex h-full w-full min-w-0 shrink-0 flex-col gap-[var(--space-3)] overflow-y-auto pb-[var(--space-8)] custom-scrollbar">
      {/* WIDGET LIVE ACTIVITY FEED (Phase 7) */}
      <LiveActivityFeed limit={4} title="Événements en direct" />

      {/* WIDGET: PROCHAINES SORTIES (données serveur) */}
      <Card variant="compact" className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Prochaines sorties
          </h3>
          <Badge tone="stone">{upcomingEvents.length}</Badge>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
            Aucune sortie programmée pour le moment.
          </p>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {upcomingEvents.map((out) => (
              <Link
                key={out.id}
                href="/communaute?tab=evenements"
                className="block space-y-[var(--space-1)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] p-[var(--space-2)] shadow-elevation-1 transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="sage" className="px-[var(--space-2)] font-mono">
                    📅 {out.date || 'Date à confirmer'}
                  </Badge>
                  {out.maxParticipants > 0 && (
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]">
                      {out.participants}/{out.maxParticipants}
                    </span>
                  )}
                </div>
                <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                  {out.title}
                </h4>
                {out.location && (
                  <p className="truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    📍 {out.location}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* WIDGET: CLUBS POPULAIRES (données serveur) */}
      <Card variant="compact" className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Clubs populaires
          </h3>
          <Link href="/communaute?tab=clubs">
            <IconButton
              size="sm"
              title="Voir tous les clubs"
              aria-label="Voir tous les clubs"
            >
              <Icon name="arrow-right" size={12} aria-hidden="true" />
            </IconButton>
          </Link>
        </div>

        {topClubs.length === 0 ? (
          <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
            Aucun club pour le moment.
          </p>
        ) : (
          <div className="space-y-[var(--space-1)]">
            {topClubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug || club.id}`}
                className="group flex items-center justify-between rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] p-[var(--space-2)] shadow-elevation-1 transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
              >
                <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                  <span className="shrink-0 text-base">{club.emoji || '🏕️'}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] transition-colors group-hover:text-[color:var(--lkv-primary)]">
                      {club.name}
                    </div>
                    {club.category && (
                      <div className="truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                        {club.category}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-[var(--space-1)]">
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    {club.members_count ?? 0}
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-muted)]">
                    <Icon name="chevron-right" size={11} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* WIDGET 4: CHARTE DE LA MAISON */}
      <Card tone="warn" variant="compact" className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <Badge tone="warn" className="font-mono">
            🌲 ÉTHIQUE TERRAIN
          </Badge>
          <span className="text-[length:var(--lkv-text-caption)]">⛺</span>
        </div>
        <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
          L’Esprit de la Maison
        </h3>
        <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          Zéro trace en bivouac, respect du silence des crêtes et entraide sincère entre marcheurs de tous niveaux.
        </p>
      </Card>
    </aside>
  );
}
