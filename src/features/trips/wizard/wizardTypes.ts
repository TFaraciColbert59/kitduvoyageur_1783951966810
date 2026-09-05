import type { PlannerOutput, PlannerPace } from '../engine/types';
import type { TripActivityType, TripDifficulty } from '../types/trip.types';

export interface SelectedCountry {
  code: string;
  name: string;
  flag: string;
  isCurated?: boolean;
}

export type DatesChoice = 'dates' | 'duration';
export type AccommodationType = 'bivouac' | 'refuge' | 'hotel' | 'mixed';
export type GroupType = 'solo' | 'couple' | 'friends' | 'family';

export interface TripWizardState {
  step: number;
  tripId: string | null;
  slug: string | null;
  countries: SelectedCountry[];
  datesChoice: DatesChoice;
  startDate: string;
  endDate: string;
  durationDays: number;
  pace: PlannerPace;
  activityType: TripActivityType;
  difficulty: TripDifficulty;
  accommodationType: AccommodationType;
  travelersCount: number;
  groupType: GroupType;
  groupId: string | null;
  title: string;
  description: string;
  generatedOutput: PlannerOutput | null;
}

export const CURATED_COUNTRIES: SelectedCountry[] = [
  { code: 'FR', name: 'France (Mont-Blanc)', flag: '🇫🇷', isCurated: true },
  { code: 'IS', name: 'Islande (Laugavegur)', flag: '🇮🇸', isCurated: true },
  { code: 'MA', name: 'Maroc (Toubkal)', flag: '🇲🇦', isCurated: true },
  { code: 'NP', name: 'Népal (Annapurnas)', flag: '🇳🇵', isCurated: true },
  { code: 'PE', name: 'Pérou (Salkantay)', flag: '🇵🇪', isCurated: true },
];

export const OTHER_COUNTRIES: SelectedCountry[] = [
  { code: 'NO', name: 'Norvège (Lofoten)', flag: '🇳🇴' },
  { code: 'CH', name: 'Suisse (Valais)', flag: '🇨🇭' },
  { code: 'IT', name: 'Italie (Dolomites)', flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne (Pyrénées)', flag: '🇪🇸' },
  { code: 'GR', name: 'Grèce (Péloponnèse)', flag: '🇬🇷' },
  { code: 'JP', name: 'Japon (Kumano Kodo)', flag: '🇯🇵' },
  { code: 'NZ', name: 'Nouvelle-Zélande', flag: '🇳🇿' },
  { code: 'CA', name: 'Canada (Rocheuses)', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis (Pacific Crest)', flag: '🇺🇸' },
];

export const DEFAULT_WIZARD_STATE: TripWizardState = {
  step: 1,
  tripId: null,
  slug: null,
  countries: [CURATED_COUNTRIES[0]],
  datesChoice: 'duration',
  startDate: '',
  endDate: '',
  durationDays: 7,
  pace: 'standard',
  activityType: 'trekking',
  difficulty: 'moderate',
  accommodationType: 'bivouac',
  travelersCount: 1,
  groupType: 'solo',
  groupId: null,
  title: '',
  description: '',
  generatedOutput: null,
};
