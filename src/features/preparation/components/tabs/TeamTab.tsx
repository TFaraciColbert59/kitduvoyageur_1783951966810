'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import type { HumanParticipant } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { GlassBreakModal } from '../modals/GlassBreakModal';
import { AddParticipantModal } from '../modals/AddParticipantModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { UsersIcon as Users } from '@/components/icons/users';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';

export function TeamTab() {
  const {
    humans,
    dogs,
    unlockParticipant,
    lockParticipant,
    removeHuman,
    removeDog,
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
        return { label: 'Guide', tone: 'sage' as const };
      case 'medic':
        return { label: 'Secouriste', tone: 'danger' as const };
      case 'member':
      default:
        return { label: 'Équipier', tone: 'info' as const };
    }
  };

  return (
    <div className="space-y-[var(--space-3)] animate-in fade-in duration-200">
      <Card className="space-y-[var(--space-3)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            <Users size={15} />
            <span>Matrice de Charge & Sécurité Équipe</span>
          </div>
          <Badge tone="stone">
            {humans.length} 👤 · {dogs.length} 🐾
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-[var(--space-2)] text-center text-[length:var(--lkv-text-footnote)]">
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              Portage Total
            </span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {totalPayloadKg} kg
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              Eau / Jour
            </span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {totalWaterLiters} L
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[9px] uppercase text-[color:var(--lkv-text-muted)]">
              Fiches ICE
            </span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--sage-600)]">
              Sécurisées 🔒
            </span>
          </Card>
        </div>
      </Card>

      <Card className="space-y-[var(--space-3)]">
        <h4 className="flex items-center justify-between text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
          <span>Équilibre des Charges & Limites Sécuritaires</span>
          <span className="text-[10px] font-normal text-[color:var(--lkv-text-muted)]">
            Max : 20% humain / 15% chien
          </span>
        </h4>

        <div className="space-y-[var(--space-2)]">
          {loads.map((load) => (
            <div key={load.participantId} className="space-y-[var(--space-1)]">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <span aria-hidden="true" className="text-xs">
                    {load.type === 'human' ? '👤' : '🐾'}
                  </span>
                  <span className="font-bold text-[color:var(--lkv-text-primary)]">{load.name}</span>
                  <span className="text-[10px] text-[color:var(--lkv-text-muted)]">
                    ({load.roleOrBreed})
                  </span>
                </div>
                <div className="flex items-center gap-[var(--space-1)] font-mono text-[10px]">
                  <span
                    className={`font-bold ${load.isOverloaded ? 'text-[color:var(--lkv-danger-dark)]' : 'text-[color:var(--lkv-text-primary)]'}`}
                  >
                    {load.allocatedWeightKg} kg
                  </span>
                  <span className="text-[color:var(--lkv-text-muted)]">
                    / max {load.maxSafeWeightKg} kg
                  </span>
                  {load.isOverloaded ? (
                    <span className="ml-[var(--space-1)] font-bold text-[color:var(--lkv-danger)]">
                      ⚠️ Surcharge!
                    </span>
                  ) : (
                    <span className="ml-[var(--space-1)] text-[color:var(--sage-600)]">✓ OK</span>
                  )}
                </div>
              </div>

              <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)] p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    load.isOverloaded
                      ? 'bg-[color:var(--lkv-danger)]'
                      : load.loadPercentage > 85
                        ? 'bg-[color:var(--lkv-warning)]'
                        : 'bg-[color:var(--sage-600)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, load.loadPercentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            Équipiers Humains ({humans.length})
          </h3>
          <Button
            size="sm"
            icon={<Icon name="plus" size={13} />}
            onClick={() => handleOpenAdd('human')}
          >
            Ajouter un équipier
          </Button>
        </div>

        <ul className="space-y-[var(--space-2)]">
          {humans.map((human) => {
            const role = getRoleBadge(human.publicData.role);

            return (
              <li key={human.id}>
                <Card className="flex flex-col gap-[var(--space-3)]">
                  <div className="flex items-start justify-between gap-[var(--space-2)]">
                    <div className="flex items-center gap-[var(--space-3)]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-action)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-on-action)]">
                        {human.publicData.firstName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-[var(--space-2)]">
                          <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                            {human.publicData.firstName}
                          </h4>
                          <Badge tone={role.tone}>{role.label}</Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--lkv-text-secondary)]">
                          🎒 Sac : {human.publicData.packWeightKg} kg · Forme :{' '}
                          {human.publicData.fitnessScore}%
                        </p>
                      </div>
                    </div>

                    {humans.length > 1 && (
                      <IconButton
                        aria-label="Supprimer l'équipier"
                        title="Supprimer l'équipier"
                        size="sm"
                        onClick={() => {
                          triggerHaptic('light');
                          removeHuman(human.id);
                        }}
                      >
                        <Icon name="trash2" size={14} />
                      </IconButton>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
                    <span className="flex items-center gap-[var(--space-1)] font-mono text-[10px] text-[color:var(--lkv-text-muted)]">
                      <Icon name="shield" size={11} className="text-[color:var(--sage-600)]" />
                      Matrice Médicale Privée
                    </span>

                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Icon name="heart-pulse" size={12} />}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedHumanForIce(human);
                      }}
                    >
                      Fiche ICE d&apos;urgence →
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-[var(--space-2)] pt-[var(--space-2)]">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            Compagnons Canins ({dogs.length})
          </h3>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="plus" size={13} />}
            onClick={() => handleOpenAdd('dog')}
          >
            Ajouter un chien
          </Button>
        </div>

        {dogs.length === 0 ? (
          <Card>
            <EmptyState compact title="Aucun chien de randonnée enregistré pour ce trek." />
          </Card>
        ) : (
          <ul className="space-y-[var(--space-2)]">
            {dogs.map((dog) => (
              <li key={dog.id}>
                <Card className="flex flex-col gap-[var(--space-3)]">
                  <div className="flex items-start justify-between gap-[var(--space-2)]">
                    <div className="flex items-center gap-[var(--space-3)]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--sand-800)] text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-inverted)]">
                        🐾
                      </div>
                      <div>
                        <div className="flex items-center gap-[var(--space-2)]">
                          <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                            {dog.name}
                          </h4>
                          <Badge tone="warn">{dog.breed}</Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--lkv-text-secondary)]">
                          Poids : {dog.weightKg} kg · Bât max : {dog.maxCarryingCapacityKg} kg
                        </p>
                      </div>
                    </div>

                    <IconButton
                      aria-label="Supprimer le chien"
                      title="Supprimer le chien"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('light');
                        removeDog(dog.id);
                      }}
                    >
                      <Icon name="trash2" size={14} />
                    </IconButton>
                  </div>

                  <div className="grid grid-cols-2 gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)] font-mono text-[10px]">
                    <Card variant="compact" className="text-center">
                      <span className="block text-[color:var(--lkv-text-muted)]">Ration Eau</span>
                      <span className="font-bold text-[color:var(--lkv-text-primary)]">
                        {dog.waterRationLitersPerDay} L / jour
                      </span>
                    </Card>
                    <Card variant="compact" className="text-center">
                      <span className="block text-[color:var(--lkv-text-muted)]">
                        Ration Croquettes
                      </span>
                      <span className="font-bold text-[color:var(--lkv-text-primary)]">
                        {dog.foodRationGramsPerDay} g / jour
                      </span>
                    </Card>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GlassBreakModal
        participant={selectedHumanForIce}
        isOpen={selectedHumanForIce !== null}
        onClose={() => setSelectedHumanForIce(null)}
        onUnlock={unlockParticipant}
        onLock={lockParticipant}
      />

      <AddParticipantModal
        isOpen={isAddModalOpen}
        defaultType={addDefaultType}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
