'use client';

import React, { useState } from 'react';
import type { HumanParticipant, DogParticipant } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { GlassBreakModal } from '../modals/GlassBreakModal';
import { AddParticipantModal } from '../modals/AddParticipantModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Plus, Shield, HeartPulse, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { UsersIcon as Users } from '@/components/icons/users';

export function TeamTab() {
  const {
    humans,
    dogs,
    unlockParticipant,
    lockParticipant,
    removeHuman,
    removeDog,
    updateDog,
    getParticipantLoads,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [selectedHumanForIce, setSelectedHumanForIce] = useState<HumanParticipant | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState<'human' | 'dog'>('human');

  const loads = getParticipantLoads();

  const totalPayloadKg = (
    humans.reduce((acc, h) => acc + h.publicData.packWeightKg, 0) +
    dogs.reduce((acc, d) => acc + (d.isCarryingPack ? d.packWeightKg : 0), 0)
  ).toFixed(1);

  const totalWaterLiters = (
    humans.length * 2.5 +
    dogs.reduce((acc, d) => acc + d.waterRationLitersPerDay, 0)
  ).toFixed(1);

  const handleOpenAdd = (type: 'human' | 'dog') => {
    triggerHaptic('light');
    setAddDefaultType(type);
    setIsAddModalOpen(true);
  };

  const getRoleBadge = (role: HumanParticipant['publicData']['role']) => {
    switch (role) {
      case 'guide':
        return { label: 'Guide', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'medic':
        return { label: 'Secouriste', bg: 'bg-red-100 text-red-900 border-red-300' };
      case 'member':
      default:
        return { label: 'Équipier', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
    }
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Telemetry Summary Banner */}
      <div className="p-4 rounded-3xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#17402C] dark:text-white">
            <Users size={15} />
            <span>Matrice de Charge & Sécurité Équipe</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] dark:text-white dark:bg-white/10">
            {humans.length} 👤 · {dogs.length} 🐾
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">Portage Total</span>
            <span className="text-sm font-extrabold font-mono text-[#17402C] dark:text-white">{totalPayloadKg} kg</span>
          </div>
          <div className="p-2 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">Eau / Jour</span>
            <span className="text-sm font-extrabold font-mono text-[#17402C] dark:text-white">{totalWaterLiters} L</span>
          </div>
          <div className="p-2 rounded-2xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs">
            <span className="text-[9px] uppercase font-mono text-[#5A7064] dark:text-[#9AAD9E] block">Fiches ICE</span>
            <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">Sécurisées 🔒</span>
          </div>
        </div>
      </div>

      {/* Jauge de Répartition des Charges Individuelles */}
      <div className="p-4 rounded-3xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 shadow-xs space-y-2.5">
        <h4 className="text-xs font-bold text-[#17402C] dark:text-white flex items-center justify-between">
          <span>Équilibre des Charges & Limites Sécuritaires</span>
          <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E] font-normal">Max : 20% humain / 15% chien</span>
        </h4>

        <div className="space-y-2">
          {loads.map((load) => (
            <div key={load.participantId} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{load.type === 'human' ? '👤' : '🐾'}</span>
                  <span className="font-bold text-[#17402C] dark:text-white">{load.name}</span>
                  <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">({load.roleOrBreed})</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span className={`font-bold ${load.isOverloaded ? 'text-red-700' : 'text-[#17402C] dark:text-white'}`}>
                    {load.allocatedWeightKg} kg
                  </span>
                  <span className="text-[#5A7064] dark:text-[#9AAD9E]">/ max {load.maxSafeWeightKg} kg</span>
                  {load.isOverloaded ? (
                    <span className="text-red-600 font-bold ml-1">⚠️ Surcharge!</span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400 ml-1">✓ OK</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative w-full h-2 rounded-full bg-black/10 dark:bg-white/10 p-0.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    load.isOverloaded
                      ? 'bg-red-500'
                      : load.loadPercentage > 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, load.loadPercentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Human Participants Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-[#17402C] dark:text-white uppercase tracking-wider">
            Équipiers Humains ({humans.length})
          </h3>
          <button
            type="button"
            onClick={() => handleOpenAdd('human')}
            className="px-3.5 py-1 rounded-full bg-[#17402C] hover:bg-[#1f543a] text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus size={13} />
            <span>Ajouter un équipier</span>
          </button>
        </div>

        <div className="space-y-2">
          {humans.map((human) => {
            const role = getRoleBadge(human.publicData.role);

            return (
              <div
                key={human.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#17402C] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {human.publicData.firstName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-[#17402C] dark:text-white">
                          {human.publicData.firstName}
                        </h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${role.bg}`}>
                          {role.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#365233] dark:text-[#9AAD9E] font-mono mt-0.5">
                        🎒 Sac : {human.publicData.packWeightKg} kg · Forme : {human.publicData.fitnessScore}%
                      </p>
                    </div>
                  </div>

                  {humans.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        removeHuman(human.id);
                      }}
                      className="text-[#5A7064] hover:text-red-600 p-1 text-xs"
                      title="Supprimer l'équipier"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Bottom Action: Glass Break ICE */}
                <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
                  <span className="text-[10px] font-mono text-[#5A7064] dark:text-[#9AAD9E] flex items-center gap-1">
                    <Shield size={11} className="text-emerald-700 dark:text-emerald-400" /> Matrice Médicale Privée
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedHumanForIce(human);
                    }}
                    className="px-3 py-1 rounded-xl bg-white hover:bg-white/90 text-xs font-bold text-[#17402C] border border-white/80 shadow-2xs flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <HeartPulse size={12} className="text-red-600" />
                    <span>Fiche ICE d'urgence →</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Canine Companions Section */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-[#17402C] dark:text-white uppercase tracking-wider">
            Compagnons Canins ({dogs.length})
          </h3>
          <button
            type="button"
            onClick={() => handleOpenAdd('dog')}
            className="px-3.5 py-1 rounded-full bg-amber-800 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus size={13} />
            <span>Ajouter un chien</span>
          </button>
        </div>

        {dogs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 text-center text-xs text-[#5A7064]">
            Aucun chien de randonnée enregistré pour ce trek.
          </div>
        ) : (
          <div className="space-y-2">
            {dogs.map((dog) => (
              <div
                key={dog.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#17402C]/90 backdrop-blur-xl border border-white/80 dark:border-white/20 flex flex-col justify-between gap-2.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-800 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                      🐾
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-[#17402C] dark:text-white">{dog.name}</h4>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {dog.breed}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#365233] dark:text-[#9AAD9E] font-mono mt-0.5">
                        Poids : {dog.weightKg} kg · Bât max : {dog.maxCarryingCapacityKg} kg
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      removeDog(dog.id);
                    }}
                    className="text-[#5A7064] hover:text-red-600 p-1 text-xs"
                    title="Supprimer le chien"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-black/5 dark:border-white/10">
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-white/10 text-center border border-white/60">
                    <span className="text-[#5A7064] dark:text-[#9AAD9E] block">Ration Eau</span>
                    <span className="font-bold text-[#17402C] dark:text-white">{dog.waterRationLitersPerDay} L / jour</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-white/10 text-center border border-white/60">
                    <span className="text-[#5A7064] dark:text-[#9AAD9E] block">Ration Croquettes</span>
                    <span className="font-bold text-[#17402C] dark:text-white">{dog.foodRationGramsPerDay} g / jour</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Glass Break Modal */}
      <GlassBreakModal
        participant={selectedHumanForIce}
        isOpen={selectedHumanForIce !== null}
        onClose={() => setSelectedHumanForIce(null)}
        onUnlock={unlockParticipant}
        onLock={lockParticipant}
      />

      {/* Add Participant Modal */}
      <AddParticipantModal
        isOpen={isAddModalOpen}
        defaultType={addDefaultType}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
