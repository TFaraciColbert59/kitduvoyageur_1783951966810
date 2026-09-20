'use client';

import React from 'react';
import { DogParticipant } from '../types/participant.types';
import { Badge, Card, IconButton } from '@/components/ui';
import Icon from '@/components/ui/Icon';

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
    <Card className="space-y-[var(--space-3)]">
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--sand-700)] text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-inverted)]">
            🐾
          </div>
          <div>
            <div className="flex items-center gap-[var(--space-2)]">
              <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                {dog.name}
              </h4>
              <Badge tone="warn">{dog.breed}</Badge>
            </div>
            <span className="font-mono text-[11px] text-[color:var(--lkv-text-muted)]">
              Poids : {dog.weightKg} kg · Capacité max (15%) : {dog.maxCarryingCapacityKg} kg
            </span>
          </div>
        </div>

        {onRemove && (
          <IconButton
            aria-label="Supprimer le compagnon canin"
            title="Supprimer le compagnon canin"
            size="sm"
            onClick={() => onRemove(dog.id)}
          >
            <Icon name="x" size={14} />
          </IconButton>
        )}
      </div>

      <Card variant="compact" className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between text-[length:var(--lkv-text-footnote)]">
          <span className="font-semibold text-[color:var(--lkv-text-primary)]">
            Sac de bât canin :
          </span>
          <div className="flex items-center gap-[var(--space-2)]">
            <span
              className={`font-mono text-[11px] font-bold ${
                isOverloaded
                  ? 'text-[color:var(--lkv-danger-dark)]'
                  : 'text-[color:var(--sage-600)]'
              }`}
            >
              {dog.isCarryingPack ? `${dog.packWeightKg} kg (${loadPercentage}%)` : 'Non équipé'}
            </span>
            <input
              type="checkbox"
              aria-label="Sac de bât canin"
              checked={dog.isCarryingPack}
              onChange={(e) => onToggleCarryingPack(dog.id, e.target.checked)}
              className="cursor-pointer rounded accent-[color:var(--sage-600)]"
            />
          </div>
        </div>

        {dog.isCarryingPack && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverloaded ? 'bg-[color:var(--lkv-danger)]' : 'bg-[color:var(--sage-600)]'
                }`}
                style={{ width: `${Math.min(100, loadPercentage)}%` }}
              />
            </div>

            {isOverloaded && (
              <p className="text-[10px] font-semibold text-[color:var(--lkv-danger-dark)]">
                ⚠️ Charge excessive ! Dépasse les 15% de portage physiologique recommandés (
                {dog.maxCarryingCapacityKg} kg max).
              </p>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-[var(--space-2)] pt-[var(--space-1)] text-[length:var(--lkv-text-footnote)]">
        <Card variant="compact" className="flex items-center justify-between">
          <span className="text-[11px] text-[color:var(--lkv-text-muted)]">💧 Eau / jour</span>
          <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">
            {dog.waterRationLitersPerDay} L
          </span>
        </Card>
        <Card variant="compact" className="flex items-center justify-between">
          <span className="text-[11px] text-[color:var(--lkv-text-muted)]">🍖 Croquettes</span>
          <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">
            {dog.foodRationGramsPerDay} g
          </span>
        </Card>
      </div>
    </Card>
  );
};
