'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import type { AccommodationType } from './wizardTypes';
import type { PlannerPace } from '../engine/types';
import type { TripActivityType, TripDifficulty } from '../types/trip.types';
import {
  Tent,
  Home,
  Building,
  Layers,
  Mountain,
  Footprints,
  Flame,
  Car,
  BookOpen,
} from 'lucide-react';
import { Card } from '@/components/ui';

interface Step3StylePaceProps {
  accommodationType: AccommodationType;
  activityType: TripActivityType;
  pace: PlannerPace;
  difficulty: TripDifficulty;
  onAccommodationChange: (acc: AccommodationType) => void;
  onActivityChange: (act: TripActivityType) => void;
  onPaceChange: (pace: PlannerPace) => void;
  onDifficultyChange: (diff: TripDifficulty) => void;
}

const ACCOMMODATIONS: Array<{
  id: AccommodationType;
  title: string;
  desc: string;
  Icon: React.ElementType;
}> = [
  { id: 'bivouac', title: 'Bivouac & Tente', desc: '100% autonomie sous les étoiles', Icon: Tent },
  {
    id: 'refuge',
    title: 'Refuges gardés',
    desc: 'Dortoirs d’altitude et repas chauds',
    Icon: Home,
  },
  { id: 'hotel', title: 'Hôtels & Gîtes', desc: 'Chambres confortables et repos', Icon: Building },
  { id: 'mixed', title: 'Mixte équilibré', desc: 'Alternance bivouac et gîte', Icon: Layers },
];

const ACTIVITIES: Array<{
  id: TripActivityType;
  title: string;
  desc: string;
  Icon: React.ElementType;
}> = [
  { id: 'trekking', title: 'Trekking', desc: 'Itinérance alpine avec sac à dos', Icon: Mountain },
  { id: 'hiking', title: 'Randonnée', desc: 'Boucles et sentiers de découverte', Icon: Footprints },
  {
    id: 'bivouac',
    title: 'Bushcraft & Bivouac',
    desc: 'Vie sauvage et techniques de camp',
    Icon: Flame,
  },
  {
    id: 'roadtrip',
    title: 'Roadtrip & Camp',
    desc: 'Aventure itinérante en van ou 4x4',
    Icon: Car,
  },
  {
    id: 'cultural',
    title: 'Sentiers Culturels',
    desc: 'Patrimoine, villages et histoire',
    Icon: BookOpen,
  },
];

const PACES: Array<{
  id: PlannerPace;
  title: string;
  kms: string;
  desc: string;
}> = [
  {
    id: 'chill',
    title: 'Contemplatif (Chill)',
    kms: '10 - 15 km/jour',
    desc: 'Rythme doux, pauses baignade ou photo, dénivelé progressif',
  },
  {
    id: 'standard',
    title: 'Équilibré (Standard)',
    kms: '15 - 20 km/jour',
    desc: 'Le tempo idéal du trekkeur : belle journée de marche active',
  },
  {
    id: 'intense',
    title: 'Soutenu (Intense)',
    kms: '20 - 30 km/jour',
    desc: 'Grosses journées, cols engagés, sac allégé et bon dénivelé',
  },
];

const DIFFICULTIES: Array<{
  id: TripDifficulty;
  title: string;
  desc: string;
}> = [
  { id: 'easy', title: 'Débutant', desc: 'Sentiers larges et faciles' },
  { id: 'moderate', title: 'Intermédiaire', desc: 'Sentiers de montagne réguliers' },
  { id: 'hard', title: 'Exigeant', desc: 'Passages aériens et pierriers' },
  { id: 'expert', title: 'Expert', desc: 'Haute montagne et terrain alpin' },
];

/**
 * Step3StylePace — choix exclusifs (radiogroup) sous forme de cartes
 * sélectionnables : le rôle radio est conservé sur les cartes canoniques.
 */
export function Step3StylePace({
  accommodationType,
  activityType,
  pace,
  difficulty,
  onAccommodationChange,
  onActivityChange,
  onPaceChange,
  onDifficultyChange,
}: Step3StylePaceProps) {
  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
          <Icon name="compass" size={14} />
          <span>Étape 3 sur 5</span>
        </div>
        <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
          Quel est votre style d&apos;expédition ?
        </h2>
        <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Ces préférences guident le moteur pour sélectionner les étapes adaptées à vos envies et à
          votre forme physique.
        </p>
      </div>

      {/* 1. Hébergement */}
      <div>
        <label className="mb-[var(--space-3)] block text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Type d&apos;hébergement privilégié
        </label>
        <div
          className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2"
          role="radiogroup"
          aria-label="Type d'hébergement privilégié"
        >
          {ACCOMMODATIONS.map(({ id, title, desc, Icon }) => {
            const active = accommodationType === id;
            return (
              <Card
                key={id}
                variant="interactive"
                role="radio"
                aria-checked={active}
                selected={active}
                onClick={() => onAccommodationChange(id)}
                className="flex w-full items-start justify-start gap-[var(--space-3)] text-left"
              >
                <div
                  className={`shrink-0 rounded-[var(--lkv-radius-sm)] p-[var(--space-2)] ${
                    active
                      ? 'bg-[color:var(--lkv-action-soft)] text-[color:var(--lkv-action)]'
                      : 'bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-text-secondary)]'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                    {desc}
                  </div>
                </div>
                {active && (
                  <Icon
                    name="check"
                    size={16}
                    className="mt-1 shrink-0 text-[color:var(--lkv-action)]"
                  />
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* 2. Rythme de marche */}
      <div>
        <label className="mb-[var(--space-3)] block text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Rythme quotidien
        </label>
        <div
          className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3"
          role="radiogroup"
          aria-label="Rythme quotidien"
        >
          {PACES.map(({ id, title, kms, desc }) => {
            const active = pace === id;
            return (
              <Card
                key={id}
                variant="interactive"
                role="radio"
                aria-checked={active}
                selected={active}
                onClick={() => onPaceChange(id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {title}
                  </div>
                  {active && <Icon name="check" size={15} className="text-[color:var(--lkv-action)]" />}
                </div>
                <div className="mt-1 text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-secondary)]">
                  {kms}
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-[color:var(--lkv-text-muted)]">
                  {desc}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Activité principale */}
      <div>
        <label className="mb-[var(--space-3)] block text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Activité dominante
        </label>
        <div
          className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3 lg:grid-cols-5"
          role="radiogroup"
          aria-label="Activité dominante"
        >
          {ACTIVITIES.map(({ id, title, Icon }) => {
            const active = activityType === id;
            return (
              <Card
                key={id}
                variant="interactive"
                role="radio"
                aria-checked={active}
                selected={active}
                onClick={() => onActivityChange(id)}
                className="flex flex-col items-center justify-center text-center"
              >
                <Icon
                  size={18}
                  className={
                    active
                      ? 'text-[color:var(--lkv-action)]'
                      : 'text-[color:var(--lkv-text-secondary)]'
                  }
                />
                <span className="mt-1.5 text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {title}
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. Niveau / Difficulté */}
      <div>
        <label className="mb-[var(--space-3)] block text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Niveau technique & expérience
        </label>
        <div
          className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4"
          role="radiogroup"
          aria-label="Niveau technique & expérience"
        >
          {DIFFICULTIES.map(({ id, title, desc }) => {
            const active = difficulty === id;
            return (
              <Card
                key={id}
                variant="interactive"
                role="radio"
                aria-checked={active}
                selected={active}
                onClick={() => onDifficultyChange(id)}
                className="min-h-[44px] w-full text-left"
              >
                <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {title}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[color:var(--lkv-text-muted)]">
                  {desc}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
