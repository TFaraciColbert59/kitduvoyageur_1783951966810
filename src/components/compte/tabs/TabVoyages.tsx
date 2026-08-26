'use client';

import React from 'react';
import Link from 'next/link';
import { CompteProchainVoyage, CompteClubItem } from '@/lib/supabase/queries-compte';
import { VoyagesSkeleton } from '../CompteSkeleton';

interface TabVoyagesProps {
  prochainVoyage: CompteProchainVoyage | null | undefined;
  clubs: CompteClubItem[] | undefined;
  loading?: boolean;
}

export default function TabVoyages({ prochainVoyage, clubs, loading }: TabVoyagesProps) {
  if (loading) {
    return <VoyagesSkeleton />;
  }

  const hasNextTrip = prochainVoyage && prochainVoyage.id && prochainVoyage.days_left > 0;

  return (
    <div className="space-y-6">
      {/* 1. Prochain Voyage Planifié */}
      {hasNextTrip ? (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#A9C6B0] shadow-2xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E1EBDD] text-[#17402C]">
                🧭 Prochain Départ
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#17402C] mt-2">
                {prochainVoyage.title}
              </h3>
              <p className="text-xs text-[#5A7064] font-mono mt-1">
                {prochainVoyage.date_range}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-[#FBFAF6] rounded-2xl border border-black/[0.06]">
                <p className="text-2xl font-bold font-mono text-[#17402C] leading-none">
                  {prochainVoyage.days_left}
                </p>
                <p className="text-[10px] font-semibold text-[#5A7064] mt-0.5">
                  jours restants
                </p>
              </div>

              <Link
                href={`/groupes/${prochainVoyage.group_id}`}
                className="px-4 py-2.5 rounded-xl bg-[#17402C] text-white text-xs font-bold  active:scale-95 transition-transform"
              >
                Gérer le départ
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-black/[0.06] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-[#17402C]">
              Aucun voyage planifié
            </h3>
            <p className="text-xs text-[#5A7064] mt-1 max-w-md">
              Créez une nouvelle expédition, invitez vos compagnons et préparez votre itinéraire.
            </p>
          </div>
          <Link
            href="/preparer-randonnee"
            className="px-5 py-2.5 rounded-xl bg-[#17402C] hover:bg-[#17402C] text-white text-xs font-bold  active:scale-95 transition-transform shrink-0 text-center"
          >
            + Planifier un voyage
          </Link>
        </div>
      )}

      {/* 2. Groupes & Expéditions Rejoins */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-[#17402C] flex items-center gap-1.5">
              <span>👥</span> Groupes & Clubs de Rando
            </h3>
            <p className="text-xs text-[#5A7064]">
              {clubs?.length ?? 0} club{(clubs?.length ?? 0) > 1 ? 's' : ''} actif{(clubs?.length ?? 0) > 1 ? 's' : ''}
            </p>
          </div>

          <Link
            href="/groupes"
            className="text-xs font-bold text-[#17402C] hover:underline flex items-center gap-1"
          >
            <span>Explorer</span>
            <span>→</span>
          </Link>
        </div>

        {!clubs || clubs.length === 0 ? (
          <div className="py-6 text-center text-[#5A7064]">
            <p className="text-2xl mb-2">🏕️</p>
            <p className="text-xs">Vous n'avez rejoint aucun groupe pour le moment.</p>
            <Link
              href="/groupes"
              className="inline-block mt-3 px-4 py-2 rounded-full bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#17402C] text-xs font-bold transition-colors"
            >
              Rejoindre un club
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="group p-3.5 rounded-2xl bg-[#FBFAF6] border border-black/[0.04] hover:border-[#17402C]/30 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F4F1EB] flex items-center justify-center text-lg shrink-0">
                    🏕️
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#17402C] truncate group-hover:text-[#17402C] transition-colors">
                      {club.name}
                    </p>
                    <p className="text-[10px] font-mono text-[#5A7064]">
                      {club.members_count} membres · {club.role}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[#5A7064] group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
