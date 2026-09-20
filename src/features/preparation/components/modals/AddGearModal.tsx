'use client';

import React, { useState } from 'react';
import type { GearCategory, GearStatus } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Button, Modal } from '@/components/ui';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'flex flex-col gap-1 text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]';

interface AddGearModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddGearModal: React.FC<AddGearModalProps> = ({ isOpen, onClose }) => {
  const { addItem, humans } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [name, setName] = useState('');
  const [weight, setWeight] = useState(250);
  const [category, setCategory] = useState<GearCategory>('misc');
  const [status, setStatus] = useState<GearStatus>('packed');
  const [isWorn, setIsWorn] = useState(false);
  const [isConsumable, setIsConsumable] = useState(false);
  const [isVital, setIsVital] = useState(false);
  const [brand, setBrand] = useState('');
  const [assignedParticipantId, setAssignedParticipantId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    triggerHaptic('success');
    addItem({
      name: name.trim(),
      weightGrams: Number(weight) || 0,
      category,
      status,
      isWorn,
      isConsumable,
      isVital,
      isPrivate: false,
      quantity: 1,
      brand: brand.trim() || undefined,
      assignedParticipantId: assignedParticipantId || undefined,
    });

    setName('');
    setWeight(250);
    setBrand('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Ajouter un équipement"
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
        <label className={LABEL_CLASS}>
          <span>Nom de l&apos;objet</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Tente Ultra-Light 2P"
            className={FIELD_CLASS}
          />
        </label>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <label className={LABEL_CLASS}>
            <span>Poids (grammes)</span>
            <input
              type="number"
              required
              min="0"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className={`${FIELD_CLASS} font-mono`}
            />
          </label>

          <label className={LABEL_CLASS}>
            <span>Catégorie</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GearCategory)}
              className={`${FIELD_CLASS} font-mono`}
            >
              <option value="shelter">Abri / Bivouac</option>
              <option value="sleep">Couchage</option>
              <option value="cook">Cuisine / Popote</option>
              <option value="clothing">Vêtements</option>
              <option value="water">Eau & Filtre</option>
              <option value="safety">Sécurité & Soins</option>
              <option value="tech">Tech & Énergie</option>
              <option value="navigation">Navigation</option>
              <option value="misc">Divers</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <label className={LABEL_CLASS}>
            <span>Statut initial</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as GearStatus)}
              className={`${FIELD_CLASS} font-mono`}
            >
              <option value="packed">Dans le sac</option>
              <option value="owned">Possédé (au camp)</option>
              <option value="to_buy">À acheter</option>
            </select>
          </label>

          <label className={LABEL_CLASS}>
            <span>Marque / Modèle</span>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ex: MSR, Petzl"
              className={FIELD_CLASS}
            />
          </label>
        </div>

        {humans.length > 0 && (
          <label className={LABEL_CLASS}>
            <span>Assigné au porteur</span>
            <select
              value={assignedParticipantId}
              onChange={(e) => setAssignedParticipantId(e.target.value)}
              className={`${FIELD_CLASS} font-mono`}
            >
              <option value="">Non assigné (commun)</option>
              {humans.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.publicData.firstName}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="space-y-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
          <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
            <input
              type="checkbox"
              checked={isWorn}
              onChange={(e) => setIsWorn(e.target.checked)}
              className="cursor-pointer rounded accent-[color:var(--sage-600)]"
            />
            <span>Porté sur soi (exclu du Base Weight)</span>
          </label>

          <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
            <input
              type="checkbox"
              checked={isConsumable}
              onChange={(e) => setIsConsumable(e.target.checked)}
              className="cursor-pointer rounded accent-[color:var(--sage-600)]"
            />
            <span>Consommable (eau, vivres, gaz)</span>
          </label>

          <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-danger-dark)]">
            <input
              type="checkbox"
              checked={isVital}
              onChange={(e) => setIsVital(e.target.checked)}
              className="cursor-pointer rounded accent-[color:var(--lkv-danger)]"
            />
            <span>Équipement vital de sécurité</span>
          </label>
        </div>

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
