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
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-lkv-secondary mb-1">
          <Icon name="compass" size={14} />
          <span>Étape 3 sur 5</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-lkv-primary">
          Quel est votre style d&apos;expédition ?
        </h2>
        <p className="text-sm text-[var(--lkv-text-muted)] mt-1">
          Ces préférences guident le moteur pour sélectionner les étapes adaptées à vos envies et à
          votre forme physique.
        </p>
      </div>

      {/* 1. Hébergement */}
      <div>
        <label className="block text-xs font-semibold text-lkv-primary uppercase tracking-wider mb-2.5">
          Type d&apos;hébergement privilégié
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ACCOMMODATIONS.map(({ id, title, desc, Icon }) => {
            const active = accommodationType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onAccommodationChange(id)}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all min-h-[52px] ${
                  active
                    ? 'bg-lkv-primary text-white border-lkv-primary shadow-sm'
                    : 'bg-white/80 hover:bg-white text-lkv-primary border-black/5 hover:border-black/10'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    active ? 'bg-white/20 text-white' : 'bg-black/5 text-lkv-secondary'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{title}</div>
                  <div
                    className={`text-xs mt-0.5 ${active ? 'text-[var(--sage-300)]' : 'text-[var(--lkv-text-muted)]'}`}
                  >
                    {desc}
                  </div>
                </div>
                {active && <Icon name="check" size={16} className="text-white shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Rythme de marche */}
      <div>
        <label className="block text-xs font-semibold text-lkv-primary uppercase tracking-wider mb-2.5">
          Rythme quotidien
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PACES.map(({ id, title, kms, desc }) => {
            const active = pace === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPaceChange(id)}
                className={`p-3.5 rounded-2xl border text-left transition-all min-h-[52px] ${
                  active
                    ? 'bg-lkv-primary text-white border-lkv-primary shadow-sm'
                    : 'bg-white/80 hover:bg-white text-lkv-primary border-black/5 hover:border-black/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{title}</div>
                  {active && <Icon name="check" size={15} />}
                </div>
                <div
                  className={`text-xs font-bold mt-1 ${active ? 'text-[var(--sage-300)]' : 'text-lkv-secondary'}`}
                >
                  {kms}
                </div>
                <div
                  className={`text-[11px] mt-1.5 leading-snug ${active ? 'text-white/80' : 'text-[var(--lkv-text-muted)]'}`}
                >
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Activité principale */}
      <div>
        <label className="block text-xs font-semibold text-lkv-primary uppercase tracking-wider mb-2.5">
          Activité dominante
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ACTIVITIES.map(({ id, title, Icon }) => {
            const active = activityType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onActivityChange(id)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all min-h-[64px] ${
                  active
                    ? 'bg-lkv-primary text-white border-lkv-primary'
                    : 'bg-white/80 hover:bg-white text-lkv-primary border-black/5'
                }`}
              >
                <Icon
                  size={18}
                  className={active ? 'text-[var(--sage-300)]' : 'text-lkv-secondary'}
                />
                <span className="text-xs font-semibold mt-1.5">{title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Niveau / Difficulté */}
      <div>
        <label className="block text-xs font-semibold text-lkv-primary uppercase tracking-wider mb-2.5">
          Niveau technique & expérience
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIFFICULTIES.map(({ id, title, desc }) => {
            const active = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onDifficultyChange(id)}
                className={`p-3 rounded-xl border text-left transition-all min-h-[44px] ${
                  active
                    ? 'bg-lkv-primary text-white border-lkv-primary'
                    : 'bg-white/80 hover:bg-white text-lkv-primary border-black/5'
                }`}
              >
                <div className="text-xs font-semibold">{title}</div>
                <div
                  className={`text-[10px] mt-0.5 truncate ${active ? 'text-white/80' : 'text-[var(--lkv-text-muted)]'}`}
                >
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
