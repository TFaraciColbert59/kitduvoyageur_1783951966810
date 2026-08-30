'use client';

import React, { useState } from 'react';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'human' | 'dog';
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'human',
}) => {
  const { addHuman, addDog } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [type, setType] = useState<'human' | 'dog'>(defaultType);

  // Human state
  const [firstName, setFirstName] = useState('');
  const [bodyWeightKg, setBodyWeightKg] = useState(70);
  const [packWeightKg, setPackWeightKg] = useState(6);
  const [role, setRole] = useState<'guide' | 'member' | 'medic'>('member');
  const [fitnessScore, setFitnessScore] = useState(80);
  const [bloodType, setBloodType] = useState<'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN'>('UNKNOWN');
  const [iceName, setIceName] = useState('');
  const [icePhone, setIcePhone] = useState('');
  const [iceRelationship, setIceRelationship] = useState('Proche');

  // Dog state
  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogWeightKg, setDogWeightKg] = useState(22);
  const [isCarryingPack, setIsCarryingPack] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');

    if (type === 'human') {
      if (!firstName.trim()) return;
      addHuman({
        type: 'human',
        publicData: {
          id: `human-${Date.now()}`,
          firstName: firstName.trim(),
          bodyWeightKg: Number(bodyWeightKg) || 70,
          packWeightKg: Number(packWeightKg) || 0,
          fitnessScore: Number(fitnessScore) || 80,
          role,
        },
        privateData: {
          bloodType,
          allergies: [],
          iceContact: {
            name: iceName.trim() || 'Contact d’urgence',
            phone: icePhone.trim() || '+33 6 00 00 00 00',
            relationship: iceRelationship.trim() || 'Proche',
          },
        },
      });
      setFirstName('');
      setIceName('');
      setIcePhone('');
    } else {
      if (!dogName.trim()) return;
      addDog({
        type: 'dog',
        name: dogName.trim(),
        breed: dogBreed.trim() || 'Chien de randonnée',
        weightKg: Number(dogWeightKg) || 20,
        isCarryingPack,
        packWeightKg: isCarryingPack ? Math.round(Number(dogWeightKg) * 0.12 * 10) / 10 : 0,
      });
      setDogName('');
      setDogBreed('');
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-participant-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 id="add-participant-title" className="text-lg font-bold text-white">
            Ajouter un participant
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Type Picker : Humain ou Chien */}
        <div className="flex items-center gap-1 p-1 bg-black/30 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setType('human')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              type === 'human'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#A6C1A0] hover:text-white'
            }`}
          >
            <span>👤</span>
            <span>Humain</span>
          </button>

          <button
            type="button"
            onClick={() => setType('dog')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              type === 'dog'
                ? 'bg-amber-700 text-white shadow-sm'
                : 'text-[#A6C1A0] hover:text-white'
            }`}
          >
            <span>🐾</span>
            <span>Chien</span>
          </button>
        </div>

        {type === 'human' ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Prénom</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Camille"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Poids corporel (kg)</label>
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={bodyWeightKg}
                  onChange={(e) => setBodyWeightKg(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Rôle</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                >
                  <option value="member">Équipier</option>
                  <option value="guide">Guide</option>
                  <option value="medic">Secouriste</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Poids du sac (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={packWeightKg}
                  onChange={(e) => setPackWeightKg(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Groupe Sanguin</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as any)}
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
              <label className="block text-[#A6C1A0] mb-1 font-mono">Contact d'Urgence ICE (Nom & Tel)</label>
              <input
                type="text"
                value={iceName}
                onChange={(e) => setIceName(e.target.value)}
                placeholder="Nom du proche"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white mb-1.5"
              />
              <input
                type="tel"
                value={icePhone}
                onChange={(e) => setIcePhone(e.target.value)}
                placeholder="+33 6 00 00 00 00"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Nom du Chien</label>
              <input
                type="text"
                required
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                placeholder="Ex: Maya"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
              />
            </div>

            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Race</label>
              <input
                type="text"
                value={dogBreed}
                onChange={(e) => setDogBreed(e.target.value)}
                placeholder="Ex: Border Collie"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
              />
            </div>

            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Poids corporel (kg)</label>
              <input
                type="number"
                min="3"
                max="80"
                required
                value={dogWeightKg}
                onChange={(e) => setDogWeightKg(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              />
              <span className="text-[10px] text-[#A6C1A0] mt-1 block">
                Capacité max sécuritaire (15%) : {(Number(dogWeightKg) * 0.15).toFixed(1)} kg.
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={isCarryingPack}
                onChange={(e) => setIsCarryingPack(e.target.checked)}
                className="rounded text-amber-700 focus:ring-amber-600 cursor-pointer"
              />
              <span className="text-white">Équipé d'un sac de bât / portage</span>
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
          >
            Annuler
          </button>
          <button
            type="submit"
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md ${
              type === 'human' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-700 hover:bg-amber-600'
            }`}
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};
