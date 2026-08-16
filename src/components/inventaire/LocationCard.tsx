// src/components/mon-materiel/LocationCard.tsx
'use client';

import React from 'react';
import Image from 'next/image';

interface LocationCardProps {
  locationCity?: string;
  loanStatus?: string | null;
  borrowerName?: string | null;
  attachedPack?: string | null;
  onLend: () => void;
}

export default function LocationCard({
  locationCity = 'Grenoble',
  loanStatus,
  borrowerName,
  attachedPack = 'Sac Osprey Aura AG 65',
  onLend,
}: LocationCardProps) {
  const isLent = Boolean(loanStatus || borrowerName);

  return (
    <div className="bg-white rounded-[0.75rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      <div>
        <h3 className="text-lg font-extrabold text-[#132219] font-display">
          Actuellement <span className="italic font-serif font-normal text-[#2D5A3D]">chez</span>
        </h3>
        <p className="text-xs text-[#132219]/60 mt-0.5">
          Où se trouve physiquement cet équipement.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4D8] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[#132219]/10 border border-[#132219]/20 flex-shrink-0">
            {isLent ? (
              <div className="w-full h-full bg-amber-600 text-white font-bold flex items-center justify-center text-sm">
                {(borrowerName || 'A')[0]}
              </div>
            ) : (
              <Image
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt="Marceline"
                fill
                className="object-cover"
              />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="font-extrabold text-[#132219] text-xs sm:text-sm truncate">
              {isLent ? `Prêté à ${borrowerName || 'Antoine Durand'}` : `Chez vous : ${locationCity}`}
            </h4>
            <p className="text-[11px] text-[#132219]/60 truncate mt-0.5">
              {isLent
                ? 'Prêt enregistré le 12 oct.'
                : attachedPack
                ? `Rangement : associé au ${attachedPack}`
                : 'Dans votre armoire à matériel'}
            </p>
          </div>
        </div>

        <button
          onClick={onLend}
          className="px-3.5 py-2 bg-[#E8F3EC] hover:bg-[#D4E8DC] text-[#2D5A3D] font-extrabold text-xs rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
        >
          {isLent ? 'Gérer le prêt' : 'Prêter'}
        </button>
      </div>
    </div>
  );
}
