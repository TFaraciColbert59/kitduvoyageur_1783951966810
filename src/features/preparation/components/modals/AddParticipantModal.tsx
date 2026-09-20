'use client';

import React, { useState } from 'react';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button, Modal, Tabs, type TabOption } from '@/components/ui';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'flex flex-col gap-1 text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]';

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

  const typeOptions: readonly TabOption[] = [
    { id: 'human', label: 'Humain', icon: <span aria-hidden="true">👤</span> },
    { id: 'dog', label: 'Chien', icon: <span aria-hidden="true">🐾</span> },
  ];

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Ajouter un participant"
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
        <Tabs
          options={typeOptions}
          value={type}
          ariaLabel="Type de participant"
          onChange={(next) => setType(next as 'human' | 'dog')}
        />

        {type === 'human' ? (
          <div className="space-y-[var(--space-3)]">
            <label className={LABEL_CLASS}>
              <span>Prénom</span>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Camille"
                className={FIELD_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <label className={LABEL_CLASS}>
                <span>Poids corporel (kg)</span>
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={bodyWeightKg}
                  onChange={(e) => setBodyWeightKg(Number(e.target.value))}
                  className={`${FIELD_CLASS} font-mono`}
                />
              </label>

              <label className={LABEL_CLASS}>
                <span>Rôle</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'guide' | 'member' | 'medic')}
                  className={`${FIELD_CLASS} font-mono`}
                >
                  <option value="member">Équipier</option>
                  <option value="guide">Guide</option>
                  <option value="medic">Secouriste</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <label className={LABEL_CLASS}>
                <span>Poids du sac (kg)</span>
                <input
                  type="number"
                  step="0.5"
                  value={packWeightKg}
                  onChange={(e) => setPackWeightKg(Number(e.target.value))}
                  className={`${FIELD_CLASS} font-mono`}
                />
              </label>

              <label className={LABEL_CLASS}>
                <span>Groupe Sanguin</span>
                <select
                  value={bloodType}
                  onChange={(e) =>
                    setBloodType(
                      e.target.value as
                        | 'A+'
                        | 'A-'
                        | 'B+'
                        | 'B-'
                        | 'AB+'
                        | 'AB-'
                        | 'O+'
                        | 'O-'
                        | 'UNKNOWN'
                    )
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
                <span>Contact d&apos;Urgence ICE (Nom & Tel)</span>
                <input
                  type="text"
                  value={iceName}
                  onChange={(e) => setIceName(e.target.value)}
                  placeholder="Nom du proche"
                  className={FIELD_CLASS}
                />
              </label>
              <input
                type="tel"
                value={icePhone}
                onChange={(e) => setIcePhone(e.target.value)}
                placeholder="+33 6 00 00 00 00"
                aria-label="Téléphone du contact d'urgence"
                className={`${FIELD_CLASS} font-mono`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-[var(--space-3)]">
            <label className={LABEL_CLASS}>
              <span>Nom du Chien</span>
              <input
                type="text"
                required
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                placeholder="Ex: Maya"
                className={FIELD_CLASS}
              />
            </label>

            <label className={LABEL_CLASS}>
              <span>Race</span>
              <input
                type="text"
                value={dogBreed}
                onChange={(e) => setDogBreed(e.target.value)}
                placeholder="Ex: Border Collie"
                className={FIELD_CLASS}
              />
            </label>

            <div>
              <label className={LABEL_CLASS}>
                <span>Poids corporel (kg)</span>
                <input
                  type="number"
                  min="3"
                  max="80"
                  required
                  value={dogWeightKg}
                  onChange={(e) => setDogWeightKg(Number(e.target.value))}
                  className={`${FIELD_CLASS} font-mono`}
                />
              </label>
              <span className="mt-1 block text-[10px] text-[color:var(--lkv-text-muted)]">
                Capacité max sécuritaire (15%) : {(Number(dogWeightKg) * 0.15).toFixed(1)} kg.
              </span>
            </div>

            <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] pt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
              <input
                type="checkbox"
                checked={isCarryingPack}
                onChange={(e) => setIsCarryingPack(e.target.checked)}
                className="cursor-pointer rounded accent-[color:var(--sand-700)]"
              />
              <span>Équipé d&apos;un sac de bât / portage</span>
            </label>
          </div>
        )}

        <div className="flex gap-[var(--space-2)] pt-[var(--space-2)]">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" fullWidth>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
