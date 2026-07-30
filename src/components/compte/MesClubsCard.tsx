'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ClubItem } from '@/lib/mock/compte-marceline';

interface MesClubsCardProps {
  clubs: ClubItem[];
}

export default function MesClubsCard({ clubs }: MesClubsCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#1C2620]/5 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1C2620]/5 pb-4">
        <div>
          <h3 className="font-display font-800 text-2xl text-[#1C2620]">
            Mes <span className="font-serif italic font-normal">clubs</span>
          </h3>
          <p className="text-xs font-mono text-[#1C2620]/50 mt-0.5">
            4 clubs · 1 en tant qu'admin
          </p>
        </div>

        <Link href="/clubs" className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 transition-colors">
          Explorer l'annuaire →
        </Link>
      </div>

      <p className="text-xs text-[#1C2620]/60 leading-relaxed">
        Vos communautés régulières. Ouvrez un club pour voir les prochaines sorties et le fil du groupe.
      </p>

      {/* List */}
      <div className="space-y-3">
        {clubs.map((club) => (
          <div
            key={club.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#F5F3ED]/40 hover:bg-[#F5F3ED] border border-[#1C2620]/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl overflow-hidden relative shrink-0 border border-[#1C2620]/10 shadow-sm bg-emerald-900">
                <Image
                  src={club.logo_url || '/assets/images/no_image.png'}
                  alt={club.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-base text-[#1C2620] truncate">
                    {club.name}
                  </h4>
                  {club.role === 'Admin' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-800 text-white">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1C2620]/10 text-[#1C2620]/70">
                      Membre
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#1C2620]/60 font-medium mt-0.5 truncate">
                  {club.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
              {club.badge && (
                <span className="px-3 py-1 bg-amber-400 text-amber-950 rounded-full text-xs font-extrabold shadow-sm">
                  {club.badge}
                </span>
              )}
              <Link
                href={`/clubs/${club.slug}`}
                className="px-4 py-2 bg-[#1C2620] hover:bg-[#2D3F35] text-white rounded-full text-xs font-bold transition-all whitespace-nowrap"
              >
                Ouvrir
              </Link>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
