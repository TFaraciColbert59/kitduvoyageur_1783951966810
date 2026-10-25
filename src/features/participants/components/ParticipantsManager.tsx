'use client';

import React, { useState } from 'react';
import { useParticipantsStore } from '../stores/useParticipantsStore';
import { HumanParticipantCard } from './HumanParticipantCard';
import { DogParticipantCard } from './DogParticipantCard';
import { Button, EmptyState, Modal } from '@/components/ui';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'flex flex-col gap-1 text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]';

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
        bloodType: newBloodType,
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
    <div className="space-y-[var(--space-6)] pb-24 animate-in fade-in duration-300">
      {/* Télémétrie de groupe */}
      <div
        // Calcul hydrique/humain dépendant de la météo live (eau/jour varie) →
        // masque visuel canonique sur la télémétrie (protocole Y0.5).
        data-visual-mask
        className="relative overflow-hidden rounded-[var(--lkv-radius-card)] bg-[linear-gradient(135deg,var(--lkv-forest-950),var(--lkv-forest-700))] p-[var(--space-4)] text-[color:var(--lkv-text-inverted)] shadow-elevation-3"
      >
        <div className="grid grid-cols-3 gap-[var(--space-2)] text-center">
          <div className="rounded-[var(--lkv-radius-sm)] bg-white/5 p-[var(--space-2)]">
            <span className="block font-mono text-[9px] uppercase opacity-75">Poids portage</span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold">
              {stats.totalPackWeightKg} kg
            </span>
          </div>
          <div className="rounded-[var(--lkv-radius-sm)] bg-white/5 p-[var(--space-2)]">
            <span className="block font-mono text-[9px] uppercase opacity-75">Eau / jour</span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold">
              {stats.totalWaterDailyLiters} L
            </span>
          </div>
          <div className="rounded-[var(--lkv-radius-sm)] bg-white/5 p-[var(--space-2)]">
            <span className="block font-mono text-[9px] uppercase opacity-75">Sécurité ICE</span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-success)]">
              Verrouillée
            </span>
          </div>
        </div>
      </div>

      {/* Human Participants Section */}
      <div className="space-y-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[length:var(--lkv-text-footnote)] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
            Participants Humains ({humans.length})
          </h3>
          <Button size="sm" onClick={() => setShowAddHuman(true)}>
            + Ajouter un équipier
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-3)]">
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
      <div className="space-y-[var(--space-3)] pt-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[length:var(--lkv-text-footnote)] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
            Compagnons Canins ({dogs.length})
          </h3>
          <Button size="sm" variant="secondary" onClick={() => setShowAddDog(true)}>
            + Ajouter un chien
          </Button>
        </div>

        {dogs.length === 0 ? (
          <EmptyState compact title="Aucun chien de randonnée enregistré pour cette expédition." />
        ) : (
          <div className="grid grid-cols-1 gap-[var(--space-3)]">
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

      <Modal
        open={showAddHuman}
        onOpenChange={setShowAddHuman}
        title="Ajouter un équipier"
        size="md"
      >
        <form onSubmit={handleCreateHuman} className="flex flex-col gap-[var(--space-3)]">
          <label className={LABEL_CLASS}>
            <span>Prénom</span>
            <input
              type="text"
              required
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              placeholder="Ex: Camille"
              className={FIELD_CLASS}
            />
          </label>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <label className={LABEL_CLASS}>
              <span>Poids du sac (kg)</span>
              <input
                type="number"
                step="0.5"
                value={newPackWeight}
                onChange={(e) => setNewPackWeight(Number(e.target.value))}
                className={`${FIELD_CLASS} font-mono`}
              />
            </label>
            <label className={LABEL_CLASS}>
              <span>Groupe Sanguin</span>
              <select
                value={newBloodType}
                onChange={(e) =>
                  setNewBloodType(e.target.value as 'A+' | 'O+' | 'B+' | 'AB+' | 'UNKNOWN')
                }
                className={`${FIELD_CLASS} font-mono`}
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
            </label>
          </div>
          <div className="space-y-[var(--space-2)]">
            <label className={LABEL_CLASS}>
              <span>Contact ICE (Nom & Tel)</span>
              <input
                type="text"
                value={newIceName}
                onChange={(e) => setNewIceName(e.target.value)}
                placeholder="Nom du proche"
                className={FIELD_CLASS}
              />
            </label>
            <input
              type="tel"
              value={newIcePhone}
              onChange={(e) => setNewIcePhone(e.target.value)}
              placeholder="+33 6 00 00 00 00"
              aria-label="Téléphone du contact ICE"
              className={`${FIELD_CLASS} font-mono`}
            />
          </div>

          <div className="flex gap-[var(--space-2)] pt-[var(--space-2)]">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowAddHuman(false)}>
              Annuler
            </Button>
            <Button type="submit" fullWidth>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showAddDog}
        onOpenChange={setShowAddDog}
        title="Ajouter un compagnon canin"
        size="md"
      >
        <form onSubmit={handleCreateDog} className="flex flex-col gap-[var(--space-3)]">
          <label className={LABEL_CLASS}>
            <span>Nom du Chien</span>
            <input
              type="text"
              required
              value={newDogName}
              onChange={(e) => setNewDogName(e.target.value)}
              placeholder="Ex: Maya"
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            <span>Race</span>
            <input
              type="text"
              value={newDogBreed}
              onChange={(e) => setNewDogBreed(e.target.value)}
              placeholder="Ex: Border Collie"
              className={FIELD_CLASS}
            />
          </label>
          <div>
            <label className={LABEL_CLASS}>
              <span>Poids corporel (kg)</span>
              <input
                type="number"
                step="1"
                required
                value={newDogWeight}
                onChange={(e) => setNewDogWeight(Number(e.target.value))}
                className={`${FIELD_CLASS} font-mono`}
              />
            </label>
            <span className="mt-1 block text-[10px] text-[color:var(--lkv-text-muted)]">
              Capacité portage max calculée automatiquement : {(Number(newDogWeight) * 0.15).toFixed(1)} kg.
            </span>
          </div>

          <div className="flex gap-[var(--space-2)] pt-[var(--space-2)]">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowAddDog(false)}>
              Annuler
            </Button>
            <Button type="submit" fullWidth>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
