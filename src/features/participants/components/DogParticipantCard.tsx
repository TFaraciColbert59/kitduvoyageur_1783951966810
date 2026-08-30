'use client';

import React from 'react';
import { DogParticipant } from '../types/participant.types';

interface DogParticipantCardProps {
  dog: DogParticipant;
  onToggleCarryingPack: (id: string, isCarrying: boolean) => void;
  onRemove?: (id: string) => void;
}

export const DogParticipantCard: React.FC<DogParticipantCardProps> = ({
  dog,
  onToggleCarryingPack,
  onRemove,
}) => {
  const isOverloaded = dog.isCarryingPack && dog.packWeightKg > dog.maxCarryingCapacityKg;
  const loadPercentage = dog.isCarryingPack
    ? Math.round((dog.packWeightKg / dog.maxCarryingCapacityKg) * 100)
    : 0;

  return (
    <div className="p-4 rounded-3xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm hover:shadow-md transition-all space-y-3">
      {/* Top Identity */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-700 text-white font-bold flex items-center justify-center text-lg shadow-sm">
            🐾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[#17402C] dark:text-[#E7E3D6]">
                {dog.name}
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {dog.breed}
              </span>
            </div>
            <span className="text-[11px] text-[#5A7064] dark:text-[#9AAD9E] font-mono">
              Poids : {dog.weightKg} kg · Capacité max (15%) : {dog.maxCarryingCapacityKg} kg
            </span>
          </div>
        </div>

        {onRemove && (
          <button
            onClick={() => onRemove(dog.id)}
            className="text-black/30 dark:text-white/30 hover:text-red-500 p-1 text-xs"
            title="Supprimer le compagnon canin"
          >
            ✕
          </button>
        )}
      </div>

      {/* Portage Status & Gauge */}
      <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#17402C] dark:text-[#E7E3D6]">
            Sac de bât canin :
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono font-bold ${
                isOverloaded ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {dog.isCarryingPack ? `${dog.packWeightKg} kg (${loadPercentage}%)` : 'Non équipé'}
            </span>
            <input
              type="checkbox"
              checked={dog.isCarryingPack}
              onChange={(e) => onToggleCarryingPack(dog.id, e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {dog.isCarryingPack && (
          <>
            <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverloaded ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, loadPercentage)}%` }}
              />
            </div>

            {isOverloaded && (
              <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                ⚠️ Charge excessive ! Dépasse les 15% de portage physiologique recommandés ({dog.maxCarryingCapacityKg} kg max).
              </p>
            )}
          </>
        )}
      </div>

      {/* Daily Needs Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
          <span className="text-[11px] text-[#5A7064] dark:text-[#9AAD9E]">💧 Eau / jour</span>
          <span className="font-mono font-bold text-[#17402C] dark:text-[#E7E3D6]">
            {dog.waterRationLitersPerDay} L
          </span>
        </div>
        <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
          <span className="text-[11px] text-[#5A7064] dark:text-[#9AAD9E]">🍖 Croquettes</span>
          <span className="font-mono font-bold text-[#17402C] dark:text-[#E7E3D6]">
            {dog.foodRationGramsPerDay} g
          </span>
        </div>
      </div>
    </div>
  );
};
