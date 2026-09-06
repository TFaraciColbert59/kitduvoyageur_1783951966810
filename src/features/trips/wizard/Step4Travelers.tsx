'use client';

import React from 'react';
import type { GroupType } from './wizardTypes';
import {
  Users,
  User,
  Heart,
  Smile,
  Plus,
  Minus,
  Sparkles,
  Info,
} from 'lucide-react';

interface Step4TravelersProps {
  travelersCount: number;
  groupType: GroupType;
  title: string;
  description: string;
  defaultSuggestedTitle: string;
  onTravelersCountChange: (count: number) => void;
  onGroupTypeChange: (type: GroupType) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (desc: string) => void;
}

const GROUP_TYPES: Array<{
  id: GroupType;
  label: string;
  Icon: React.ElementType;
}> = [
  { id: 'solo', label: 'Solo', Icon: User },
  { id: 'couple', label: 'En couple', Icon: Heart },
  { id: 'friends', label: 'Entre amis', Icon: Users },
  { id: 'family', label: 'En famille', Icon: Smile },
];

export function Step4Travelers({
  travelersCount,
  groupType,
  title,
  description,
  defaultSuggestedTitle,
  onTravelersCountChange,
  onGroupTypeChange,
  onTitleChange,
  onDescriptionChange,
}: Step4TravelersProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5B7F55] mb-1">
          <Users size={14} />
          <span>Étape 4 sur 5</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#17402C]">
          Qui prend part à l&apos;aventure ?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Le nombre de participants permet de dimensionner le matériel partagé (abri, popote, filtrage) et d&apos;équilibrer les sacs.
        </p>
      </div>

      {/* 1. Nombre de participants avec Stepper */}
      <div className="p-4 sm:p-5 bg-white/80 rounded-2xl border border-black/5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#17402C] uppercase tracking-wider">
            Nombre de voyageurs
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onTravelersCountChange(Math.max(1, travelersCount - 1))}
              disabled={travelersCount <= 1}
              aria-label="Diminuer le nombre de voyageurs"
              className="w-10 h-10 rounded-xl bg-black/5 hover:bg-black/10 disabled:opacity-30 text-[#17402C] flex items-center justify-center transition-all min-h-[44px] min-w-[44px]"
            >
              <Minus size={16} />
            </button>
            <span className="text-xl font-bold text-[#17402C] w-8 text-center">
              {travelersCount}
            </span>
            <button
              type="button"
              onClick={() => onTravelersCountChange(Math.min(50, travelersCount + 1))}
              disabled={travelersCount >= 50}
              aria-label="Augmenter le nombre de voyageurs"
              className="w-10 h-10 rounded-xl bg-[#17402C] text-white hover:bg-[#1f563b] flex items-center justify-center transition-all min-h-[44px] min-w-[44px]"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Boutons rapides */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {[1, 2, 4, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onTravelersCountChange(n);
                if (n === 1) onGroupTypeChange('solo');
                else if (n === 2) onGroupTypeChange('couple');
                else onGroupTypeChange('friends');
              }}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                travelersCount === n
                  ? 'bg-[#17402C] text-white border-[#17402C]'
                  : 'bg-white hover:bg-black/5 text-[#17402C] border-black/10'
              }`}
            >
              {n === 1 ? '1 (Solo)' : n === 2 ? '2 (Duo)' : `${n} personnes`}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Type de groupe */}
      <div>
        <label className="block text-xs font-semibold text-[#17402C] uppercase tracking-wider mb-2.5">
          Type de groupe
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GROUP_TYPES.map(({ id, label, Icon }) => {
            const active = groupType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onGroupTypeChange(id)}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-center transition-all min-h-[44px] ${
                  active
                    ? 'bg-[#17402C] text-white border-[#17402C]'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-black/5'
                }`}
              >
                <Icon size={16} />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Titre et description de l'expédition */}
      <div className="space-y-4 pt-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-[#17402C]">
              Nom de l&apos;expédition
            </label>
            <button
              type="button"
              onClick={() => onTitleChange(defaultSuggestedTitle)}
              className="text-[11px] text-[#5B7F55] hover:underline flex items-center gap-1"
            >
              <Sparkles size={11} />
              <span>Suggérer le titre</span>
            </button>
          </div>
          <input
            type="text"
            value={title}
            placeholder={defaultSuggestedTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full px-4 py-3 bg-white rounded-xl border border-black/10 text-sm focus:ring-2 focus:ring-[#17402C] focus:outline-none min-h-[48px] text-[#17402C] font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#17402C] mb-1">
            Notes & objectifs (facultatif)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Ex : Première expérience de haute altitude, objectif autonomie complète en tente..."
            className="w-full px-4 py-3 bg-white rounded-xl border border-black/10 text-xs focus:ring-2 focus:ring-[#17402C] focus:outline-none resize-none text-gray-700"
          />
        </div>
      </div>

      {/* Info calcul de sac */}
      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-2.5 text-xs text-[#17402C]">
        <Info size={16} className="text-[#5B7F55] shrink-0" />
        <span>
          Le moteur ajustera la liste de matériel : les tentes et réchauds sont partagés, tandis que les duvets et vêtements sont comptés individuellement.
        </span>
      </div>
    </div>
  );
}
