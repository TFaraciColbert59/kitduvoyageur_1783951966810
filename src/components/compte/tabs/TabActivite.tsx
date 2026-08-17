'use client';

import React from 'react';
import Link from 'next/link';
import { CompteActiviteItem, CompteBadgeItem } from '@/lib/supabase/queries-compte';
import { ActivitySkeleton } from '../CompteSkeleton';

interface TabActiviteProps {
  activities: CompteActiviteItem[] | undefined;
  badges: CompteBadgeItem[] | undefined;
  loading?: boolean;
}

export default function TabActivite({ activities, badges, loading }: TabActiviteProps) {
  if (loading) {
    return <ActivitySkeleton />;
  }

  const earnedBadges = (badges || []).filter((b) => b.earned);

  return (
    <div className="space-y-6">
      {/* Badges & Récompenses rapides */}
      {earnedBadges.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-[#0B1F17] flex items-center gap-1.5">
                <span>🏅</span> Badges & Distinctions
              </h3>
              <p className="text-xs text-[#5C6B63] mt-0.5">
                {earnedBadges.length} badge{earnedBadges.length > 1 ? 's' : ''} débloqué{earnedBadges.length > 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/fidelite"
              className="text-xs font-bold text-[#17402C] hover:underline flex items-center gap-1"
            >
              <span>Voir tout</span>
              <span>→</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-1">
            {earnedBadges.map((b) => (
              <div
                key={b.id}
                className="px-3.5 py-2.5 rounded-2xl bg-[#FBFAF6] border border-[#A9C6B0]/40 flex items-center gap-2.5 shrink-0"
              >
                <span className="text-lg">⭐</span>
                <div>
                  <p className="text-xs font-bold text-[#0B1F17] leading-tight">{b.title}</p>
                  <p className="text-[10px] font-mono text-[#17402C] font-semibold">Débloqué</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flux d'activité */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-[#0B1F17] flex items-center gap-1.5">
            <span>⚡</span> Activité récente
          </h3>
          <span className="text-[10px] font-mono font-semibold text-[#5C6B63]">
            Temps réel
          </span>
        </div>

        {!activities || activities.length === 0 ? (
          <div className="py-10 text-center text-[#5C6B63]">
            <p className="text-3xl mb-2">🏔️</p>
            <p className="text-xs font-semibold text-[#0B1F17]">Aucune activité pour le moment</p>
            <p className="text-[11px] text-[#5C6B63] max-w-xs mx-auto mt-1">
              Vos prochaines sorties, carnets partagés et interactions apparaîtront ici.
            </p>
            <Link
              href="/preparer-randonnee"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-[#17402C] text-white text-xs font-bold shadow-xs active:scale-95 transition-transform"
            >
              <span>+ Préparer une aventure</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 divide-y divide-black/[0.04]">
            {activities.map((act) => (
              <div key={act.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F4F1EB] flex items-center justify-center text-sm shrink-0">
                    {act.icon_type === 'badge' ? '🏅' : act.icon_type === 'order' ? '📦' : '⚡'}
                  </div>
                  <div>
                    <p className="text-xs text-[#0B1F17] font-medium leading-snug">
                      {act.text}
                    </p>
                    {act.highlight && (
                      <p className="text-[10px] font-mono font-bold text-[#17402C] mt-0.5">
                        {act.highlight}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#5C6B63] shrink-0 whitespace-nowrap">
                  {act.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
