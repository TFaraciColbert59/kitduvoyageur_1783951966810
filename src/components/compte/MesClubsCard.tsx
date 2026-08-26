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
    <div className="glass rounded-[1.25rem] p-6 space-y-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#17402C]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[#17402C] tracking-tight">
            Mes <span className="font-serif italic font-normal">clubs</span>
          </h3>
          <p className="text-xs font-mono text-[#5A7064] mt-0.5">
            4 clubs · 1 en tant qu'admin
          </p>
        </div>

        <Link href="/clubs" className="text-xs font-bold text-[#365233] hover:text-[#17402C] transition-colors">
          Explorer l'annuaire →
        </Link>
      </div>

      <p className="text-xs text-[#365233]/70 leading-relaxed">
        Vos communautés régulières. Ouvrez un club pour voir les prochaines sorties et le fil du groupe.
      </p>

      {/* List */}
      <div className="space-y-3">
        {clubs.map((club) => (
          <div
            key={club.id}
            className="glass-sub-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl overflow-hidden relative shrink-0 border border-[#17402C]/10 bg-[#17402C]">
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
                  <h4 className="font-bold text-base text-[#17402C] truncate">
                    {club.name}
                  </h4>
                  {club.role === 'Admin' ? (
                    <span className="glass-pill pill-warn !px-2 !py-0.5 text-[10px] font-bold">
                      Admin
                    </span>
                  ) : (
                    <span className="glass-pill !px-2 !py-0.5 text-[10px] font-bold">
                      Membre
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#365233]/60 font-medium mt-0.5 truncate">
                  {club.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
              {club.badge && (
                <span className="glass-pill pill-warn">{club.badge}</span>
              )}
              <Link
                href={`/clubs/${club.slug}`}
                className="glass-capsule-btn !py-2 !px-4 !min-h-[0] text-xs font-bold"
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
