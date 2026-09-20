'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import type { GroupType } from './wizardTypes';
import { Users, User, Heart, Smile } from 'lucide-react';
import { Button, Card, Chip, IconButton } from '@/components/ui';

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

const FIELD_CLASS =
  'min-h-[48px] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

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
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
          <Icon name="users" size={14} />
          <span>Étape 4 sur 5</span>
        </div>
        <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
          Qui prend part à l&apos;aventure ?
        </h2>
        <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Le nombre de participants permet de dimensionner le matériel partagé (abri, popote,
          filtrage) et d&apos;équilibrer les sacs.
        </p>
      </div>

      {/* 1. Nombre de participants avec Stepper */}
      <Card className="space-y-[var(--space-4)]">
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            Nombre de voyageurs
          </span>
          <div className="flex items-center gap-[var(--space-3)]">
            <IconButton
              type="button"
              size="sm"
              onClick={() => onTravelersCountChange(Math.max(1, travelersCount - 1))}
              disabled={travelersCount <= 1}
              aria-label="Diminuer le nombre de voyageurs"
            >
              <Icon name="minus" size={16} />
            </IconButton>
            <span className="w-8 text-center text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              {travelersCount}
            </span>
            <IconButton
              type="button"
              size="sm"
              variant="solid"
              onClick={() => onTravelersCountChange(Math.min(50, travelersCount + 1))}
              disabled={travelersCount >= 50}
              aria-label="Augmenter le nombre de voyageurs"
            >
              <Icon name="plus" size={16} />
            </IconButton>
          </div>
        </div>

        {/* Boutons rapides */}
        <div className="grid grid-cols-4 gap-[var(--space-2)] pt-[var(--space-1)]">
          {[1, 2, 4, 6].map((n) => (
            <Chip
              key={n}
              selected={travelersCount === n}
              onClick={() => {
                onTravelersCountChange(n);
                if (n === 1) onGroupTypeChange('solo');
                else if (n === 2) onGroupTypeChange('couple');
                else onGroupTypeChange('friends');
              }}
            >
              {n === 1 ? '1 (Solo)' : n === 2 ? '2 (Duo)' : `${n} personnes`}
            </Chip>
          ))}
        </div>
      </Card>

      {/* 2. Type de groupe */}
      <div>
        <label className="mb-[var(--space-3)] block text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Type de groupe
        </label>
        <div
          className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4"
          role="radiogroup"
          aria-label="Type de groupe"
        >
          {GROUP_TYPES.map(({ id, label, Icon }) => {
            const active = groupType === id;
            return (
              <Card
                key={id}
                variant="interactive"
                role="radio"
                aria-checked={active}
                selected={active}
                onClick={() => onGroupTypeChange(id)}
                className="flex items-center justify-center gap-[var(--space-2)] text-center"
              >
                <Icon size={16} />
                <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {label}
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Titre et description de l'expédition */}
      <div className="space-y-[var(--space-4)] pt-[var(--space-2)]">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
              Nom de l&apos;expédition
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Icon name="sparkles" size={11} />}
              onClick={() => onTitleChange(defaultSuggestedTitle)}
            >
              Suggérer le titre
            </Button>
          </div>
          <input
            type="text"
            value={title}
            placeholder={defaultSuggestedTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className={`${FIELD_CLASS} font-medium`}
          />
        </div>

        <div>
          <label className="mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            Notes & objectifs (facultatif)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Ex : Première expérience de haute altitude, objectif autonomie complète en tente..."
            className={`${FIELD_CLASS} resize-none text-[color:var(--lkv-text-secondary)]`}
          />
        </div>
      </div>

      {/* Info calcul de sac */}
      <Card tone="sage" className="flex items-center gap-[var(--space-2)]">
        <Icon name="info" size={16} className="shrink-0 text-[color:var(--lkv-secondary)]" />
        <span className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
          Le moteur ajustera la liste de matériel : les tentes et réchauds sont partagés, tandis que
          les duvets et vêtements sont comptés individuellement.
        </span>
      </Card>
    </div>
  );
}
