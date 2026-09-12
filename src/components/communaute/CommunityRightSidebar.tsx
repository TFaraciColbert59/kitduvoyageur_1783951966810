'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';

interface CommunityRightSidebarProps {
  clubs?: any[];
  events?: any[];
}

export default function CommunityRightSidebar({ clubs = [], events = [] }: CommunityRightSidebarProps) {
  const topClubs = clubs.slice(0, 3);
  const upcomingEvents = events.slice(0, 3);

  return (
    <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3.5 pb-8">
      {/* WIDGET LIVE ACTIVITY FEED (Phase 7) */}
      <LiveActivityFeed limit={4} title="Événements en direct" />

      {/* WIDGET: PROCHAINES SORTIES (données serveur) */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Prochaines sorties</h3>
          <span className="glass-pill text-[8.5px] font-mono font-bold text-[#17402C]">
            {upcomingEvents.length}
          </span>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="text-[10.5px] text-[#5C6B5E] leading-relaxed">
            Aucune sortie programmée pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((out) => (
              <Link
                key={out.id}
                href="/communaute?tab=evenements"
                className="block p-2.5 rounded-xl bg-white/75 hover:bg-white border border-white/70 space-y-1.5 shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-mono font-bold text-forest-800 bg-forest-50 px-2 py-0.5 rounded">
                    📅 {out.date || 'Date à confirmer'}
                  </span>
                  {out.maxParticipants > 0 && (
                    <span className="text-[9px] font-mono font-bold text-[#5C6B5E]">
                      {out.participants}/{out.maxParticipants}
                    </span>
                  )}
                </div>
                <h4 className="font-display font-bold text-xs text-[#17402C] leading-snug truncate">
                  {out.title}
                </h4>
                {out.location && (
                  <p className="text-[9.5px] text-[#5C6B5E] truncate">📍 {out.location}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* WIDGET: CLUBS POPULAIRES (données serveur) */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Clubs populaires</h3>
          <Link href="/communaute?tab=clubs">
            <GlassIconButton
              size="sm"
              title="Voir tous les clubs"
              icon={<Icon name="ArrowRightIcon" size={12} />}
            />
          </Link>
        </div>

        {topClubs.length === 0 ? (
          <p className="text-[10.5px] text-[#5C6B5E] leading-relaxed">
            Aucun club pour le moment.
          </p>
        ) : (
          <div className="space-y-1.5">
            {topClubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug || club.id}`}
                className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white transition-all shadow-2xs border border-white/60 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{club.emoji || '🏕️'}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#17402C] truncate group-hover:text-forest-800 transition-colors">
                      {club.name}
                    </div>
                    {club.category && (
                      <div className="text-[9px] text-[#5C6B5E] truncate">{club.category}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9.5px] font-mono text-[#5C6B5E]">
                    {club.members_count ?? 0}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-[#17402C] group-hover:bg-[#17402C] group-hover:text-white transition-colors">
                    <Icon name="ChevronRightIcon" size={11} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* WIDGET 4: CHARTE DE LA MAISON */}
      <div className="glass tone-sand p-3.5 space-y-2 rounded-2xl text-[#17402C] border border-[#C89A3B]/30 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="glass-pill text-[8.5px] font-mono font-bold text-[#8C6418]">
            🌲 ÉTHIQUE TERRAIN
          </span>
          <span className="text-xs">⛺</span>
        </div>
        <h3 className="font-display font-bold text-xs text-[#17402C]">
          L’Esprit de la Maison
        </h3>
        <p className="text-[10.5px] text-[#5C6B5E] leading-relaxed">
          Zéro trace en bivouac, respect du silence des crêtes et entraide sincère entre marcheurs de tous niveaux.
        </p>
      </div>
    </aside>
  );
}
