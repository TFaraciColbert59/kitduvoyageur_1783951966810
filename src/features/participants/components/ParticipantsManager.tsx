'use client';

import React, { useState } from 'react';
import { useParticipantsStore } from '../stores/useParticipantsStore';
import { HumanParticipantCard } from './HumanParticipantCard';
import { DogParticipantCard } from './DogParticipantCard';

export const ParticipantsManager: React.FC = () => {
  const humans = useParticipantsStore((s) => s.humans);
  const dogs = useParticipantsStore((s) => s.dogs);
  const unlockParticipant = useParticipantsStore((s) => s.unlockParticipant);
  const lockParticipant = useParticipantsStore((s) => s.lockParticipant);
  const removeHuman = useParticipantsStore((s) => s.removeHuman);
  const removeDog = useParticipantsStore((s) => s.removeDog);
  const updateDog = useParticipantsStore((s) => s.updateDog);
  const addHuman = useParticipantsStore((s) => s.addHuman);
  const addDog = useParticipantsStore((s) => s.addDog);
  const getGroupStats = useParticipantsStore((s) => s.getGroupStats);

  const [showAddHuman, setShowAddHuman] = useState(false);
  const [showAddDog, setShowAddDog] = useState(false);

  // Add Human form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newPackWeight, setNewPackWeight] = useState(10);
  const [newBloodType, setNewBloodType] = useState<'A+' | 'O+' | 'B+' | 'AB+' | 'UNKNOWN'>('UNKNOWN');
  const [newIceName, setNewIceName] = useState('');
  const [newIcePhone, setNewIcePhone] = useState('');

  // Add Dog form state
  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [newDogWeight, setNewDogWeight] = useState(20);

  const stats = getGroupStats();

  const handleCreateHuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim()) return;

    addHuman({
      type: 'human',
      publicData: {
        id: `human-${Date.now()}`,
        firstName: newFirstName.trim(),
        packWeightKg: Number(newPackWeight) || 0,
        fitnessScore: 80,
        role: 'member',
      },
      privateData: {
        bloodType: newBloodType as any,
        allergies: [],
        iceContact: {
          name: newIceName.trim() || 'Contact d’urgence',
          phone: newIcePhone.trim() || '+33 6 00 00 00 00',
          relationship: 'Proche',
        },
      },
    });

    setNewFirstName('');
    setNewIceName('');
    setNewIcePhone('');
    setShowAddHuman(false);
  };

  const handleCreateDog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()) return;

    addDog({
      type: 'dog',
      name: newDogName.trim(),
      breed: newDogBreed.trim() || 'Chien de randonnée',
      weightKg: Number(newDogWeight) || 15,
      isCarryingPack: true,
      packWeightKg: Math.round(Number(newDogWeight) * 0.1 * 10) / 10,
    });

    setNewDogName('');
    setNewDogBreed('');
    setShowAddDog(false);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Group Telemetry Summary Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#17402C] to-[#2D5A40] text-white shadow-xl shadow-[#17402C]/10 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#A6C1A0]">
            MATRICE DE GROUPE & LOGISTIQUE
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-white/15 text-white backdrop-blur-md">
            {stats.totalHumans} 👤 · {stats.totalDogs} 🐾
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight font-display mb-1">
          Équipiers & Compagnons
        </h2>
        <p className="text-xs text-[#C5D0C7]">
          Répartition des charges, autonomie hydrique et sécurisation des fiches médicales ICE.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10 text-center">
          <div className="p-2 rounded-xl bg-white/5">
            <span className="text-[9px] uppercase font-mono opacity-75 block">Poids Portage</span>
            <span className="text-base font-extrabold font-mono text-white">
              {stats.totalPackWeightKg} kg
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/5">
            <span className="text-[9px] uppercase font-mono opacity-75 block">Eau / Jour</span>
            <span className="text-base font-extrabold font-mono text-white">
              {stats.totalWaterDailyLiters} L
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/5">
            <span className="text-[9px] uppercase font-mono opacity-75 block">Sécurité ICE</span>
            <span className="text-base font-extrabold font-mono text-[#4ADE80]">
              Verrouillée
            </span>
          </div>
        </div>
      </div>

      {/* Human Participants Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
            Participants Humains ({humans.length})
          </h3>
          <button
            onClick={() => setShowAddHuman(true)}
            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all"
          >
            + Ajouter un équipier
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {humans.map((human) => (
            <HumanParticipantCard
              key={human.id}
              participant={human}
              onUnlock={unlockParticipant}
              onLock={lockParticipant}
              onRemove={humans.length > 1 ? removeHuman : undefined}
            />
          ))}
        </div>
      </div>

      {/* Dog Companions Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
            Compagnons Canins ({dogs.length})
          </h3>
          <button
            onClick={() => setShowAddDog(true)}
            className="px-3 py-1 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all"
          >
            + Ajouter un chien
          </button>
        </div>

        {dogs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center text-xs text-[#5A7064] dark:text-[#9AAD9E]">
            Aucun chien de randonnée enregistré pour cette expédition.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {dogs.map((dog) => (
              <DogParticipantCard
                key={dog.id}
                dog={dog}
                onToggleCarryingPack={(id, carrying) =>
                  updateDog(id, { isCarryingPack: carrying })
                }
                onRemove={removeDog}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Add Human */}
      {showAddHuman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form
            onSubmit={handleCreateHuman}
            className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Ajouter un équipier</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Prénom</label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Ex: Camille"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#A6C1A0] mb-1 font-mono">Poids du sac (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPackWeight}
                    onChange={(e) => setNewPackWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6C1A0] mb-1 font-mono">Groupe Sanguin</label>
                  <select
                    value={newBloodType}
                    onChange={(e) => setNewBloodType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                  >
                    <option value="UNKNOWN">Inconnu</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Contact ICE (Nom & Tel)</label>
                <input
                  type="text"
                  value={newIceName}
                  onChange={(e) => setNewIceName(e.target.value)}
                  placeholder="Nom du proche"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white mb-1.5"
                />
                <input
                  type="tel"
                  value={newIcePhone}
                  onChange={(e) => setNewIcePhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddHuman(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Dog */}
      {showAddDog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form
            onSubmit={handleCreateDog}
            className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Ajouter un compagnon canin</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Nom du Chien</label>
                <input
                  type="text"
                  required
                  value={newDogName}
                  onChange={(e) => setNewDogName(e.target.value)}
                  placeholder="Ex: Maya"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Race</label>
                <input
                  type="text"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                  placeholder="Ex: Border Collie"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Poids corporel (kg)</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={newDogWeight}
                  onChange={(e) => setNewDogWeight(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                />
                <span className="text-[10px] text-[#A6C1A0] mt-1 block">
                  Capacité portage max calculée automatiquement : {(Number(newDogWeight) * 0.15).toFixed(1)} kg.
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddDog(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-bold shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
