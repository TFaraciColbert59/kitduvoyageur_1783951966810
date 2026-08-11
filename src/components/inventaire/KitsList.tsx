// src/components/mon-materiel/KitsList.tsx
'use client';

import React, { useState } from 'react';
import type { UserKitData } from '@/lib/mock/mon-materiel-marceline';

interface KitsListProps {
  kits?: UserKitData[];
  onToggleKitAssociation?: (kitId: string, isAssociated: boolean) => void;
}

export default function KitsList({ kits = [], onToggleKitAssociation }: KitsListProps) {
  // Local state for interactive switches (empty by default — no invented associations)
  const [associatedState, setAssociatedState] = useState<Record<string, boolean>>({});

  const handleToggle = (kitId: string) => {
    const nextVal = !associatedState[kitId];
    setAssociatedState((prev) => ({ ...prev, [kitId]: nextVal }));
    if (onToggleKitAssociation) {
      onToggleKitAssociation(kitId, nextVal);
    }
  };

  const activeCount = Object.values(associatedState).filter(Boolean).length;

  const kitBadgesColor: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    B: 'bg-amber-100 text-amber-800 border-amber-200',
    C: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    D: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  if (kits.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-[#E8E4D8] shadow-sm">
        <h2 className="text-xl font-extrabold text-[#132219] font-display">Kits associés</h2>
        <p className="text-xs text-[#132219]/60 mt-0.5">
          Cochez pour inclure cet article dans un kit. Le poids du kit se met à jour automatiquement.
        </p>
        <div className="mt-8 py-10 text-center bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E8E4D8]">
          <p className="text-2xl mb-2">🎒</p>
          <p className="text-sm font-semibold text-[#132219]">Aucun kit pour le moment</p>
          <p className="text-xs text-[#132219]/60 mt-1 max-w-sm mx-auto">
            Cet article n&apos;est associé à aucun kit existant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-[#E8E4D8] shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#132219] font-display">Kits associés</h2>
          <p className="text-xs text-[#132219]/60 mt-0.5">
            Cochez pour inclure cet article dans un kit. Le poids du kit se met à jour automatiquement.
          </p>
        </div>
        <span className="text-xs font-bold text-[#2D5A3D] bg-[#E8F3EC] px-3 py-1 rounded-full whitespace-nowrap">
          {activeCount} kits sur {kits.length}
        </span>
      </div>

      {/* List of Kit items with toggle switches */}
      <div className="space-y-3 pt-1">
        {kits.map((kit, index) => {
          const letterCode = kit.code || String.fromCharCode(65 + index);
          const isIncluded = associatedState[kit.id] ?? false;

          return (
            <div
              key={kit.id}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                isIncluded ? 'bg-[#FAF8F5] border-[#132219]/20' : 'bg-white border-[#E8E4D8]'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Letter Code Badge */}
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-base flex-shrink-0 ${
                    kitBadgesColor[letterCode] || 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  {letterCode}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#132219] text-sm sm:text-base truncate">
                      {kit.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#132219]/60 truncate mt-0.5">
                    {kit.articles_count} items • {kit.weight_kg} kg total
                    {isIncluded && <span className="italic"> • Inclus dans ce kit</span>}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(kit.id)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isIncluded ? 'bg-[#132219]' : 'bg-[#E8E4D8]'
                }`}
                role="switch"
                aria-checked={isIncluded}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isIncluded ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}