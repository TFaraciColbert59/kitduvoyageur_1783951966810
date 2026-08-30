'use client';

import React, { useState } from 'react';
import { HumanParticipant } from '../types/participant.types';
import { GlassBreakModal } from './GlassBreakModal';

interface HumanParticipantCardProps {
  participant: HumanParticipant;
  onUnlock: (id: string) => void;
  onLock: (id: string) => void;
  onRemove?: (id: string) => void;
}

export const HumanParticipantCard: React.FC<HumanParticipantCardProps> = ({
  participant,
  onUnlock,
  onLock,
  onRemove,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { publicData } = participant;

  const getRoleBadge = (role: HumanParticipant['publicData']['role']) => {
    switch (role) {
      case 'guide':
        return { label: 'Guide', bg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' };
      case 'medic':
        return { label: 'Secouriste', bg: 'bg-red-500/20 text-red-700 dark:text-red-300' };
      case 'member':
      default:
        return { label: 'Équipier', bg: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
    }
  };

  const role = getRoleBadge(publicData.role);

  return (
    <>
      <div className="p-4 rounded-3xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3">
        {/* Top Info */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#17402C] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {publicData.firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#17402C] dark:text-[#E7E3D6]">
                  {publicData.firstName}
                </h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${role.bg}`}>
                  {role.label}
                </span>
              </div>
              <span className="text-[11px] text-[#5A7064] dark:text-[#9AAD9E] font-mono">
                🎒 Sac : {publicData.packWeightKg} kg · Forme : {publicData.fitnessScore}%
              </span>
            </div>
          </div>

          {onRemove && (
            <button
              onClick={() => onRemove(participant.id)}
              className="text-black/30 dark:text-white/30 hover:text-red-500 p-1 text-xs"
              title="Supprimer le participant"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
          <span className="text-[10px] font-mono text-[#5A7064] dark:text-[#9AAD9E]">
            Matrice Privée
          </span>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold text-[#17402C] dark:text-[#E7E3D6] transition-all flex items-center gap-1.5"
          >
            <span>🛡️ Fiche Médicale / ICE</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <GlassBreakModal
        participant={participant}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUnlock={onUnlock}
        onLock={onLock}
      />
    </>
  );
};
